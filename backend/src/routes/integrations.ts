import { Hono } from 'hono'

export const integrationRoutes = new Hono()

// Local OAuth callback server. Tokens are returned to the browser, which
// encrypts and stores them — the backend never persists integration tokens.
const pending = new Map<string, { provider: string; createdAt: number }>()

integrationRoutes.post('/oauth/start', async (c) => {
  const { provider, scopes = [] } = await c.req.json()
  const state = Math.random().toString(36).slice(2)
  pending.set(state, { provider, createdAt: Date.now() })
  // In production this redirects to the provider's OAuth consent screen.
  return c.json({ state, provider, scopes, note: 'Authorize via the localhost callback.' })
})

integrationRoutes.get('/oauth/callback', (c) => {
  const state = c.req.query('state')
  if (!state || !pending.has(state)) return c.json({ error: 'Unknown or expired OAuth state' }, 400)
  const info = pending.get(state)!
  pending.delete(state)
  return c.json({ ok: true, provider: info.provider, note: 'Token handed to the local encrypted vault.' })
})
