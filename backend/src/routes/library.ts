/**
 * The Library's search lane.
 *
 * One query goes out to three places at once, and the answer says which is
 * which rather than blending them:
 *
 *   • Wikipedia — the encyclopaedia's own API, no key, no scraper.
 *   • Trusted sources — the same search ladder the chat uses (SearXNG, the
 *     user's own instance when they have one, then the keyless engines), so a
 *     result that appears in Library also appears in a chat with the same
 *     provenance.
 *   • Your documents — anything already imported into this app, matched on
 *     title and body, plus whatever the reader has open.
 *
 * Everything saved lands in `library_items`, optionally inside a folder, with
 * tags. Recommendations read those tags and any RSS/Atom feeds the user added
 * and pull candidates from the same APIs — nothing is recommended that did not
 * come from a source the user chose.
 */
import { Hono } from 'hono'
import { db } from '../db'
import { searchDdg, searchSearxngAuto } from '../services/search/adapters'

export const libraryRoutes = new Hono()

const UA = 'ResearchEngine/0.35 (+https://github.com/timetorepo/researchengine)'
const TIMEOUT = 7000
const CACHE_TTL = 10 * 60 * 1000

type Hit = {
  id: string
  kind: 'wikipedia' | 'source' | 'document'
  title: string
  url?: string
  snippet?: string
  source: string
  favicon?: string
  /** Where the favicon comes from, so the UI can say why it is missing. */
  icon?: string
}

const cache = new Map<string, { at: number; hits: Hit[] }>()

async function get(url: string, accept = 'application/json') {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

export function faviconFor(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`
  } catch { return '' }
}

/* ------------------------------------------------------------------ search - */

async function wikipedia(q: string): Promise<Hit[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=6&format=json&origin=*`
  const json: any = await (await get(url)).json()
  const rows = json?.query?.search ?? []
  return rows.map((r: any, i: number) => {
    const page = `https://en.wikipedia.org/?curid=${r.pageid}`
    return {
      id: `wiki_${r.pageid ?? i}`,
      kind: 'wikipedia' as const,
      title: String(r.title ?? '').replace(/<[^>]+>/g, ''),
      url: page,
      snippet: String(r.snippet ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
      source: 'Wikipedia',
      favicon: faviconFor(page),
      icon: 'wikipedia',
    }
  })
}

async function trustedSources(q: string, searxng: string | null): Promise<Hit[]> {
  // Prefer a self-hosted instance when the user has one; otherwise let the
  // ladder pick. Both are keyless, so Library search never needs a key to work.
  let results: any[] = []
  if (searxng) {
    try { results = (await searchSearxngAuto(q, { own: searxng, timeoutMs: TIMEOUT })).results } catch { results = [] }
  }
  if (!results.length) {
    try { results = await searchDdg(q, TIMEOUT) } catch { results = [] }
  }
  return results.slice(0, 8).map((r, i) => ({
    id: `src_${i}_${encodeURIComponent(String(r.url ?? '')).slice(-24)}`,
    kind: 'source' as const,
    title: String(r.title ?? '').slice(0, 200) || String(r.url ?? ''),
    url: String(r.url ?? ''),
    snippet: String(r.snippet ?? '').slice(0, 300),
    source: (() => { try { return new URL(String(r.url)).hostname.replace(/^www\./, '') } catch { return 'web' } })(),
    favicon: faviconFor(String(r.url ?? '')),
    icon: 'web',
  }))
}

function ownDocuments(q: string): Hit[] {
  const needle = q.toLowerCase()
  return (db.listLibraryItems() as any[])
    .filter((it) => it.kind === 'document' || it.kind === 'note')
    .filter((it) => `${it.title} ${it.snippet ?? ''} ${(it.tags ?? []).join(' ')}`.toLowerCase().includes(needle))
    .slice(0, 10)
    .map((it) => ({
      id: `doc_${it.id}`,
      kind: 'document' as const,
      title: it.title,
      url: it.url ?? undefined,
      snippet: String(it.snippet ?? '').slice(0, 300),
      source: 'Your library',
      icon: 'local',
    }))
}

libraryRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json({ query: q, hits: [], note: 'Type at least two characters.' })
  const cached = cache.get(q.toLowerCase())
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return c.json({ query: q, hits: cached.hits, cached: true })
  }
  const searxng = c.req.query('searxng') || process.env.SEARXNG_URL || null
  const settled = await Promise.allSettled([wikipedia(q), trustedSources(q, searxng)])
  const hits: Hit[] = []
  const notes: string[] = []
  const [wiki, web] = settled
  if (wiki.status === 'fulfilled') hits.push(...wiki.value)
  else notes.push('Wikipedia could not be reached (offline?).')
  if (web.status === 'fulfilled') hits.push(...web.value)
  else notes.push('Web sources could not be reached; your own documents were still searched.')
  hits.push(...ownDocuments(q))
  cache.set(q.toLowerCase(), { at: Date.now(), hits })
  return c.json({ query: q, hits, notes })
})

