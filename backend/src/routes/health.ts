import { Hono } from 'hono'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbStats } from '../db'

/** The repository root, when this build is running from a source checkout. */
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
}

let cache: { at: number; value: WebBuild | null } | null = null
export interface WebBuild { version: string; buildId: string; builtAt: string }

/**
 * What the server is actually serving, read from the `build-info.json` the Vite
 * build writes next to index.html. A copy built before the last `git pull`
 * reports an older version here than the source tree does — which is exactly how
 * a stale self-hosted install gives itself away (see Settings → About).
 *
 * The dist folder is passed in from the runtime, so this works both from a
 * checkout and from a portable build where the frontend sits beside the server.
 */
export function webBuild(distDir?: string | null): WebBuild | null {
  const dir = distDir ?? join(repoRoot(), 'frontend', 'dist')
  const file = join(dir, 'build-info.json')
  try {
    if (!existsSync(file)) return null
    const mtime = statSync(file).mtimeMs
    if (cache && cache.at === mtime) return cache.value
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as WebBuild
    const value = { version: String(parsed.version ?? ''), buildId: String(parsed.buildId ?? ''), builtAt: String(parsed.builtAt ?? '') }
    cache = { at: mtime, value }
    return value
  } catch {
    cache = { at: -1, value: null }
    return null
  }
}

/**
 * Is this a source checkout or a portable folder? It decides which instruction
 * the UI gives for getting onto a newer build.
 */
export function installMode(): 'checkout' | 'portable' {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8')) as { name?: string }
    return pkg.name === 'research-engine-server' ? 'portable' : 'checkout'
  } catch {
    return 'checkout'
  }
}

/** The version declared by the code that is running. */
export function sourceVersion(): string {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), 'package.json'), // portable build: <dir>/server/package.json
    join(repoRoot(), 'package.json'),                              // source checkout
  ]
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string }
      if (pkg.version && (pkg.name === 'research-engine' || pkg.name === 'research-engine-server')) return pkg.version
    } catch { /* try the next candidate */ }
  }
  return ''
}

export function healthRoutes(frontendDist?: string | null) {
  const app = new Hono()
  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'research-engine-backend',
      time: new Date().toISOString(),
      db: dbStats(),
      // Frontend fingerprint, so the UI can warn about a stale self-hosted copy.
      web: { served: webBuild(frontendDist), source: sourceVersion(), mode: installMode() },
    }),
  )
  return app
}
