import { Hono } from 'hono'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { homedir } from 'node:os'

/**
 * Serves the full persona mirror that scripts/sync-personas.mjs creates on a
 * connected machine. The frontend manifest drives browsing; these routes turn
 * "not vendored" rows into readable text once the mirror exists.
 */
export const personaRoutes = new Hono()

const mirrorDir = () =>
  join(process.env.RE_DATA_DIR || join(homedir(), '.research-engine'), 'personas-upstream')

personaRoutes.get('/local', (c) => {
  const dir = mirrorDir()
  if (!existsSync(dir)) return c.json({ present: false, count: 0 })
  let count = 0
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) count++
    }
  }
  try { walk(dir) } catch { return c.json({ present: true, count: 0 }) }
  return c.json({ present: true, count })
})

personaRoutes.get('/text', (c) => {
  const rel = String(c.req.query('path') ?? '')
  if (!rel || rel.includes('..') || !rel.endsWith('.md')) return c.json({ error: 'bad path' }, 400)
  const abs = normalize(join(mirrorDir(), rel))
  if (!abs.startsWith(normalize(mirrorDir()))) return c.json({ error: 'bad path' }, 400)
  if (!existsSync(abs)) return c.json({ error: 'not synced yet — run: node scripts/sync-personas.mjs' }, 404)
  const text = readFileSync(abs, 'utf8')
  return c.json({ path: rel, chars: text.length, text: text.slice(0, 200000), truncated: statSync(abs).size > 200000 })
})
