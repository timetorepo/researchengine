/**
 * The small search engine inside ResearchEngine.
 *
 * One query, several verticals, and the answer says which vertical each hit came
 * from — because "a Wikipedia article", "a landing page", "an app screen on
 * Awwwards" and "a component you can install" are four different kinds of
 * evidence and blending them would be a lie about all four.
 *
 *   • web        — the search ladder the chat already uses (SearXNG when the
 *                  user runs one, then the keyless engines).
 *   • wikipedia  — the encyclopaedia's own API.
 *   • screens    — reference libraries, searched by URL: Awwwards, Dribbble,
 *                  unicorn.studio, Refero. These return links, not scraped
 *                  content: the sites own their catalogues and their robots
 *                  rules, and a link is the honest result.
 *   • ui         — app *interfaces* as a searchable idea: the patterns a screen
 *                  is made of, mapped to the query, with the reference libraries
 *                  and the design hub's own vocabulary as the index.
 *   • docs       — a small, curated index of the documentation people ask for
 *                  while building (MDN, React, Tailwind, the registries).
 *
 * Everything here is a plain function returning JSON; the Library renders it and
 * the agent calls the same route through a tool.
 */
import { searchDdg, searchSearxngAuto } from '../search/adapters'
import { wikipediaPageUrl } from './wikipedia'

const UA = 'ResearchEngine/0.37 (+library search)'
const TIMEOUT = 7000

export type Vertical = 'web' | 'wikipedia' | 'screens' | 'ui' | 'docs'

export interface MiniHit {
  id: string
  vertical: Vertical
  title: string
  url: string
  snippet?: string
  source: string
  /** For a screen/ui hit: what to do with it. */
  action?: 'open' | 'read'
}

export interface VerticalResult {
  vertical: Vertical
  label: string
  state: 'ok' | 'error' | 'empty'
  ms: number
  hits: MiniHit[]
  reason?: string
  /** A line under the group, when there is something to explain. */
  note?: string
}

const LABEL: Record<Vertical, string> = {
  web: 'The web',
  wikipedia: 'Wikipedia',
  screens: 'Screens & references',
  ui: 'App interfaces',
  docs: 'Docs & registries',
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

/* ------------------------------- verticals -------------------------------- */

async function web(q: string): Promise<MiniHit[]> {
  // The same ladder the chat uses, so provenance matches everywhere in the app.
  const viaSearx = await searchSearxngAuto(q, { timeouts: 2, timeoutMs: 4000 }).catch(() => null)
  const found = viaSearx?.results?.length ? viaSearx.results : await searchDdg(q, TIMEOUT)
  return found.map((s, i) => ({
    id: `web-${i}`, vertical: 'web' as const,
    title: s.title, url: s.url, snippet: s.snippet, source: host(s.url) || 'web',
  }))
}

async function wikipedia(q: string): Promise<MiniHit[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=6&format=json&origin=*`
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`Wikipedia answered HTTP ${res.status}`)
  const json: any = await res.json()
  return (json?.query?.search ?? []).map((r: any) => ({
    id: `wiki-${r.pageid}`, vertical: 'wikipedia' as const,
    title: r.title,
    url: wikipediaPageUrl(r.title, r.pageid),
    snippet: String(r.snippet ?? '').replace(/<[^>]*>/g, ''),
    source: 'Wikipedia',
    action: 'read' as const,
  }))
}

/** Reference libraries are searched by their own URL grammar. Nothing is scraped. */
function screens(q: string): MiniHit[] {
  const t = encodeURIComponent(q.trim())
  const slug = encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))
  return [
    { id: 'scr-aw', vertical: 'screens' as const, title: `Awwwards — ${q}`, url: `https://www.awwwards.com/websites/?text=${t}`, source: 'awwwards.com', snippet: 'Awarded sites, judged on design — the reference for what is currently considered good.' },
    { id: 'scr-dr', vertical: 'screens' as const, title: `Dribbble — ${q}`, url: `https://dribbble.com/search/shots?q=${t}`, source: 'dribbble.com', snippet: 'Interface shots and explorations, useful for a specific pattern rather than a whole site.' },
    { id: 'scr-uc', vertical: 'screens' as const, title: `unicorn.studio — ${q}`, url: `https://unicorn.studio/?q=${t}`, source: 'unicorn.studio', snippet: 'WebGL and shader-driven interaction references.' },
    { id: 'scr-rf', vertical: 'screens' as const, title: `Refero — ${q}`, url: `https://refero.design/?q=${t}`, source: 'refero.design', snippet: 'Real app screens, sorted by page type and flow — the closest thing to "how do apps do this".' },
    { id: 'scr-mb', vertical: 'ui' as const, title: `Mobbin — ${q}`, url: `https://mobbin.com/search/${slug}`, source: 'mobbin.com', snippet: 'Screens from shipping mobile apps, by pattern.' },
  ]
}

