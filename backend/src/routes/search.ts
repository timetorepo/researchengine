import { Hono } from 'hono'
import {
  searchSearxngAuto, searchBrave, searchSerper, searchTavily, searchDdg, searchDemo, searchStatus,
  searchFirecrawl, searchCrawl4ai, crawlerBase,
  type SearchKeys, type SearchResult,
} from '../services/search/adapters'
import { prepareRag, type RagHit } from '../services/rag'

export const searchRoutes = new Hono()

/**
 * Keys the user pasted in Settings → Search travel with the request, so a
 * self-hosted copy works without anyone editing the server's environment. The
 * server never stores them; they exist for the length of this call.
 */
function keysFrom(c: any): SearchKeys {
  try {
    const raw = c.req.header('x-re-search-keys')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return {
      brave: typeof parsed?.brave === 'string' ? parsed.brave : undefined,
      serper: typeof parsed?.serper === 'string' ? parsed.serper : undefined,
      tavily: typeof parsed?.tavily === 'string' ? parsed.tavily : undefined,
      firecrawl: typeof parsed?.firecrawl === 'string' ? parsed.firecrawl.slice(0, 300) : undefined,
    }
  } catch { return {} }
}

/**
 * GET /api/search?q=…&backend=…
 *
 * The ladder, in order, stopping at the first engine with results:
 *   the engine you picked (with your key if it needs one) →
 *   SearXNG, yours or a public instance (keyless) →
 *   DuckDuckGo (keyless) →
 *   clearly-labelled demo results.
 *
 * The answer always says which engine served it, because "search worked" and
 * "search quietly returned placeholders" must never look the same.
 */
searchRoutes.get('/', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Missing ?q=' }, 400)

  // Top Secret privacy mode: no external request at all.
  if (c.req.query('offline') === '1') {
    return c.json({ backend: 'demo', offline: true, results: searchDemo(q) })
  }

  const keys = keysFrom(c)
  const own = c.req.query('searxng') || process.env.SEARXNG_URL || null
  const patience = Number(c.req.query('timeout')) || undefined
  const requested = (c.req.query('backend') ?? process.env.SEARCH_BACKEND ?? 'auto').toLowerCase()
  const engineTimeout = patience ? Math.min(60_000, patience * 1000) : undefined
  // Self-hosted crawlers: an address typed in Settings wins over the server's environment.
  const firecrawlBase = crawlerBase(c.req.query('firecrawl')) ?? crawlerBase(process.env.FIRECRAWL_URL)
  const crawl4aiBase = crawlerBase(c.req.query('crawl4ai')) ?? crawlerBase(process.env.CRAWL4AI_URL)
  const crawl4aiToken = process.env.CRAWL4AI_API_TOKEN
  const firecrawlReady = !!(keys.firecrawl || firecrawlBase)

  const attempts: { engine: string; error?: string }[] = []
  const note = (engine: string, error?: string) => attempts.push({ engine, ...(error ? { error } : {}) })

  const tryEngine = async (engine: string): Promise<{ results: SearchResult[]; label: string } | null> => {
    try {
      switch (engine) {
        case 'brave': return { results: await searchBrave(q, keys.brave, engineTimeout), label: 'brave' }
        case 'serper': return { results: await searchSerper(q, keys.serper, engineTimeout), label: 'serper' }
        case 'tavily': return { results: await searchTavily(q, keys.tavily, engineTimeout), label: 'tavily' }
        case 'ddg': return { results: await searchDdg(q, engineTimeout), label: 'ddg' }
        case 'firecrawl': return { results: await searchFirecrawl(q, { key: keys.firecrawl, base: firecrawlBase }, engineTimeout), label: keys.firecrawl ? 'firecrawl:hosted' : 'firecrawl:self-hosted' }
        case 'crawl4ai': return { results: await searchCrawl4ai(q, { base: crawl4aiBase, token: crawl4aiToken, own }, engineTimeout), label: 'crawl4ai' }
        case 'searxng': {
          const { results, instance } = await searchSearxngAuto(q, { own, timeouts: 3, timeoutMs: engineTimeout })
          return { results, label: `searxng:${instance}` }
        }
        case 'demo': return { results: searchDemo(q), label: 'demo' }
        default: return null
      }
    } catch (e: any) {
      note(engine, String(e?.message ?? e))
      return null
    }
  }

  // 1) what was asked for, when it is a specific engine
  if (requested !== 'auto') {
    const hit = await tryEngine(requested)
    if (hit?.results.length) return c.json({ backend: hit.label, attempts, results: hit.results })
  }

  // 2) auto: a crawler the person has set up goes first (Firecrawl, then Crawl4AI).
  //    They are only used when configured, so nothing is sent to them by surprise.
  if (requested === 'auto') {
    if (firecrawlReady) {
      const fc = await tryEngine('firecrawl')
      if (fc?.results.length) return c.json({ backend: fc.label, attempts, results: fc.results })
    }
    if (crawl4aiBase) {
      const c4 = await tryEngine('crawl4ai')
      if (c4?.results.length) return c.json({ backend: c4.label, attempts, results: c4.results })
    }
  }

  // 3) keyless SearXNG (this is also the `auto` first choice)
  const sx = await tryEngine('searxng')
  if (sx?.results.length) return c.json({ backend: sx.label, attempts, results: sx.results })

  // 4) keyless DuckDuckGo
  if (requested !== 'ddg') {
    const ddg = await tryEngine('ddg')
    if (ddg?.results.length) return c.json({ backend: 'ddg', attempts, results: ddg.results })
  }

  // 5) labelled placeholders — never an empty panel pretending to be a search
  return c.json({ backend: 'demo', attempts, results: searchDemo(q) })
})

