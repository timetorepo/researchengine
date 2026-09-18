import { Hono } from 'hono'
import { searchSearxng, searchBrave, searchSerper, searchTavily, searchDdg, searchDemo } from '../services/search/adapters'

export const searchRoutes = new Hono()

// GET /api/search?q=...&backend=searxng
// Real search with graceful fallback: configured engine → keyless DuckDuckGo
// → clearly-labeled demo results. The response reports which engine answered.
searchRoutes.get('/', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Missing ?q=' }, 400)
  // Top Secret privacy mode forces offline=1: clearly-labeled local results,
  // zero external requests. The frontend decides the mode; the backend honors it.
  if (c.req.query('offline') === '1') {
    return c.json({ backend: 'demo', results: searchDemo(q) })
  }
  const requested = c.req.query('backend') ?? process.env.SEARCH_BACKEND ?? 'searxng'

  const run = async (backend: string) => {
    switch (backend) {
      case 'searxng': return searchSearxng(process.env.SEARXNG_URL ?? 'http://localhost:8080', q)
      case 'brave': return searchBrave(q)
      case 'serper': return searchSerper(q)
      case 'tavily': return searchTavily(q)
      case 'ddg': return searchDdg(q)
      default: return searchDemo(q)
    }
  }

  // 1) the requested engine
  try {
    const results = await run(requested)
    if (results.length) return c.json({ backend: requested, results })
  } catch { /* fall through to keyless ddg */ }

  // 2) keyless DuckDuckGo fallback (unless that was the requested engine)
  if (requested !== 'ddg') {
    try {
      const results = await searchDdg(q)
      if (results.length) return c.json({ backend: 'ddg', results })
    } catch { /* fall through to demo */ }
  }

  // 3) clearly-labeled offline demo results
  return c.json({ backend: 'demo', results: searchDemo(q) })
})
