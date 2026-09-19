// Build fingerprint — what version of the frontend is actually on disk, and
// what version the running code claims to be.
//
// This module deliberately imports nothing but node builtins: the server
// resolves its runtime (and therefore DB_PATH) before loading anything with
// side effects, and it must stay safe to read the fingerprint at any point.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface WebBuild { version: string; buildId: string; builtAt: string }

/** This file's own directory (backend/src in a checkout, <dir>/server packaged). */
function moduleDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

/** The repository root, when this build is running from a source checkout. */
function repoRoot(): string {
  return join(moduleDir(), '..', '..')
}

/**
 * Where the built frontend lives when nobody told us: beside a portable build's
 * server folder, or in the frontend workspace of a checkout.
 */
export function resolveDistDir(): string | null {
  const candidates = [
    join(moduleDir(), '..', 'frontend-dist'),   // portable: <dir>/server → <dir>/frontend-dist
    join(repoRoot(), 'frontend', 'dist'),       // checkout: <repo>/frontend/dist
  ]
  return candidates.find((d) => existsSync(join(d, 'index.html'))) ?? null
}

let cache: { at: number; value: WebBuild | null } | null = null

/**
 * What the server is actually serving, read from the `build-info.json` the Vite
 * build writes next to index.html. A copy built before the last `git pull`
 * reports an older version here than the source tree does — which is exactly how
 * a stale self-hosted install gives itself away (Settings → About, /api/health,
 * and the version banner at startup all read this).
 */
export function webBuild(distDir?: string | null): WebBuild | null {
  const dir = distDir ?? resolveDistDir() ?? join(repoRoot(), 'frontend', 'dist')
  const file = join(dir, 'build-info.json')
  try {
    if (!existsSync(file)) return null
    const mtime = statSync(file).mtimeMs
    if (cache && cache.at === mtime) return cache.value
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as WebBuild
    const value = {
      version: String(parsed.version ?? ''),
      buildId: String(parsed.buildId ?? ''),
      builtAt: String(parsed.builtAt ?? ''),
    }
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
    const pkg = JSON.parse(readFileSync(join(moduleDir(), 'package.json'), 'utf8')) as { name?: string }
    return pkg.name === 'research-engine-server' ? 'portable' : 'checkout'
  } catch {
    return 'checkout'
  }
}

/** The version declared by the code that is running. */
export function sourceVersion(): string {
  const candidates = [
    join(moduleDir(), 'package.json'), // portable build: <dir>/server/package.json
    join(repoRoot(), 'package.json'),  // source checkout: <repo>/package.json
  ]
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string }
      if (pkg.version && (pkg.name === 'research-engine' || pkg.name === 'research-engine-server')) return pkg.version
    } catch { /* try the next candidate */ }
  }
  return ''
}

/**
 * A one-screen answer to "which build am I running?" for the terminal:
 *
 *   research-engine version
 */
export function buildInfoReport(frontendDist?: string | null): string {
  const served = webBuild(frontendDist)
  const source = sourceVersion()
  const mode = installMode()
  const lines = [
    `Research Engine ${source || '(unknown version)'}  [${mode}]`,
    served
      ? `  built frontend : ${served.version} (${served.builtAt})`
      : '  built frontend : not found — run `npm run build` in frontend/ (or unpack a release archive)',
  ]
  if (served && source && served.version !== source) {
    lines.push(
      `  STATUS         : STALE — the served build is ${served.version} but this code is ${source}`,
      mode === 'checkout'
        ? '                   fix: npm run build   (then restart the server)'
        : '                   fix: unpack the current release archive over this folder',
      '                   or press "Clear cache & reload" on Settings → About if the page itself is cached',
    )
  } else if (served) {
    lines.push('  STATUS         : up to date')
  }
  return lines.join('\n')
}
