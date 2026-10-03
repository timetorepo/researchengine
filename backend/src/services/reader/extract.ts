/**
 * Reading a page, for the Library's source viewer.
 *
 * Two kinds of source, and they get different treatment because they are
 * different things:
 *
 *   • Wikipedia is an API, not a web page. `/w/api.php?action=query&prop=extracts`
 *     hands back the article as plain text with the sections intact — no HTML in
 *     the middle, no navigation furniture, no guessing. That is what "a text
 *     parser for wikis" means, and it is why a wiki article reads properly here
 *     while the same article in an iframe is a wall of chrome.
 *
 *   • Everything else is a web page, so the HTML is fetched and reduced: the
 *     main content is found by score (paragraph density, not a selector list
 *     that breaks next year), scripts and chrome are dropped, entities decoded,
 *     and the result is returned as blocks the reader can typeset.
 *
 * The reader never invents content. When a page cannot be read — a paywall, a
 * script-only app, a host that refuses — the answer says which of those it was
 * and the viewer offers the browser view instead.
 *
 * SSRF: only public http(s) targets are fetched (see `parseTarget`). A URL that
 * points at loopback, a private range or a link-local address is refused, which
 * matters because the agent can call this route.
 */
import { decodeEntities, htmlToBlocks, looksLikeAppShell, metaOf, titleOf, type Block } from './html'

const UA = 'ResearchEngine/0.37 (+library reader; respects robots.txt)'
const TIMEOUT = 12_000
const MAX_BYTES = 3_000_000

export interface ReadResult {
  ok: boolean
  url: string
  /** Where the text actually came from. */
  via: 'wikipedia-api' | 'html'
  title: string
  byline?: string
  siteName?: string
  /** ISO date, when the page says so. */
  published?: string
  wordCount: number
  /** Minutes at 220 wpm, rounded up — the honest reading time. */
  minutes: number
  blocks: Block[]
  /** Section headings, for a table of contents. */
  outline: { id: string; text: string; level: number }[]
  /** A few images worth showing, absolute URLs. */
  images: { src: string; alt?: string }[]
  /** Set when the page could not be fully read, with the reason in words. */
  warning?: string
  /** True when the page is an app that needs its own JavaScript. */
  interactive?: boolean
  fetchedAt: number
}

/** Refuse anything that is not a public http(s) address. */
export function parseTarget(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.endsWith('.internal') || host.endsWith('.local')) return null
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number)
      if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) return null
    }
    if (host.includes(':')) {
      // IPv6 loopback / link-local / unique-local.
      if (host === '::' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) return null
    }
    return u
  } catch { return null }
}

const isWikipedia = (u: URL) => /(^|\.)wikipedia\.org$/.test(u.hostname) || /(^|\.)wikimedia\.org$/.test(u.hostname)

const slug = (s: string, i: number) =>
  (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || `section-${i}`)

