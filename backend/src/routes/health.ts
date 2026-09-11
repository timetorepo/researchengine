import { Hono } from 'hono'
import { dbStats } from '../db'

export const healthRoutes = new Hono()

healthRoutes.get('/health', (c) =>
  c.json({ ok: true, service: 'research-engine-backend', time: new Date().toISOString(), db: dbStats() }),
)
