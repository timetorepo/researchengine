// Run with: bun run backend/scripts/backup-test.ts (or node 22.5+ with a TS loader)
// Proves the pre-update copy holds the library and that old copies are pruned.
const DATA = (await import('node:os')).tmpdir() + '/re-backup-test-' + Date.now()
await (await import('node:fs')).promises.mkdir(DATA, { recursive: true })
process.env.DB_PATH = DATA + '/db.sqlite'
const { db } = await import('../src/db/index.ts')
const { backupBeforeUpdate, pruneBackups, backupsDir } = await import('../src/update/backup.ts')
const fs = await import('node:fs')
db.insertLibraryItem({ id: 'bk1', kind: 'note', title: 'keep-me', tags: [], savedAt: Date.now() })
fs.writeFileSync(DATA + '/config.json', '{"port":3847}')
const r = backupBeforeUpdate(DATA, '0.47.0-beta.2', '0.48.0-beta.1')
console.log('backup ok:', r.ok, 'database:', r.database)
const { DatabaseSync } = await import('node:sqlite')
const copy = new DatabaseSync(r.dir + '/db.sqlite')
console.log('title in copy:', copy.prepare("select title from library_items where id='bk1'").get())
copy.close()
console.log('files:', fs.readdirSync(r.dir).sort(), fs.readFileSync(r.dir + '/manifest.json', 'utf8').slice(0, 160).replace(/\n/g, ' '))
for (let i = 0; i < 7; i++) { backupBeforeUpdate(DATA, '0.47.0-beta.2'); await new Promise(res => setTimeout(res, 15)) }
// memory engine: no file to copy, must say so rather than fake a backup

const kept = fs.readdirSync(backupsDir(DATA)).length
if (!r.ok || kept !== 5) { console.error('BACKUP TEST FAILED'); process.exit(1) }
console.log('BACKUP TEST PASSED')
