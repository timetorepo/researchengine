/**
 * Link previews for the links an answer contains.
 *
 * The rule this route exists to respect: a preview is a request made on the
 * user's behalf, so it may only be made where the site says it is welcome. The
 * order is therefore
 *
 *   1. `robots.txt` for the site, fetched once per host and cached. A path the
 *      site disallows is never fetched; the answer says so, and the frontend
 *      draws a plain link with a note instead of a screenshot.
 *   2. the page itself, read as bytes with a hard cap, parsed for Open Graph
 *      and Twitter-card metadata, with the plain `<title>`/description as the
 *      fallback.
 *   3. an image to show: the page's own `og:image` first (no third party), then
 *      a screenshot service that returns a URL the *browser* loads, never the
 *      server. When both fail the frontend falls back to the favicon and the
 *      domain, so a card is never empty.
 *
 * Nothing is fetched for `localhost`, private ranges or non-http schemes: a
 * preview must not become a way to read a machine's own network.
 */
import { Hono } from 'hono'

export const linkRoutes = new Hono()

const UA = 'ResearchEngine/1.0 (+link preview; respects robots.txt)'
const MAX_HTML = 512 * 1024
const TIMEOUT = 7000
const CACHE_TTL = 30 * 60 * 1000
const ROBOTS_TTL = 6 * 60 * 60 * 1000

interface Preview {
  ok: boolean
  url: string
  domain: string
  robots: 'allowed' | 'disallowed' | 'unavailable'
  title?: string
  description?: string
  siteName?: string
  image?: string | null
  /** Where `image` came from, so the UI can say "screenshot service" honestly. */
  imageSource?: 'page' | 'screenshot-service' | null
  /** Screenshot-service URL for the browser to try when the page has no og:image. */
  screenshot?: string | null
  favicon: string
  fetchedAt: number
  reason?: string
}

const cache = new Map<string, Preview>()
const robotsCache = new Map<string, { allow: string[]; disallow: string[]; at: number }>()

/** Refuse anything that is not a public http(s) address. */
function parseTarget(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.endsWith('.internal')) return null
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number)
      if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) return null
    }
    return u
  } catch { return null }
}

/** robots.txt, parsed for the `*` group: longest matching rule wins, Allow beats Disallow on a tie. */
async function robotsFor(origin: string): Promise<{ allow: string[]; disallow: string[] } | null> {
  const hit = robotsCache.get(origin)
  if (hit && Date.now() - hit.at < ROBOTS_TTL) return hit
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT) })
    if (!res.ok) {
      // 404 and friends mean "no rules"; 401/403 mean "stay out".
      const out = { allow: [], disallow: res.status === 401 || res.status === 403 ? ['/'] : [], at: Date.now() }
      robotsCache.set(origin, out)
      return out
    }
    const text = (await res.text()).slice(0, 200_000)
    const allow: string[] = []
    const disallow: string[] = []
    let inStar = false
    for (const raw of text.split('\n')) {
      const line = raw.split('#')[0].trim()
      if (!line) continue
      const [k, ...rest] = line.split(':')
      const key = k.trim().toLowerCase()
      const value = rest.join(':').trim()
      if (key === 'user-agent') { inStar = value === '*'; continue }
      if (!inStar) continue
      if (key === 'allow' && value) allow.push(value)
      if (key === 'disallow' && value) disallow.push(value)
    }
    const out = { allow, disallow, at: Date.now() }
    robotsCache.set(origin, out)
    return out
  } catch {
    // A robots.txt we cannot read is not permission. Say so and let the UI
    // decide; the caller treats it as "unavailable" and does not fetch.
    return null
  }
}

const matches = (rule: string, path: string) => {
  const pattern = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')
  return new RegExp(`^${pattern.replace(/\$$/, '$')}`).test(path)
}

