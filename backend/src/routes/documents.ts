import { Hono } from 'hono'
import { db } from '../db'

export const documentRoutes = new Hono()

// Server-side document store (Docker mode). The browser also extracts locally;
// this endpoint persists to SQLite for cross-session access.
documentRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { id, name, kind = 'file', text = '' } = body
  if (!id || !name) return c.json({ error: 'id and name are required' }, 400)
  db.insertDocument({ id, name, kind, text, addedAt: Date.now() })
  return c.json({ ok: true, id })
})

documentRoutes.get('/', (c) => c.json({ documents: db.listDocuments() }))