/* ------------------------------------------------------------- saved items - */

libraryRoutes.get('/items', (c) => c.json({ items: db.listLibraryItems(), folders: db.listLibraryFolders() }))

libraryRoutes.post('/items', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const title = String(body?.title ?? '').trim()
  if (!title) return c.json({ error: 'An item needs a title.' }, 400)
  const item = {
    id: String(body?.id ?? `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    kind: ['wikipedia', 'source', 'document', 'note', 'feed'].includes(String(body?.kind)) ? String(body.kind) : 'source',
    title: title.slice(0, 300),
    url: body?.url ? String(body.url).slice(0, 1000) : undefined,
    snippet: body?.snippet ? String(body.snippet).slice(0, 4000) : undefined,
    tags: Array.isArray(body?.tags) ? body.tags.map((t: any) => String(t).slice(0, 40)).slice(0, 12) : [],
    folderId: body?.folderId ? String(body.folderId) : undefined,
    savedAt: Date.now(),
    extra: body?.extra ?? undefined,
  }
  db.insertLibraryItem(item)
  return c.json({ ok: true, item })
})

libraryRoutes.delete('/items/:id', (c) => {
  db.deleteLibraryItem(c.req.param('id'))
  return c.json({ ok: true })
})

libraryRoutes.get('/folders', (c) => c.json({ folders: db.listLibraryFolders() }))

libraryRoutes.post('/folders', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return c.json({ error: 'A folder needs a name.' }, 400)
  const folder = {
    id: String(body?.id ?? `fold_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    name: name.slice(0, 80),
    createdAt: Date.now(),
  }
  db.insertLibraryFolder(folder)
  return c.json({ ok: true, folder })
})

libraryRoutes.delete('/folders/:id', (c) => {
  db.deleteLibraryFolder(c.req.param('id'))
  return c.json({ ok: true })
})

/* ------------------------------------------------- imports / uploads ------ */

/**
 * A file the user dropped in. The text was already extracted in the browser
 * (pdf.js / mammoth), so this only has to file it: the words become searchable
 * locally, and the item lands in whatever folder was picked.
 */
