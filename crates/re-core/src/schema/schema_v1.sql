-- Research Engine library schema, v1.
-- SHARED SOURCE OF TRUTH between the desktop Node backend and the mobile Rust
-- core. The statement lines below must match the MIGRATION template literal in
-- backend/src/db/index.ts line-for-line (normalized); a drift test enforces it:
--   node --experimental-strip-types packages/tokens/test/tokens.test.mts
-- Mobile R2 extends this file (fts5 indexes, jobs, highlights, quiz records);
-- any extension ships as schema_v2.sql plus a migration runner on both sides.
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT, space_id TEXT, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, model TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT, kind TEXT, text TEXT, added_at INTEGER);
CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, title TEXT, url TEXT, collection TEXT, saved_at INTEGER);
