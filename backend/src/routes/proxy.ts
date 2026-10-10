/**
 * GET /api/proxy?url=… — serve a page so the app's frame can show it.
 *
 * The viewer's Browser tab points here for sites that refuse to be embedded
 * (and offers it as a fallback for any site that turns out to). The answer is
 * the page itself, rewritten by services/reader/proxy.ts, with none of the
 * frame-blocking headers the site sent — we are not forwarding a stranger's
 * frame policy into the user's own app.
 */
import { Hono } from 'hono'
import { fetchForProxy, proxyPath, rewriteHtml } from '../services/reader/proxy'

export const proxyRoutes = new Hono()

proxyRoutes.get('/', async (c) => {
  const url = String(c.req.query('url') ?? '').trim()
  if (!url) return c.json({ error: 'A url is required.' }, 400)

  const got = await fetchForProxy(url)
  if (!got.ok) {
    // An honest little page beats a blank frame: say what happened in words.
    const page = `<!doctype html><html><body style="font:14px/1.6 system-ui,sans-serif;color:#333;display:grid;place-items:center;min-height:90vh;margin:0"><div style="max-width:420px;text-align:center"><p style="font-weight:600">The proxy could not open this page.</p><p>${got.reason.replace(/</g, '&lt;')}</p></div></body></html>`
    c.header('Content-Type', 'text/html; charset=utf-8')
    c.header('Cache-Control', 'no-store')
    return c.body(page, 200)
  }

  const base = new URL(got.finalUrl)
  const html = rewriteHtml(got.html, base, proxyPath)

  // Deliberately: no X-Frame-Options, no Content-Security-Policy. The point
  // of this route is that the user's own app may frame the page.
  c.header('Content-Type', 'text/html; charset=utf-8')
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  return c.body(html, 200)
})