const robotsAllows = (rules: { allow: string[]; disallow: string[] }, path: string) => {
  const best = (list: string[]) => list.filter((r) => matches(r, path)).reduce((a, r) => Math.max(a, r.length), -1)
  const d = best(rules.disallow)
  const a = best(rules.allow)
  if (d === -1) return true
  return a >= d
}

function meta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1].trim())
  }
  return undefined
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
}

function faviconFor(u: URL): string {
  // The page's own declaration is preferred; the favicon service is the
  // fallback, and it is only ever loaded by the browser.
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`
}

linkRoutes.get('/link/preview', async (c) => {
  const raw = c.req.query('url')
  const fallbackIcon = (() => { try { return faviconFor(new URL(raw ?? 'https://example.com')) } catch { return '' } })()
  if (!raw) return c.json({ ok: false, error: 'Missing ?url=' }, 400)
  const target = parseTarget(raw)
  if (!target) {
    return c.json({
      ok: false, url: raw, domain: '', robots: 'unavailable', favicon: fallbackIcon,
      fetchedAt: Date.now(), reason: 'Only public http(s) links can be previewed.',
    } satisfies Partial<Preview>)
  }

  const key = target.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL) return c.json(hit)

  const base: Preview = {
    ok: true, url: key, domain: target.hostname, robots: 'unavailable',
    favicon: faviconFor(target), fetchedAt: Date.now(), image: null, imageSource: null,
  }

  const rules = await robotsFor(target.origin)
  if (!rules) {
    const out = { ...base, ok: false, reason: 'The site could not be reached for its robots.txt, so nothing was fetched.' }
    cache.set(key, out)
    return c.json(out)
  }
  const path = `${target.pathname}${target.search}`
  if (!robotsAllows(rules, path)) {
    const out = { ...base, ok: false, robots: 'disallowed' as const, reason: 'robots.txt asks crawlers to stay out of this path.' }
    cache.set(key, out)
    return c.json(out)
  }

  try {
    const res = await fetch(key, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!res.ok) {
      const out = { ...base, ok: false, robots: 'allowed' as const, reason: `The page answered ${res.status}.` }
      cache.set(key, out)
      return c.json(out)
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) {
      const out = { ...base, ok: false, robots: 'allowed' as const, reason: 'That link is not an HTML page.' }
      cache.set(key, out)
      return c.json(out)
    }
    const reader = res.body?.getReader()
    let html = ''
    if (reader) {
      const decoder = new TextDecoder()
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value?.length ?? 0
        html += decoder.decode(value, { stream: true })
        if (size > MAX_HTML) break
        if (/<\/head>/i.test(html)) break
      }
    } else {
      html = (await res.text()).slice(0, MAX_HTML)
    }

    const title = meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ])
    const description = meta(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
    ])
    const siteName = meta(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
    ])
    let image = meta(html, [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ])
    if (image) {
      try { image = new URL(image, res.url || key).toString() } catch { image = undefined }
    }
    const declaredIcon = meta(html, [/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i])
    let favicon = faviconFor(target)
    if (declaredIcon) {
      try { favicon = new URL(declaredIcon, res.url || key).toString() } catch { /* keep the service */ }
    }

    const out: Preview = {
      ...base,
      robots: 'allowed',
      title,
      description: description?.slice(0, 300),
      siteName,
      favicon,
      image: image ?? null,
      imageSource: image ? 'page' : null,
      // No og:image: hand the browser a screenshot-service URL to try. It is
      // fetched by the user's machine, not by this server, and the frontend
      // falls back to the favicon tile if even that fails.
      ...(image ? {} : { screenshot: `https://api.microlink.io/?url=${encodeURIComponent(key)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1200&viewport.height=630` }),
    }
    cache.set(key, out)
    return c.json(out)
  } catch (e: any) {
    const out = { ...base, ok: false, robots: 'allowed' as const, reason: `The page could not be read (${String(e?.name ?? 'error')}).` }
    cache.set(key, out)
    return c.json(out)
  }
})