/**
 * App-interface results. The query is read as a *pattern* request rather than a
 * keyword one: "pricing table", "onboarding", "empty state" describe a screen,
 * so the vertical maps them onto the reference libraries and onto the design
 * hub's own vocabulary, which is what the agent can then act on.
 */
function interfaces(q: string): { hits: MiniHit[]; note?: string } {
  const t = q.trim()
  const lower = t.toLowerCase()
  const pattern = /(screen|page|flow|onboard|sign ?up|sign ?in|login|checkout|pricing|paywall|dashboard|settings|profile|feed|empty state|search|filter|table|card|list|detail|modal|sheet|wizard|notification|calendar|chat)/i.test(lower)
  const hits: MiniHit[] = [
    { id: 'ui-ref', vertical: 'ui', title: `App screens for “${t}” — Refero`, url: `https://refero.design/?q=${encodeURIComponent(t)}`, source: 'refero.design', snippet: 'Filtered by page type, so this answers "how does a real app lay this out".', action: 'open' },
    { id: 'ui-mob', vertical: 'ui', title: `Mobile screens for “${t}” — Mobbin`, url: `https://mobbin.com/search/${encodeURIComponent(lower.replace(/\s+/g, '-'))}`, source: 'mobbin.com', snippet: 'Shipping apps, iOS and Android, screenshotted by flow.', action: 'open' },
    { id: 'ui-hub', vertical: 'ui', title: `Components for “${t}” in the design hub`, url: 'app://design-hub', source: 'Research Engine · Design hub', snippet: 'Thirty registries, searched locally — open Design Mode → Components and the query is already there.', action: 'open' },
  ]
  const note = pattern
    ? 'Read as a screen request: the pattern you named is what these libraries index by.'
    : 'Tip: naming the pattern (“pricing table”, “onboarding”, “empty state”) gives sharper screen results than naming a technology.'
  return { hits, note }
}

const DOCS_INDEX: { title: string; url: string; keys: string; what: string }[] = [
  { title: 'MDN — Web platform reference', url: 'https://developer.mozilla.org/en-US/search?q=', keys: 'html css javascript dom api browser web', what: 'The reference for anything the browser does.' },
  { title: 'React docs', url: 'https://react.dev/', keys: 'react hooks components jsx state', what: 'Official React documentation.' },
  { title: 'Tailwind CSS docs', url: 'https://tailwindcss.com/docs/', keys: 'tailwind css utility classes styling', what: 'Utility reference, including the v4 changes.' },
  { title: 'shadcn/ui docs', url: 'https://ui.shadcn.com/docs/components', keys: 'shadcn component registry radix', what: 'The base registry and how its components are consumed.' },
  { title: 'shadcn registry directory', url: 'https://ui.shadcn.com/docs/directory', keys: 'registry community components install namespace', what: 'Every community registry the CLI can install from.' },
  { title: 'Tauri v2 docs', url: 'https://v2.tauri.app/', keys: 'tauri desktop rust webview shell', what: 'The desktop shell this app ships in.' },
  { title: 'Hono docs', url: 'https://hono.dev/docs/', keys: 'hono server route middleware json', what: 'The server framework the local backend uses.' },
  { title: 'Zod docs', url: 'https://zod.dev/', keys: 'zod schema validation typescript', what: 'Runtime validation.' },
  { title: 'Motion docs', url: 'https://motion.dev/docs', keys: 'motion framer animation spring transition', what: 'The animation library used for every interaction here.' },
]

