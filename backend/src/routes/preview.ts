// Preview endpoints: start / stop / restart the project's own dev server and
// report its state to the IDE. The heavy lifting lives in preview/manager.ts.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import { PreviewManager, injectBridge, MIME } from '../preview/manager'
import { projectDirOf, projectsRootOf } from '../preview/paths'
import { existsSync, statSync, readFileSync, createReadStream } from 'node:fs'
import { extname, join, normalize } from 'node:path'

export function previewRoutes(rt: Runtime, manager: PreviewManager) {
  const r = new Hono()
  const projectsRoot = projectsRootOf(rt.dataDir)

  const dirFor = (name: string) => {
    const dir = projectDirOf(projectsRoot, name)
    return dir && existsSync(dir) ? dir : null
  }

  r.get('/ide/preview', (c) => c.json({ previews: manager.list() }))

  r.get('/ide/preview/status', (c) => {
    const project = c.req.query('project') ?? ''
    const info = manager.info(project)
    return c.json(info ? { ...info, running: info.running ?? true } : { running: false, project })
  })

  r.post('/ide/preview/start', async (c) => {
    let body: { project?: string; restart?: boolean }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const project = String(body.project ?? '')
    const dir = dirFor(project)
    if (!dir) return c.json({ error: 'Project not found.' }, 404)
    try {
      const info = await manager.start(project, dir, { restart: !!body.restart })
      return c.json({ ok: !info.error, ...info })
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 500)
    }
  })

  r.post('/ide/preview/stop', async (c) => {
    let body: { project?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const stopped = await manager.stop(String(body.project ?? ''))
    return c.json({ ok: stopped })
  })

  r.post('/ide/preview/reload', async (c) => {
    let body: { project?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const info = await manager.reload(String(body.project ?? ''))
    if (!info) return c.json({ error: 'No preview running for this project.' }, 404)
    return c.json({ ok: !info.error, ...info })
  })

  /**
   * Same-origin fallback for static previews. Some hosts refuse to embed a page
   * served from another port; this route serves the exact same folder through
   * the app origin so the pane still works. Root-relative URLs in the HTML are
   * rewritten to go through here as well.
   */
  r.get('/ide/preview/site', (c) => {
    const project = c.req.query('project') ?? ''
    const rel = decodeURIComponent(c.req.query('path') ?? '/')
    const dir = dirFor(project)
    if (!dir) return c.json({ error: 'Project not found.' }, 404)
    const root = manager.staticRootFor(project, dir)
    if (!root) return c.json({ error: 'This project needs a running dev server — start the preview first.' }, 404)
    const prefix = `/api/ide/preview/site?project=${encodeURIComponent(project)}&path=`
    const safe = normalize(rel.split('?')[0]).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '')
    let file = join(root, safe)
    if (!file.startsWith(root)) return c.json({ error: 'Path escapes the project.' }, 400)
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      const index = join(root, 'index.html')
      if (existsSync(index) && !extname(safe)) file = index
      else return c.text('404', 404)
    }
    const ext = extname(file).toLowerCase()
    const type = MIME[ext] ?? 'application/octet-stream'
    if (type.includes('text/html')) {
      let html = readFileSync(file, 'utf8')
      // Keep the preview self-contained under the prefix.
      html = html.replace(/(\s(?:href|src|action)=)(["'])\/(?!\/)/g, (_m, attr: string, q: string) => `${attr}${q}${prefix}`)
      html = injectBridge(html)
      return c.body(html, 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    }
    if (type.startsWith('text/css') || type.includes('javascript')) {
      const text = readFileSync(file, 'utf8').replace(/url\((["']?)\//g, `url($1${prefix}`)
      return c.body(text, 200, { 'content-type': type, 'cache-control': 'no-store' })
    }
    c.header('content-type', type)
    c.header('cache-control', 'no-store')
    return c.body(createReadStream(file) as any, 200)
  })

  r.get('/ide/preview/logs', (c) => {
    const info = manager.info(c.req.query('project') ?? '')
    return c.json({ logs: info?.logs ?? [] })
  })

  return r
}
