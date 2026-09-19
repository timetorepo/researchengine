// SQLite persistence with graceful degradation:
//   1. better-sqlite3 (native, fastest) when it is installed
//   2. node:sqlite — built into Node 22.5+ / 20.19+, zero native modules,
//      which keeps portable builds persistent on Windows/macOS/Linux alike
//   3. in-memory store, so the backend still runs everywhere else
import * as schema from './schema'

const MIGRATION = `
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT, space_id TEXT, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, model TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT, kind TEXT, text TEXT, added_at INTEGER);
CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, title TEXT, url TEXT, collection TEXT, saved_at INTEGER);
`

let sqlite: any = null
let engine = 'memory'
const dbPath = process.env.DB_PATH ?? './research-engine.db'

try {
  // Indirection keeps this truly optional: TypeScript must not require the
  // native module to exist (it is an optionalDependency and may fail to build).
  const specifier: string = 'better-sqlite3'
  const Database = (await import(specifier)).default
  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(MIGRATION)
  engine = 'sqlite (better-sqlite3)'
} catch {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    sqlite = new DatabaseSync(dbPath)
    sqlite.exec('PRAGMA journal_mode = WAL')
    sqlite.exec(MIGRATION)
    engine = 'sqlite (node:sqlite)'
  } catch (e2) {
    console.warn('[re] no SQLite driver available — using in-memory fallback (data will not survive a restart). (' + (e2 as Error).message + ')')
  }
}

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
  return sqlite ? { engine, file: process.env.DB_PATH ?? './research-engine.db' } : { engine: 'memory' }
}
