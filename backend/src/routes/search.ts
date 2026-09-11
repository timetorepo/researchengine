import { Hono } from 'hono'
import { searchSearxng, searchBrave, searchSerper, searchTavily, searchDdg, searchDemo } from '../services/search/adapters'

export const searchRoutes = new Hono()

// GET /api/search?q=...&backend=searxng
searchRoutes.get('/', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Missing ?q=' }, 400)
  const backend = c.req.query('backend') ?? process.env.SEARCH_BACKEND ?? 'searxng'

  try {
    switch (backend) {
      case 'searxng':
        return c.json({ results: await searchSearxng(process.env.SEARXNG_URL ?? 'http://localhost:8080', q) })
      case 'brave':
        return c.json({ results: await searchBrave(q) })
      case 'serper':
        return c.json({ results: await searchSerper(q) })
      case 'tavily':
        return c.json({ results: await searchTavily(q) })
      case 'ddg':
        return c.json({ results: await searchDdg(q) })
      default:
        return c.json({ results: searchDemo(q) })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 502)
  }
})
