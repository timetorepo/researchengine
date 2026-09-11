// Research Engine backend — Hono on Node. Edge-ready, minimal, privacy-first:
// request bodies are NEVER logged.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthRoutes } from './routes/health'
import { searchRoutes } from './routes/search'
import { chatRoutes } from './routes/chat'
import { documentRoutes } from './routes/documents'
import { ollamaRoutes } from './routes/ollama'
import { integrationRoutes } from './routes/integrations'

const app = new Hono()

app.use('*', cors())
// Log method + path only — never bodies, never keys.
app.use('*', logger((msg) => console.log(`[re] ${msg}`)))

app.route('/api', healthRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/documents', documentRoutes)
app.route('/api/ollama', ollamaRoutes)
app.route('/api/integrations', integrationRoutes)

app.onError((err, c) => {
  // Surface the real error to the client — the UI shows it verbatim.
  return c.json({ error: err.message }, 500)
})

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Research Engine backend listening on :${info.port}`)
})