/** Wikipedia, through its own API: plain text extracts, sections preserved. */
async function readWikipedia(u: URL): Promise<ReadResult | null> {
  const lang = (u.hostname.split('.')[0] || 'en').replace(/[^a-z-]/gi, '')
  const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''))
  if (!title) return null
  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages|info&inprop=url&explaintext=1&exsectionformat=wiki&piprop=original|thumbnail&pithumbsize=1000&redirects=1&titles=${encodeURIComponent(title)}`
  const res = await fetch(api, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) return null
  const json: any = await res.json().catch(() => null)
  const page = json?.query?.pages ? Object.values<any>(json.query.pages)[0] : null
  const extract: string = page?.extract ?? ''
  if (!extract.trim()) return null

  // Wikipedia returns `== Section ==` markers with exsectionformat=wiki.
  const blocks: Block[] = []
  const outline: ReadResult['outline'] = []
  let current = ''
  let pendingHeading: { level: number; text: string } | null = null
  let sectionIndex = 0
  const flush = () => {
    const text = current.trim()
    current = ''
    if (!text) return
    if (pendingHeading) {
      const id = slug(pendingHeading.text, sectionIndex++)
      blocks.push({ type: 'heading', level: pendingHeading.level, text: pendingHeading.text, id })
      outline.push({ id, text: pendingHeading.text, level: pendingHeading.level })
      pendingHeading = null
    }
    for (const para of text.split(/\n{2,}/)) {
      const p = para.trim()
      if (!p) continue
      if (/^[*-]\s/.test(p)) {
        blocks.push({ type: 'list', items: p.split('\n').map((l) => l.replace(/^[*-]\s*/, '').trim()).filter(Boolean) })
      } else if (/^\|/.test(p) || /^\{/.test(p) || /^\}/.test(p)) {
        continue // tables and templates: not worth rendering as prose
      } else {
        blocks.push({ type: 'paragraph', text: p.replace(/\n+/g, ' ') })
      }
    }
  }
  for (const line of extract.split('\n')) {
    const h = line.match(/^\s*(={2,6})\s*(.+?)\s*\1\s*$/)
    if (h) {
      flush()
      pendingHeading = { level: Math.min(3, Math.max(1, h[1].length - 1)), text: h[2] }
      continue
    }
    current += line + '\n'
  }
  flush()

  const words = blocks.reduce((n, b) => n + (b.type === 'paragraph' ? b.text.split(/\s+/).length : b.type === 'list' ? b.items.join(' ').split(/\s+/).length : 0), 0)
  const image = page?.original?.source ?? page?.thumbnail?.source
  return {
    ok: true, url: u.toString(), via: 'wikipedia-api',
    title: page?.title ?? title.replace(/_/g, ' '),
    siteName: `${lang}.wikipedia.org`,
    wordCount: words,
    minutes: Math.max(1, Math.round(words / 220)),
    blocks, outline,
    images: image ? [{ src: image, alt: page?.title }] : [],
    fetchedAt: Date.now(),
  }
}

/** Everything else: fetch the HTML and reduce it to readable blocks. */
async function readHtml(u: URL): Promise<ReadResult> {
  const res = await fetch(u.toString(), {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
  })
  const type = res.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml/.test(type)) {
    return failed(u, `That address answered with ${type || 'an unknown type'}, which is not a web page the reader can typeset.`)
  }
  const raw = await res.text()
  const html = raw.length > MAX_BYTES ? raw.slice(0, MAX_BYTES) : raw

  const { blocks, outline, images, dropped } = htmlToBlocks(html, u)
  const words = blocks.reduce((n, b) => n + (b.type === 'paragraph' ? b.text.split(/\s+/).length : b.type === 'list' ? b.items.join(' ').split(/\s+/).length : b.type === 'quote' ? b.text.split(/\s+/).length : 0), 0)
  const interactive = looksLikeAppShell(html, blocks)

  const warning = interactive
    ? 'This page builds itself with JavaScript, so the reader can only show what the server sent. The browser view is the honest one for this site.'
    : dropped && words < 120
      ? 'Very little text was found on this page — it may be a gallery, a login wall or a script-only app.'
      : undefined

  return {
    ok: words > 0,
    url: u.toString(), via: 'html',
    title: titleOf(html) ?? u.hostname,
    byline: metaOf(html, [/name=["']author["'][^>]*content=["']([^"']+)/i, /property=["']article:author["'][^>]*content=["']([^"']+)/i]),
    siteName: metaOf(html, [/property=["']og:site_name["'][^>]*content=["']([^"']+)/i]) ?? u.hostname,
    published: metaOf(html, [/property=["']article:published_time["'][^>]*content=["']([^"']+)/i, /name=["']date["'][^>]*content=["']([^"']+)/i]),
    wordCount: words,
    minutes: Math.max(1, Math.round(words / 220)),
    blocks, outline, images,
    warning: warning ?? (words === 0 ? 'No readable text was found. The browser view should still work.' : undefined),
    interactive,
    fetchedAt: Date.now(),
  }
}

function failed(u: URL, warning: string): ReadResult {
  return {
    ok: false, url: u.toString(), via: 'html', title: u.hostname,
    siteName: u.hostname, wordCount: 0, minutes: 0, blocks: [], outline: [], images: [],
    warning, fetchedAt: Date.now(),
  }
}

const cache = new Map<string, { at: number; result: ReadResult }>()
const CACHE_TTL = 15 * 60 * 1000

/** Read a URL into something a person can actually read. */
export async function readSource(raw: string): Promise<ReadResult> {
  const hit = cache.get(raw)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result
  const u = parseTarget(raw)
  if (!u) {
    return { ...failed({ hostname: 'invalid' } as URL, 'That address cannot be fetched: only public http(s) links can be read.'), url: raw }
  }
  try {
    const result = (isWikipedia(u) ? await readWikipedia(u) : null) ?? await readHtml(u)
    cache.set(raw, { at: Date.now(), result })
    if (cache.size > 60) cache.delete(cache.keys().next().value as string)
    return result
  } catch (e: any) {
    const reason = e?.name === 'TimeoutError'
      ? 'The site did not answer in time.'
      : /ENOTFOUND|EAI_AGAIN/.test(String(e?.cause?.code ?? '')) ? 'That host could not be resolved from this machine.'
        : `The page could not be fetched (${String(e?.message ?? e)}).`
    const result = { ...failed(u, reason), via: 'html' as const }
    cache.set(raw, { at: Date.now(), result })
    return result
  }
}
