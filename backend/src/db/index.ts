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
CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, kind TEXT, text TEXT, contact TEXT, app_version TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS library_items (id TEXT PRIMARY KEY, kind TEXT, title TEXT, url TEXT, snippet TEXT, tags TEXT, folder_id TEXT, saved_at INTEGER, extra TEXT);
CREATE TABLE IF NOT EXISTS library_folders (id TEXT PRIMARY KEY, name TEXT, created_at INTEGER, color TEXT);
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

// Databases created before a column existed keep working: add it, and let a
// duplicate-column error mean it is already there.
if (sqlite) {
  try { sqlite.exec('ALTER TABLE library_folders ADD COLUMN color TEXT') } catch { /* already migrated */ }
}

const mem = {
  chats: new Map<string, any>(),
  documents: new Map<string, any>(),
  feedback: new Map<string, any>(),
  libraryItems: new Map<string, any>(),
  libraryFolders: new Map<string, any>(),
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

  /* ---------------------------------------------------------- feedback ---- */
  // Kept on the user's own machine, in the same database as everything else:
  // "send feedback" here means "write it down", not "post it somewhere".
  insertFeedback(f: any) {
    if (sqlite) sqlite.prepare('INSERT OR REPLACE INTO feedback VALUES (?,?,?,?,?,?)').run(f.id, f.kind, f.text, f.contact ?? null, f.appVersion ?? null, f.createdAt)
    else mem.feedback.set(f.id, f)
  },
  listFeedback() {
    if (sqlite) return sqlite.prepare('SELECT id, kind, text, contact, app_version as appVersion, created_at as createdAt FROM feedback ORDER BY created_at DESC').all()
    return [...mem.feedback.values()].sort((a, b) => b.createdAt - a.createdAt)
  },
  deleteFeedback(id: string) {
    if (sqlite) sqlite.prepare('DELETE FROM feedback WHERE id = ?').run(id)
    else mem.feedback.delete(id)
  },

  /* ----------------------------------------------------- library items --- */
  insertLibraryItem(it: any) {
    if (sqlite) sqlite.prepare('INSERT OR REPLACE INTO library_items VALUES (?,?,?,?,?,?,?,?,?)').run(
      it.id, it.kind, it.title, it.url ?? null, it.snippet ?? null, JSON.stringify(it.tags ?? []), it.folderId ?? null, it.savedAt, JSON.stringify(it.extra ?? null))
    else mem.libraryItems.set(it.id, it)
  },
  listLibraryItems() {
    const rows = sqlite
      ? sqlite.prepare('SELECT id, kind, title, url, snippet, tags, folder_id as folderId, saved_at as savedAt, extra FROM library_items ORDER BY saved_at DESC').all()
      : [...mem.libraryItems.values()].sort((a, b) => b.savedAt - a.savedAt)
    return (rows as any[]).map((r) => ({
      ...r,
      tags: typeof r.tags === 'string' ? safeJson(r.tags, []) : (r.tags ?? []),
      extra: typeof r.extra === 'string' ? safeJson(r.extra, null) : (r.extra ?? null),
    }))
  },
  deleteLibraryItem(id: string) {
    if (sqlite) sqlite.prepare('DELETE FROM library_items WHERE id = ?').run(id)
    else mem.libraryItems.delete(id)
  },
  insertLibraryFolder(f: any) {
    if (sqlite) sqlite.prepare('INSERT OR REPLACE INTO library_folders VALUES (?,?,?,?)').run(f.id, f.name, f.createdAt, f.color ?? null)
    else mem.libraryFolders.set(f.id, f)
  },
  updateLibraryFolder(id: string, patch: { name?: string; color?: string | null }) {
    if (sqlite) {
      const row: any = sqlite.prepare('SELECT id, name, color FROM library_folders WHERE id = ?').get(id)
      if (!row) return null
      const next = { name: patch.name ?? row.name, color: patch.color === undefined ? row.color : patch.color }
      sqlite.prepare('UPDATE library_folders SET name = ?, color = ? WHERE id = ?').run(next.name, next.color, id)
      return next
    }
    const f = mem.libraryFolders.get(id)
    if (!f) return null
    if (patch.name !== undefined) f.name = patch.name
    if (patch.color !== undefined) f.color = patch.color
    return f
  },
  listLibraryFolders() {
    if (sqlite) return sqlite.prepare('SELECT id, name, created_at as createdAt, color FROM library_folders ORDER BY created_at ASC').all()
    return [...mem.libraryFolders.values()]
  },
  deleteLibraryFolder(id: string) {
    if (sqlite) {
      sqlite.prepare('DELETE FROM library_folders WHERE id = ?').run(id)
      sqlite.prepare('UPDATE library_items SET folder_id = NULL WHERE folder_id = ?').run(id)
    } else mem.libraryFolders.delete(id)
  },
}

function safeJson<T>(text: string, fallback: T): T {
  try { return JSON.parse(text) as T } catch { return fallback }
}

export function dbStats() {
  return sqlite ? { engine, file: process.env.DB_PATH ?? './research-engine.db' } : { engine: 'memory' }
}