libraryRoutes.post('/upload', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return c.json({ error: 'The file needs a name.' }, 400)
  const text = String(body?.text ?? '').slice(0, 400_000)
  const item = {
    id: `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    kind: 'document',
    title: name.slice(0, 300),
    snippet: text.slice(0, 4000),
    tags: Array.isArray(body?.tags) ? body.tags.map((t: any) => String(t).slice(0, 40)).slice(0, 12) : [],
    folderId: body?.folderId ? String(body.folderId) : undefined,
    savedAt: Date.now(),
    extra: { bytes: Number(body?.bytes) || 0, type: String(body?.type ?? ''), chars: text.length },
  }
  db.insertLibraryItem(item)
  return c.json({ ok: true, item })
})

/** An RSS or Atom feed, kept as an item so it can be tagged like anything else. */
libraryRoutes.post('/feeds', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const url = String(body?.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return c.json({ error: 'Feeds need an http(s) URL.' }, 400)
  try {
    const feed = await readFeed(url)
    const item = {
      id: `feed_${Date.now().toString(36)}`,
      kind: 'feed',
      title: feed.title || url,
      url,
      snippet: feed.items.slice(0, 3).map((i) => i.title).join(' · ').slice(0, 400),
      tags: Array.isArray(body?.tags) ? body.tags.map((t: any) => String(t).slice(0, 40)).slice(0, 12) : [],
      savedAt: Date.now(),
      extra: { feedTitle: feed.title, items: feed.items.length },
    }
    db.insertLibraryItem(item)
    return c.json({ ok: true, item, preview: feed.items.slice(0, 5) })
  } catch (e: any) {
    return c.json({ error: `That feed did not load: ${String(e?.message ?? e).slice(0, 120)}` }, 502)
  }
})

/* ---------------------------------------------------------- recommendations */

type FeedItem = { title: string; link: string; summary?: string; at?: string }

async function readFeed(url: string): Promise<{ title: string; items: FeedItem[] }> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = (await res.text()).slice(0, 800_000)
  const title = decode(match(xml, /<title[^>]*>([\s\S]*?)<\/title>/i)) || ''
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const items = blocks.slice(0, 25).map((b) => ({
    title: decode(match(b, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    link: pickLink(b),
    summary: decode(match(b, /<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i)).replace(/<[^>]+>/g, ' ').trim().slice(0, 240),
    at: decode(match(b, /<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i)),
  })).filter((i) => i.title || i.link)
  return { title, items }
}

function match(text: string, re: RegExp): string {
  const m = text.match(re)
  return m ? m[1] : ''
}
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim()
}
function pickLink(block: string): string {
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i)
  if (atom) return atom[1]
  return decode(match(block, /<link[^>]*>([\s\S]*?)<\/link>/i))
}

/**
 * GET /api/library/recommendations
 *
 * Reads what the user actually told us to watch: the tags on their saved items
 * and the feeds they added. Every candidate comes from one of those, and each
 * one says which. With nothing to go on it returns an empty list and a hint —
 * it never invents interests.
 */
libraryRoutes.get('/recommendations', async (c) => {
  const items = db.listLibraryItems() as any[]
  // What to watch: tags on saved things, plus anything the user typed into the
  // watch list on the Library search screen. Nothing else is ever inferred.
  const asked = (c.req.query('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  const tags = [...new Set([...asked, ...items.flatMap((i) => i.tags ?? [])])].slice(0, 6)
  const feeds = items.filter((i) => i.kind === 'feed').slice(0, 5)
  const out: (FeedItem & { reason: string; source: string; favicon?: string })[] = []
  const notes: string[] = []

  const feedWork = feeds.map(async (f) => {
    try {
      const feed = await readFeed(f.url)
      for (const it of feed.items.slice(0, 4)) {
        out.push({ ...it, reason: `new in ${feed.title || f.title}`, source: f.url, favicon: faviconFor(f.url) })
      }
    } catch { notes.push(`${f.title} did not load.`) }
  })

  const tagWork = tags.map(async (tag) => {
    try {
      const hits = await wikipedia(tag)
      for (const h of hits.slice(0, 3)) {
        out.push({ title: h.title, link: h.url ?? '', summary: h.snippet, reason: `matches your tag #${tag}`, source: h.url ?? '', favicon: h.favicon })
      }
    } catch { notes.push(`Could not search for #${tag}.`) }
  })

  await Promise.allSettled([...feedWork, ...tagWork])

  const seen = new Set<string>()
  const unique = out.filter((r) => {
    const key = r.link || r.title
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 20)

  return c.json({
    recommendations: unique,
    watching: { tags, feeds: feeds.map((f) => ({ id: f.id, title: f.title, url: f.url })) },
    notes,
    hint: tags.length || feeds.length ? undefined : 'Add tags to something you saved, or an RSS feed, and recommendations will follow those.',
  })
})
