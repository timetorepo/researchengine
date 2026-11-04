// Headless browsing with Lightpanda (https://lightpanda.io), a small browser
// written for automation and AI agents. It is optional: when the binary is not
// installed, the reader falls back to plain HTTP, and the status endpoint says
// how to install it.
//
// Lookup order for the binary:
//   1. LIGHTPANDA_BIN (an explicit path, for packaged builds and tests)
//   2. `lightpanda` on the PATH
//   3. <data dir>/bin/lightpanda, where scripts/install-lightpanda.mjs puts it
//
// The page is rendered by Lightpanda's own JavaScript engine and returned as
// Markdown. Only public http(s) addresses are opened (the same guard the reader
// uses), and the command is run without a shell.
import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { parseTarget } from './reader/extract'

export const LIGHTPANDA_TIMEOUT_MS = 30_000
export const LIGHTPANDA_MAX_CHARS = 60_000

export interface BrowseResult {
  via: 'lightpanda'
  url: string
  text: string
  truncated: boolean
}

export type BrowseOutcome = { ok: true; result: BrowseResult } | { ok: false; status: number; error: string }

/** Where the installer puts the binary, next to the local database. */
export function lightpandaInstallDir(): string {
  const dbPath = process.env.DB_PATH ?? './research-engine.db'
  const base = dirname(dbPath) === '.' ? join(homedir(), '.local', 'share', 'research-engine') : dirname(dbPath)
  return join(base, 'bin')
}

function isExecutableFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

/** The first Lightpanda binary we can find, or null. */
export function findLightpanda(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.LIGHTPANDA_BIN?.trim()
  if (explicit) return isExecutableFile(explicit) ? explicit : null
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, process.platform === 'win32' ? 'lightpanda.exe' : 'lightpanda')
    if (isExecutableFile(candidate)) return candidate
  }
  const local = join(lightpandaInstallDir(), process.platform === 'win32' ? 'lightpanda.exe' : 'lightpanda')
  return isExecutableFile(local) ? local : null
}

/** Trims the Markdown to a size an agent can use, and says whether it was cut. */
export function clampText(text: string, max = LIGHTPANDA_MAX_CHARS): { text: string; truncated: boolean } {
  const trimmed = text.trim()
  if (trimmed.length <= max) return { text: trimmed, truncated: false }
  return { text: trimmed.slice(0, max), truncated: true }
}

/** Opens one public page in Lightpanda and returns its Markdown. */
export function browseWithLightpanda(raw: string, env: NodeJS.ProcessEnv = process.env): Promise<BrowseOutcome> {
  const target = parseTarget(raw)
  if (!target) return Promise.resolve({ ok: false, status: 400, error: 'Only public http:// or https:// addresses can be opened.' })
  const bin = findLightpanda(env)
  if (!bin) {
    return Promise.resolve({
      ok: false,
      status: 503,
      error: 'Lightpanda is not installed. Run `node backend/scripts/install-lightpanda.mjs` once, or set LIGHTPANDA_BIN to its path.',
    })
  }
  return new Promise((resolve) => {
    execFile(
      bin,
      ['fetch', target.toString(), '--dump', 'markdown', '--http-timeout', String(LIGHTPANDA_TIMEOUT_MS)],
      { timeout: LIGHTPANDA_TIMEOUT_MS + 5_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const detail = String(stderr || err.message || '').split('\n').find((l) => l.includes('err=') || l.includes('Reason:')) ?? ''
          resolve({ ok: false, status: 502, error: `Lightpanda could not open the page${detail ? ` (${detail.trim().slice(0, 160)})` : ''}.` })
          return
        }
        const { text, truncated } = clampText(String(stdout))
        if (!text) {
          resolve({ ok: false, status: 502, error: 'The page rendered with no readable text.' })
          return
        }
        resolve({ ok: true, result: { via: 'lightpanda', url: target.toString(), text, truncated } })
      },
    )
  })
}

/** Whether Lightpanda is available, and where. Used by the status endpoint. */
export function lightpandaStatus(env: NodeJS.ProcessEnv = process.env): { installed: boolean; path: string | null; installDir: string } {
  const path = findLightpanda(env)
  return { installed: path !== null, path, installDir: lightpandaInstallDir() }
}
