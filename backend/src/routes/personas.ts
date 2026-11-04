import { Hono } from 'hono'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { homedir } from 'node:os'

/**
 * The persona archive, mirrored onto this machine. The frontend manifest names
 * every prompt; the mirror turns each name into full text. Sync runs here, on
 * the machine the app runs on, so the archive lands in the app's own data folder.
 */
export const personaRoutes = new Hono()

const x = promisify(execFile)
const UPSTREAM = 'https://github.com/asgeirtj/system_prompts_leaks.git'
let syncing = false

const baseDir = () => process.env.RE_DATA_DIR || join(homedir(), '.research-engine')
const mirrorDir = () => join(baseDir(), 'personas-upstream')

function countMd(dir: string): number {
  let n = 0
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) n++
    }
  }
  try { walk(dir) } catch { /* unreadable: report what we can */ }
  return n
}

personaRoutes.get('/local', (c) => {
  const dir = mirrorDir()
  if (!existsSync(dir)) return c.json({ present: false, count: 0 })
  return c.json({ present: true, count: countMd(dir) })
})

/**
 * Mirror the full archive. The URL is fixed here; nothing from the request
 * reaches git. The clone is shallow and replaces the previous mirror only once
 * the new one is complete.
 */
personaRoutes.post('/sync', async (c) => {
  if (syncing) return c.json({ ok: false, error: 'A sync is already running.' }, 409)
  syncing = true
  const dir = mirrorDir()
  const tmp = `${dir}.new`
  try {
    await mkdir(baseDir(), { recursive: true })
    await rm(tmp, { recursive: true, force: true })
    await x('git', ['clone', '--depth=1', '--quiet', UPSTREAM, tmp], { timeout: 240_000, maxBuffer: 1024 * 1024 })
    await rm(join(tmp, '.git'), { recursive: true, force: true })
    await rm(dir, { recursive: true, force: true })
    await rename(tmp, dir)
    return c.json({ ok: true, count: countMd(dir) })
  } catch (e: any) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
    const why = String(e?.stderr || e?.message || 'sync failed').split('\n').filter(Boolean).pop() ?? 'sync failed'
    return c.json({ ok: false, error: why.slice(0, 200) }, 502)
  } finally {
    syncing = false
  }
})

personaRoutes.get('/text', (c) => {
  const rel = String(c.req.query('path') ?? '')
  if (!rel || rel.includes('..') || !rel.endsWith('.md')) return c.json({ error: 'bad path' }, 400)
  const root = normalize(mirrorDir())
  const abs = normalize(join(root, rel))
  if (!abs.startsWith(root)) return c.json({ error: 'bad path' }, 400)
  if (!existsSync(abs)) return c.json({ error: 'Not on this machine yet. Sync the full archive first.' }, 404)
  const text = readFileSync(abs, 'utf8')
  return c.json({ path: rel, chars: text.length, text: text.slice(0, 200000), truncated: statSync(abs).size > 200000 })
})
