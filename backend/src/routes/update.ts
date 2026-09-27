/**
 * Update routes.
 *
 *   GET  /api/update/status    what this install is, and what the updater knows
 *   GET  /api/update/check     ask GitHub (or your own manifest) for the newest release (cached)
 *   POST /api/update/install   download, verify, swap — then ask for a restart
 *   POST /api/update/install-file  the same swap, from an archive you already have
 *   GET  /api/update/source    where updates are read from (repo / token / manifest)
 *   POST /api/update/restart   restart now (the files are already in place)
 *   POST /api/update/rollback  put the previous version back
 *   POST /api/update/dismiss   the user has seen the result notice
 *
 * Every one of these is read-only with respect to the data directory: the paths
 * the updater may touch are guarded inside `update/service.ts`, so there is no
 * code path here that can reach the library.
 */
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Runtime } from '../runtime'
import { installKind, appRoot, sourceVersion } from '../build-info'
import { platformKey } from '../update/version'
import {
  checkForUpdate, clearOutcome, downloadInstaller, installFromFile, installUpdate, isBusy, openWithOs,
  rollback, updateStatus,
} from '../update/service'
import { respawn, handleFatalWithPending } from '../update/boot'

const CACHE_MS = 10 * 60 * 1000

export function updateRoutes(rt: Runtime) {
  const app = new Hono()
  /**
   * Where to read releases from. The three source fields live in settings, not
   * in the server's environment, because the person who owns the install is the
   * one who knows whether the repository is private and where their manifest
   * lives. A token is accepted but never logged.
   */
  const sourceOf = (c?: any) => {
    const q = (k: string) => c?.req?.query?.(k) ?? undefined
    const header = (k: string) => c?.req?.header?.(k) ?? undefined
    const repo = q('repo') ?? header('x-re-update-repo') ?? process.env.RE_UPDATE_REPO ?? undefined
    const token = q('token') ?? header('x-re-update-token') ?? process.env.RE_UPDATE_TOKEN ?? undefined
    const manifestUrl = q('manifest') ?? header('x-re-update-manifest') ?? process.env.RE_UPDATE_MANIFEST ?? undefined
    return { repo, token, manifestUrl }
  }

  const depsFor = (c?: any) => ({
    appRoot: appRoot(),
    dataDir: rt.dataDir,
    currentVersion: sourceVersion() || '0.0.0-dev',
    platform: platformKey(),
    kind: installKind(),
    ...sourceOf(c),
    log: (m: string) => console.log(`[re] update: ${m}`),
  })
  const deps = depsFor()

  let cache: { at: number; value: Awaited<ReturnType<typeof checkForUpdate>> } | null = null

  const check = async (force: boolean, d: ReturnType<typeof depsFor>) => {
    const sourceKey = `${d.repo ?? ''}|${d.manifestUrl ?? ''}|${d.token ? 'tok' : ''}`
    if (!force && cache && cache.at && cache.value && Date.now() - cache.at < CACHE_MS && (cache as any).key === sourceKey) {
      return cache.value
    }
    const value = await checkForUpdate(d)
    cache = { at: Date.now(), value, key: sourceKey } as any
    return value
  }

  app.get('/update/status', (c) => {
    const d = depsFor(c)
    return c.json({
      ...updateStatus(d),
      source: {
        kind: d.manifestUrl ? 'manifest' : 'github',
        repo: (d.repo ?? '').trim() || null,
        manifestUrl: d.manifestUrl ?? null,
        token: d.token ? 'set' : 'none',
      },
    })
  })

  app.get('/update/check', async (c) => {
    try {
      const value = await check(c.req.query('force') === '1', depsFor(c))
      return c.json(value)
    } catch (e: any) {
      return c.json({ error: `could not reach GitHub: ${String(e?.message ?? e)}` }, 502)
    }
  })

  app.post('/update/install', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { version?: string }
    if (deps.kind === 'checkout') {
      return c.json({ ok: false, error: 'This is a source checkout — update it with `git pull && npm run build` (or run the packaged build to get in-app updates).' }, 400)
    }
    if (deps.kind === 'desktop') {
      // The desktop app cannot replace files it is running: fetch the installer
      // and hand it to the OS. The library is untouched either way.
      const out = await downloadInstaller(depsFor(c), join(homedir(), 'Downloads'))
      if (!out.ok || !out.file) return c.json({ ok: false, error: out.error ?? 'could not download the installer' }, 502)
      const opened = openWithOs(out.file)
      return c.json({ ok: true, kind: 'desktop', file: out.file, opened, message: opened ? 'Installer downloaded and opened — finish the install and your library will be waiting.' : `Installer saved to ${out.file} — open it to finish updating.` })
    }
    if (isBusy()) return c.json({ ok: false, error: 'an update is already running' }, 409)
    const d = depsFor(c)
    const out = await installUpdate(d, { version: body.version })
    if (!out.ok) return c.json({ ok: false, error: out.error, status: updateStatus(d) }, 502)
    return c.json({ ok: true, pending: out.pending, restartRequired: true, status: updateStatus(d) })
  })

  /**
   * Install an archive the user already has. The body is the raw file (no
   * multipart parser needed — there is exactly one part), the name travels in a
   * header, and the checksum can travel with it: `x-re-sums` takes the
   * SHA256SUMS text, so this works on a machine with no route to GitHub at all.
   */
  app.post('/update/install-file', async (c) => {
    const d = depsFor(c)
    const name = c.req.header('x-re-file-name') ?? c.req.query('name') ?? ''
    const sumsText = c.req.header('x-re-sums') ?? undefined
    if (!name) return c.json({ ok: false, error: 'no file name — send it in x-re-file-name' }, 400)
    const buf = Buffer.from(await c.req.arrayBuffer())
    if (!buf.length) return c.json({ ok: false, error: 'the upload was empty' }, 400)
    const out = await installFromFile(d, { name, buffer: buf }, { version: c.req.query('version') ?? undefined, sumsText })
    if (!out.ok) return c.json({ ok: false, error: out.error, status: updateStatus(d) }, 502)
    return c.json({ ok: true, pending: out.pending, restartRequired: true, status: updateStatus(d) })
  })

  app.post('/update/restart', (c) => {
    const pending = updateStatus(depsFor(c)).pending
    if (!pending) return c.json({ ok: false, error: 'no update is waiting to be started' }, 400)
    setTimeout(() => {
      const restarted = respawn(deps)
      // Graceful exit: the preview manager is stopped by the exit hook in index.ts.
      setTimeout(() => process.exit(restarted ? 0 : 1), 150)
    }, 250)
    return c.json({ ok: true, restarting: true })
  })

  app.post('/update/rollback', (c) => {
    try {
      const outcome = rollback(depsFor(c), 'rolled back from Settings → Updates')
      return c.json({ ok: true, outcome, restartRequired: true })
    } catch (e: any) {
      return c.json({ ok: false, error: String(e?.message ?? e) }, 400)
    }
  })

  app.post('/update/dismiss', (c) => {
    clearOutcome(deps)
    return c.json({ ok: true })
  })

  /** A failed boot of a new version, reported by the tiny watchdog process. */
  app.post('/update/fatal-report', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { error?: string }
    const handled = handleFatalWithPending(deps, new Error(body.error ?? 'unknown boot failure'))
    return c.json({ handled })
  })

  return app
}

/** Does this install have a folder the updater could swap? (Used by the UI copy.) */
export function hasAppFolder(): boolean {
  const root = appRoot()
  return !!root && existsSync(join(root, 'server'))
}
