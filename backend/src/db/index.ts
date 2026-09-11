// SQLite via better-sqlite3 + Drizzle. Falls back to an in-memory store so
// the backend still runs where native modules can't compile (e.g. minimal containers).
import * as schema from './schema'

let sqlite: any = null
try {
  const Database = (await import('better-sqlite3')).default
  sqlite = new Database(process.env.DB_PATH ?? './research-engine.db')
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(MIGRATION)
} catch (e) {
  console.warn('[re] better-sqlite3 unavailable — using in-memory fallback. (' + (e as Error).message + ')')
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT, space_id TEXT, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, model TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT, kind TEXT, text TEXT, added_at INTEGER);
CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, title TEXT, url TEXT, collection TEXT, saved_at INTEGER);
`

const mem = {
  chats: new Map<string, any>(),
  documents: new Map<string, any>(),
}

export const db = {
  schema,
  insertChat(chat: any) {
    if (sqlite) sqlite.prepare('INSERT OR REPLACE INTO chats VALUES (?,?,?,?,?)').run(chat.id, chat.title, chat.spaceId ?? null, chat.createdAt, chat.updatedAt)
    else mem.chats.set(chat.id, chat)
  },
  insertDocument(doc: any) {
    if (sqlite) sqlite.prepare('INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?)').run(doc.id, doc.name, doc.kind, doc.text, doc.addedAt)
    else mem.documents.set(doc.id, doc)
  },
  listDocuments() {
    if (sqlite) return sqlite.prepare('SELECT id, name, kind, added_at as addedAt FROM documents ORDER BY added_at DESC').all()
    return [...mem.documents.values()]
  },
}

export function dbStats() {
  return sqlite ? { engine: 'sqlite', file: process.env.DB_PATH ?? './research-engine.db' } : { engine: 'memory' }
}
