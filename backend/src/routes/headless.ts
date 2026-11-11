/**
 * Headless browsing through Lightpanda.
 *
 *   GET  /api/browse/status  — whether Lightpanda is installed, and where
 *   POST /api/browse         — { url } → { via, url, text, truncated }
 *
 * The page is read by Lightpanda, which runs the page's own JavaScript, so a
 * client-rendered article comes back as text. Only public http(s) addresses are
 * accepted (see parseTarget in the reader).
 */
import { Hono } from 'hono'
import { browseWithLightpanda, lightpandaStatus } from '../services/headless'

export const headlessRoutes = new Hono()

headlessRoutes.get('/browse/status', (c) => c.json(lightpandaStatus()))

headlessRoutes.post('/browse', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Send JSON with a url.' }, 400) }
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return c.json({ error: 'Give a url to open.' }, 400)
  const outcome = await browseWithLightpanda(url)
  if (!outcome.ok) return c.json({ via: 'lightpanda', url, error: outcome.error }, outcome.status as 400 | 502 | 503)
  return c.json(outcome.result)
})
