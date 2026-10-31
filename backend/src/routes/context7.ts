// Documentation search through Context7, for the chat and the bots.
//
//   GET /api/context7/search?query=…&library=…   current docs for a question
//
// Works with no key (Context7 applies lower limits). An optional key arrives in
// `x-re-context7-key` for this request only and is not stored.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import { searchDocs } from '../services/context7'

export function context7Routes(_rt: Runtime) {
  const r = new Hono()

  r.get('/context7/search', async (c) => {
    const query = (c.req.query('query') ?? '').trim()
    if (query.length < 2) return c.json({ error: 'Say what the docs should answer.' }, 400)
    const library = (c.req.query('library') ?? '').trim()
    if (library.length > 300) return c.json({ error: 'Library names are too long.' }, 400)
    const key = (c.req.header('x-re-context7-key') ?? '').trim() || undefined
    const res = await searchDocs({ query, library, key })
    if (!res.ok) return c.json({ error: res.error }, res.status as 502)
    return c.json({ hits: res.hits })
  })

  return r
}