function docs(q: string): MiniHit[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  return DOCS_INDEX
    .map((d) => {
      const hay = `${d.title} ${d.keys} ${d.what}`.toLowerCase()
      const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ d }) => ({
      id: `doc-${d.title}`, vertical: 'docs' as const,
      title: d.title,
      url: d.keys.includes('mdn') ? d.url + encodeURIComponent(q) : d.url,
      source: host(d.url) || 'docs',
      snippet: d.what,
    }))
}

/* -------------------------------- the run -------------------------------- */

const BUDGET_MS = 220
const cache = new Map<string, { at: number; results: VerticalResult[] }>()
const CACHE_TTL = 10 * 60 * 1000

const empty = (vertical: Vertical, ms: number, reason?: string): VerticalResult =>
  ({ vertical, label: LABEL[vertical], state: reason ? 'error' : 'empty', ms, hits: [], reason })

async function lane(vertical: Vertical, run: () => Promise<MiniHit[]> | MiniHit[], noteFor?: (n: number) => string | undefined): Promise<VerticalResult> {
  const t0 = Date.now()
  try {
    const hits = await run()
    const note = noteFor?.(hits.length)
    return { vertical, label: LABEL[vertical], state: hits.length ? 'ok' : 'empty', ms: Date.now() - t0, hits, note }
  } catch (e: any) {
    const reason = e?.name === 'TimeoutError'
      ? `${LABEL[vertical]} did not answer in time.`
      : `${LABEL[vertical]} could not be reached (${String(e?.message ?? e)}).`
    return empty(vertical, Date.now() - t0, reason)
  }
}

/**
 * One query, all verticals, inside a budget. Verticals that need the network run
 * beside each other and are collected even when the budget expires — the caller
 * polls once, exactly like the Library search already does.
 */
export async function miniSearch(query: string): Promise<{ query: string; results: VerticalResult[]; tookMs: number; pending: Vertical[] }> {
  const q = query.trim()
  const cached = cache.get(q)
  const pending: Vertical[] = []
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return { query: q, results: cached.results, tookMs: 0, pending: [] }
  }

  const uiRun = interfaces(q)
  const local: VerticalResult[] = [
    { vertical: 'screens', label: LABEL.screens, state: 'ok', ms: 0, hits: screens(q), note: 'Opens in the source viewer’s browser tab — these catalogues are searched by their own URLs, nothing is scraped.' },
    { vertical: 'ui', label: LABEL.ui, state: 'ok', ms: 0, hits: uiRun.hits, note: uiRun.note },
    { vertical: 'docs', label: LABEL.docs, state: 'ok', ms: 0, hits: docs(q), note: 'A small curated index, not a crawler — these are the pages people actually open while building.' },
  ]

  const remote = Promise.all([
    lane('wikipedia', () => wikipedia(q)),
    lane('web', () => web(q)),
  ]).then((res) => {
    const merged = [...local, ...res]
    cache.set(q, { at: Date.now(), results: merged })
    if (cache.size > 40) cache.delete(cache.keys().next().value as string)
    return merged
  })
  remote.catch(() => { /* the lanes already report their own failures */ })

  const settled = await Promise.race([
    remote,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), BUDGET_MS)),
  ])
  if (settled) return { query: q, results: settled, tookMs: BUDGET_MS, pending: [] }
  // Not ready inside the budget: answer with the local verticals and say the
  // network ones are still running. The client asks once more; the cache fills.
  return { query: q, results: local, tookMs: BUDGET_MS, pending: ['wikipedia', 'web'] }
}
