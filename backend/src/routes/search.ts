import { Hono } from 'hono'
import {
  searchSearxngAuto, searchBrave, searchSerper, searchTavily, searchDdg, searchDemo, searchStatus,
  type SearchKeys, type SearchResult,
} from '../services/search/adapters'

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

  const attempts: { engine: string; error?: string }[] = []
  const note = (engine: string, error?: string) => attempts.push({ engine, ...(error ? { error } : {}) })

  const tryEngine = async (engine: string): Promise<{ results: SearchResult[]; label: string } | null> => {
    try {
      switch (engine) {
        case 'brave': return { results: await searchBrave(q, keys.brave, engineTimeout), label: 'brave' }
        case 'serper': return { results: await searchSerper(q, keys.serper, engineTimeout), label: 'serper' }
        case 'tavily': return { results: await searchTavily(q, keys.tavily, engineTimeout), label: 'tavily' }
        case 'ddg': return { results: await searchDdg(q, engineTimeout), label: 'ddg' }
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

  // 2) keyless SearXNG (this is also the `auto` first choice)
  const sx = await tryEngine('searxng')
  if (sx?.results.length) return c.json({ backend: sx.label, attempts, results: sx.results })

  // 3) keyless DuckDuckGo
  if (requested !== 'ddg') {
    const ddg = await tryEngine('ddg')
    if (ddg?.results.length) return c.json({ backend: 'ddg', attempts, results: ddg.results })
  }

  // 4) labelled placeholders — never an empty panel pretending to be a search
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
