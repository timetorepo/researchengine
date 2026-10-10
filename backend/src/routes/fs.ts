// Filesystem nodes for Workflows: read/write files inside <dataDir>/files only.
// Every path is resolved and checked against the sandbox root — traversal is rejected.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Hono } from 'hono'
import { isWithinDir } from '../preview/paths'
import type { Runtime } from '../runtime'

export function fsRoutes(rt: Runtime) {
  const r = new Hono()
  const root = resolve(join(rt.dataDir, 'files'))

  const safePath = (rel: string): string | null => {
    if (!rel || rel.startsWith('/') || rel.includes('..')) return null
    const abs = resolve(join(root, rel))
    return isWithinDir(root, abs) ? abs : null
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

  // Binary read — PDF/DOCX/image bytes so the browser can hand them to the
  // extraction pipeline as a File object.
  r.get('/fs/read-bin', async (c) => {
    const rel = c.req.query('path') ?? ''
    const abs = safePath(rel)
    if (!abs) return c.text('Path must stay inside the Research Engine files folder.', 400)
    try {
      const buf = await readFile(abs)
      const ext = abs.toLowerCase()
      const type = ext.endsWith('.pdf') ? 'application/pdf'
        : ext.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream'
      return c.body(new Uint8Array(buf), 200, { 'content-type': type })
    } catch {
      return c.text('File not found.', 404)
    }
  })

  // ---- Local files integration: list & upload into the sandbox folder ----
  r.get('/fs/list', async (c) => {
    await mkdir(root, { recursive: true })
    let entries: { name: string; dir: boolean; size: number }[] = []
    try {
      const list = await readdir(root, { withFileTypes: true })
      entries = await Promise.all(list.map(async (e) => {
        if (e.name.startsWith('.')) return null
        const dir = e.isDirectory()
        let size = 0
        if (!dir) { try { size = (await stat(join(root, e.name))).size } catch { /* ignore */ } }
        return { name: e.name, dir, size }
      })).then((a) => (a.filter(Boolean) as typeof entries))
      entries.sort((x, y) => Number(y.dir) - Number(x.dir) || x.name.localeCompare(y.name))
    } catch { /* empty */ }
    return c.json({ root, files: entries })
  })

  // Accepts base64 so any file type (PDF, DOCX, images…) can be stored,
  // not just text. Size capped at 8 MB to keep the sandbox bounded.
  r.post('/fs/upload', async (c) => {
    let body: { name?: string; dataBase64?: string }
    try { body = await c.req.json() } catch { return c.text('Invalid JSON body.', 400) }
    const name = (body.name ?? '').replace(/[\\/]/g, '_').trim()
    if (!name || name.startsWith('.')) return c.text('Missing file name.', 400)
    if (typeof body.dataBase64 !== 'string') return c.text('Missing dataBase64.', 400)
    const buf = Buffer.from(body.dataBase64, 'base64')
    if (buf.length > 8 * 1024 * 1024) return c.text('File too large (8 MB limit).', 413)
    const abs = safePath(name)
    if (!abs) return c.text('File name must stay inside the Research Engine files folder.', 400)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, buf)
    return c.json({ ok: true, path: name, size: buf.length })
  })

  return r
}