/**
 * GET /api/search/status — what actually answers from this machine. The Search
 * settings page uses it to tell the truth about the current setup.
 */
searchRoutes.get('/status', async (c) => {
  const keys = keysFrom(c)
  const own = c.req.query('searxng') || process.env.SEARXNG_URL || null
  const status = await searchStatus(keys, own)
  return c.json(status)
})

/**
 * POST /api/rag/prepare — the retrieval-augmented pipeline.
 *
 * Body: { query, deep?, maxSources?, searxng? }. Runs the search ladder,
 * reads the winning pages through the reader, deduplicates and ranks them by
 * relevance and trust tier, and answers with a numbered, capped context block
 * plus honest stats. No demo placeholders ever enter the grounding: a RAG
 * answer grounded on invented results would be worse than no grounding, so an
 * empty ladder answers `ok: false` and the chat falls back to plain search.
 */
searchRoutes.post('/rag/prepare', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const query = String(body?.query ?? '').trim()
  if (!query) return c.json({ error: 'Missing query.' }, 400)

  const keys = keysFrom(c)
  const own = typeof body?.searxng === 'string' && body.searxng ? body.searxng : (process.env.SEARXNG_URL || null)
  const searchFn = async (q: string): Promise<RagHit[]> => {
    try {
      const sx = await searchSearxngAuto(q, { own, timeoutMs: 5000 })
      if (sx.results.length) return sx.results
    } catch { /* down the ladder */ }
    try {
      return await searchDdg(q, 5000)
    } catch { return [] }
  }

  try {
    const outcome = await prepareRag({
      query,
      deep: Boolean(body?.deep),
      maxSources: Math.max(2, Math.min(Number(body?.maxSources) || 5, 8)),
      timeoutMs: 2600,
      search: searchFn,
    })
    if (!outcome.sources.length) return c.json({ ok: false, reason: 'The search ladder returned nothing for this query.', stats: outcome.stats })
    return c.json({ ok: true, ...outcome })
  } catch (e: any) {
    return c.json({ ok: false, reason: e?.message ?? 'The RAG pipeline failed.' }, 502)
  }
})
