# 8. Data and persistence

Research Engine keeps data in three places. Knowing which holds what is the
first thing to learn before changing anything that stores data.

| Place | What is in it | Lifetime |
|---|---|---|
| **Browser `localStorage`** | Chats, settings, skills, bots, routines, providers (keys in the vault), the Flow cache, lock configuration, UI memory | Until cleared, per browser profile and per origin |
| **Browser IndexedDB** | Meeting recordings and transcripts (`re.meetings`) | Until deleted |
| **Server (the backend)** | Documents, feedback, library items and folders (SQLite), connector files, the agent download ledger, the updater's state | Until deleted, in the data directory |

Chat history is in the browser, not in the server database. `db.insertChat` exists
on the server, but nothing calls it. That is listed in [known issues](14-known-issues.md).

## The browser stores

### Zustand and the main store

`frontend/src/stores/useStore.ts` persists under the key `research-engine-v1`,
inside a namespace. The namespace is set by `lib/security/lock.ts`:

- `re.data.main`: your data.
- `re.data.guest`: a guest session's data. It is kept separate so a guest's
  chats are never mixed with the owner's, and the Shell shows a strip whenever a
  guest session is active.

Writes are batched by `lib/storage/deferredJson.ts` to at most one per 400 ms,
and flushed when the page hides or unloads (see
[frontend: persistence](05-frontend.md#persistence-rules)).

Schema changes are handled by the merge in `useStore`: fields that are missing
from older saved data get their defaults.

### Other `re.*` keys

Each feature owns its keys. The full list is in the code; the important ones:

| Key | Owner | Holds |
|---|---|---|
| `re.bots.v1` | `lib/bots/store.ts` | Bots, rooms, projects |
| `re.design.hub` | `stores/useDesign.ts` | Design boards and briefs |
| `re.exam.v1` | `stores/useExam.ts` | Exam state |
| `re.flow.cache` | `lib/flow/cache.ts` | The last 120 answers |
| `re.vault.salt` | `lib/crypto/vault.ts` | The salt for the key vault (not a secret) |
| `re.lock.config` | `lib/security/lock.ts` | Lock settings and the hashes of the codes, never the codes |
| `re.feedback.local` | feedback | Feedback you wrote in the browser |

## The vault

API keys are encrypted before they are saved:

- The key is derived from your passphrase with **PBKDF2 (SHA-256, 150,000
  iterations)** and encrypted with **AES-GCM 256**. The code is in
  `frontend/src/lib/crypto/vault.ts`.
- **The passphrase lives in memory only** (`lib/crypto/session.ts`). It is never
  written to storage. After a reload you enter it again.
- Without a passphrase, keys stay in `localStorage` in plain form, and the app
  warns you clearly. This is the weaker mode, and the warning exists for that
  reason.
- Keys are sent to the server per request (see
  [security](09-security-and-privacy.md)). The server does not keep them.

## The server database

SQLite, file `./research-engine.db` by default. The path comes from `DB_PATH`
(`backend/src/db/index.ts`). The engine is picked at startup:

1. `better-sqlite3`, an optional dependency.
2. `node:sqlite`, if the Node version has it.
3. In memory, if neither works. Data is lost on restart, and `/api/health` reports
   `db.engine: "memory"` so you can see it.

Both SQLite paths use WAL journal mode. The schema is in `backend/src/db/schema.ts`. Tables that the server
writes: `documents`, `feedback`, `library_items` and `library_folders`. The schema
also defines `chats`, `messages`, `skills` and `citations`, but no current route
writes them, so they are not part of your data today. `snapshotDatabase()` in
`db/index.ts` copies the database file.

## The data directory

The data directory is `~/.research-engine` unless you set `RESEARCH_ENGINE_DATA_DIR`
or the runtime's `--data-dir` flag (see [backend](04-backend.md#data-directory)).
It holds the server database (when `DB_PATH` is relative), connector files under
`connectors/`, the download ledger `agent-downloads.json`, and the updater's
`.update` folder.

> `routes/personas.ts` and `routes/skills.ts` read `RE_DATA_DIR`, not
> `RESEARCH_ENGINE_DATA_DIR`. A setting that changes only one of them splits the
> data. See [known issues](14-known-issues.md).

## Deleting data

- **Wipe** (`POST /api/data/wipe`) removes the server-side data. It is also the
  effect of the duress code described in [security](09-security-and-privacy.md#the-startup-lock).
  The route has no authentication. It is safe only while the server listens on
  loopback, which is the default.

## Backups and export

- Bots, rooms and projects export as one file (format `research-engine.bots`),
  with ids remapped on import (`lib/bots/logic.ts`, `makeBundle`/`readBundle`).
- Settings → Data holds the export and the data-directory tools (`components/settings/DataTab.tsx`).
- A full backup is a copy of the data directory with the server stopped, plus an
  export of the browser data from Settings → Data.
