// Filesystem nodes for Workflows: read/write files inside <dataDir>/files only.
// Every path is resolved and checked against the sandbox root — traversal is rejected.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Hono } from 'hono'
import type { Runtime } from '../runtime'

export function fsRoutes(rt: Runtime) {
  const r = new Hono()
  const root = resolve(join(rt.dataDir, 'files'))

  const safePath = (rel: string): string | null => {
    if (!rel || rel.startsWith('/') || rel.includes('..')) return null
    const abs = resolve(join(root, rel))
    return abs.startsWith(root + '/') || abs === root ? abs : null
  }

  r.get('/fs/read', async (c) => {
    const rel = c.req.query('path') ?? ''
    const abs = safePath(rel)
    if (!abs) return c.text('Path must stay inside the Research Engine files folder.', 400)
    try {
      return c.text(await readFile(abs, 'utf8'))
    } catch {
      return c.text('File not found.', 404)
    }
  })

  r.post('/fs/write', async (c) => {
    let body: { path?: string; content?: string }
    try { body = await c.req.json() } catch { return c.text('Invalid JSON body.', 400) }
    const abs = safePath(body.path ?? '')
    if (!abs) return c.text('Path must stay inside the Research Engine files folder.', 400)
    if (typeof body.content !== 'string') return c.text('Missing content.', 400)
    if (body.content.length > 2_000_000) return c.text('Content too large (2 MB limit).', 413)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, body.content, 'utf8')
    return c.json({ ok: true, path: body.path })
  })

  return r
}
