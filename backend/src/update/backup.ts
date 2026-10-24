/**
 * The safety copy taken before any update.
 *
 * An update replaces the program, never the data directory: the library, the
 * projects and the chats stay where they are. A copy is still taken first,
 * because a migration that goes wrong is the one way to lose data, and because
 * a copy costs little next to a library that cannot be rebuilt.
 *
 * Each backup is a folder under `<dataDir>/backups/` holding a consistent copy
 * of the database (`db.sqlite`), the runtime config, and a manifest. The newest
 * `KEEP` backups are kept; older ones are removed.
 *
 * If the copy cannot be made, the update does not start. That is deliberate:
 * an update that cannot be undone must not run without a way back.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { snapshotDatabase } from '../db'

export const KEEP = 5

export interface BackupResult {
  ok: boolean
  dir?: string
  database?: 'copied' | 'none'
  error?: string
}

export function backupsDir(dataDir: string): string {
  return join(dataDir, 'backups')
}

/** Copies the library before an update from `fromVersion` to `toVersion`. */
export function backupBeforeUpdate(dataDir: string, fromVersion: string, toVersion?: string): BackupResult {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeFrom = fromVersion.replace(/[^0-9A-Za-z.+-]/g, '_')
  const dir = join(backupsDir(dataDir), `pre-update-${safeFrom}-${stamp}`)
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    return { ok: false, error: `could not create the backup folder (${(e as Error).message})` }
  }

  let database: 'copied' | 'none' = 'none'
  const snap = snapshotDatabase(join(dir, 'db.sqlite'))
  if (snap.ok) {
    database = 'copied'
  } else if (snap.engine !== 'memory') {
    // A real database that could not be copied is a reason to stop.
    rmSync(dir, { recursive: true, force: true })
    return { ok: false, error: `the database could not be copied (${snap.error ?? 'unknown error'})` }
  }

  const config = join(dataDir, 'config.json')
  if (existsSync(config)) copyFileSync(config, join(dir, 'config.json'))

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    kind: 'pre-update-backup',
    fromVersion,
    toVersion: toVersion ?? null,
    createdAt: new Date().toISOString(),
    database,
    files: ['db.sqlite', 'config.json', 'manifest.json'].filter((f) => existsSync(join(dir, f))),
    restore: 'Stop Research Engine, then copy db.sqlite (and config.json) back into the data folder. Keep the -wal and -shm files out of it.',
  }, null, 2) + '\n')

  pruneBackups(dataDir)
  return { ok: true, dir, database }
}

/** Newest first; keeps `KEEP`, removes the rest. Never touches anything outside `backups/`. */
export function pruneBackups(dataDir: string): string[] {
  const root = backupsDir(dataDir)
  if (!existsSync(root)) return []
  const dirs = readdirSync(root)
    .filter((n) => n.startsWith('pre-update-'))
    .map((n) => join(root, n))
    .filter((p) => { try { return statSync(p).isDirectory() } catch { return false } })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  const removed: string[] = []
  for (const old of dirs.slice(KEEP)) {
    rmSync(old, { recursive: true, force: true })
    removed.push(old)
  }
  return removed
}
