/**
 * Web access for Bots: search and read pages on behalf of a bot.
 *
 *  - Search goes to SearXNG. Set your own instance in Bots → Web (or SEARXNG_URL
 *    on the server); without one, the same public-instance ladder the app's
 *    search already uses answers. SearXNG is the recommended setup because the
 *    queries then stay on your own machine or network.
 *  - Reading a page uses the app's reader by default. If you run a headless
 *    browser in Docker (for example browserless/chrome), give its address in
 *    Bots → Web and pages are rendered there first, so JavaScript-heavy sites
 *    work. The container must expose the common `POST /content` route.
 *
 * Only http(s) addresses are accepted. Nothing is stored on the server.
 */
import { Hono } from 'hono'
import { searchSearxngAuto } from '../services/search/adapters'
import { readSource } from '../services/reader/extract'

export const botWebRoutes = new Hono()

const MAX_TEXT = 8000

const isHttp = (raw: string): boolean => {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** A browser address may carry a token in its query; keep it and add the route. */
function browserContentUrl(base: string): string {
  const u = new URL(base)
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/content`
  return u.toString()
}

const decode = (s: string) => s
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#x27;/gi, "'")

/** Plain text and a title from a rendered page. Scripts and styles are dropped. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim()
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const text = decode(body)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return { title, text }
}

botWebRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 300)
  if (!q) return c.json({ error: 'Missing ?q=' }, 400)
  const own = c.req.query('searxng') || process.env.SEARXNG_URL || null
  if (own && !isHttp(own)) return c.json({ error: 'The SearXNG address must start with http:// or https://.' }, 400)
  try {
    const { results, instance } = await searchSearxngAuto(q, { own, timeouts: 3, timeoutMs: 15_000 })
    return c.json({
      engine: 'searxng',
      instance,
      results: results.slice(0, 8).map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
    })
  } catch (e: any) {
    return c.json({ error: `No search engine answered (${String(e?.message ?? e)}). Set your own SearXNG address in Bots → Web.`, results: [] }, 502)
  }
})

botWebRoutes.post('/open', async (c) => {
  const body: any = await c.req.json().catch(() => ({}))
  const url = String(body?.url ?? '').trim()
  if (!isHttp(url)) return c.json({ error: 'Only http(s) addresses can be opened.' }, 400)
  const browser = typeof body?.browser === 'string' ? body.browser.trim() : ''

  if (browser) {
    if (!isHttp(browser)) return c.json({ error: 'The browser address must start with http:// or https://.' }, 400)
    try {
      const res = await fetch(browserContentUrl(browser), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) return c.json({ via: 'browser', url, error: `The browser container answered ${res.status}.` }, 502)
      const { title, text } = htmlToText((await res.text()).slice(0, 3_000_000))
      if (!text) return c.json({ via: 'browser', url, error: 'The page rendered with no readable text.' }, 502)
      return c.json({ via: 'browser', url, title: title || url, text: text.slice(0, MAX_TEXT) })
    } catch (e: any) {
      return c.json({ via: 'browser', url, error: `The browser container did not answer (${String(e?.message ?? e)}).` }, 502)
    }
  }

  const page = await readSource(url)
  if (!page.ok) return c.json({ via: 'http', url, error: page.warning ?? 'The page could not be read.' }, 502)
  const parts: string[] = []
  for (const b of page.blocks) {
    if (b.type === 'list') parts.push(b.items.map((i) => `- ${i}`).join('\n'))
    else if ('text' in b) parts.push(b.text)
  }
  const text = parts.join('\n').slice(0, MAX_TEXT)
  return c.json({ via: 'http', url: page.url, title: page.title || url, text })
})
