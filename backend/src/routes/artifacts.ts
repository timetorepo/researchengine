// Artifacts: a piece of code from a chat, shown as a live page on this machine.
//
//   POST /api/artifacts        { html }  →  { id, url }   the page is kept in memory
//   GET  /api/artifacts/:id              the page itself, served from localhost
//
// Nothing is written to disk. A preview lasts an hour, and only the newest few are
// kept. The page is served with `Content-Security-Policy: sandbox allow-scripts`, so
// it runs its own script in an opaque origin: it cannot read the app's storage,
// cookies or API. Scripts may still load their libraries from the web.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'

const MAX_BYTES = 400_000
const MAX_ITEMS = 40
const TTL_MS = 60 * 60_000
const ID = /^[a-f0-9]{16}$/

const items = new Map<string, { html: string; at: number }>()

function prune(now: number) {
  for (const [id, item] of items) if (now - item.at > TTL_MS) items.delete(id)
  while (items.size > MAX_ITEMS) {
    const oldest = items.keys().next().value
    if (oldest === undefined) break
    items.delete(oldest)
  }
}

export function artifactRoutes(_rt: Runtime) {
  const r = new Hono()

  r.post('/artifacts', async (c) => {
    const body = await c.req.json().catch(() => null) as any
    const html = typeof body?.html === 'string' ? body.html : ''
    if (!html.trim()) return c.json({ error: 'There is nothing to preview.' }, 400)
    if (new TextEncoder().encode(html).length > MAX_BYTES) {
      return c.json({ error: 'That artifact is too large to preview (400 KB at most).' }, 413)
    }
    const now = Date.now()
    prune(now)
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    items.set(id, { html, at: now })
    return c.json({ id, url: `/api/artifacts/${id}` })
  })

  r.get('/artifacts/:id', (c) => {
    const id = c.req.param('id')
    if (!ID.test(id)) return c.text('Not found', 404)
    prune(Date.now())
    const hit = items.get(id)
    if (!hit) return c.text('This preview has expired. Open the artifact again from the chat.', 404)
    return new Response(hit.html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': 'sandbox allow-scripts',
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    })
  })

  return r
}
