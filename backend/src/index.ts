// Research Engine backend — single-process server.
// Serves the API, SSE streams AND the built frontend from one Node process.
// Request bodies are NEVER logged.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { resolveRuntime, type Runtime } from './runtime'
import { staticHandler } from './static'
// Pure helpers — safe to import eagerly; the route itself is wired below.
import { sourceVersion, webBuild } from './build-info'

async function main() {
  // Resolve the runtime FIRST — db/index.ts reads DB_PATH at import time.
  const rt = await resolveRuntime(process.argv.slice(2))

  const { healthRoutes } = await import('./routes/health')
  const { searchRoutes } = await import('./routes/search')
  const { chatRoutes } = await import('./routes/chat')
  const { documentRoutes } = await import('./routes/documents')
  const { ollamaRoutes } = await import('./routes/ollama')
  const { integrationRoutes } = await import('./routes/integrations')
  const { resourceRoutes } = await import('./routes/resources')
  const { fsRoutes } = await import('./routes/fs')
  const { providerRoutes } = await import('./routes/providers')
  const { ideRoutes } = await import('./routes/ide')
  const { previewRoutes } = await import('./routes/preview')
  const { PreviewManager } = await import('./preview/manager')
  const { connectorRoutes } = await import('./routes/connectors')
  const { mcpRoutes } = await import('./routes/mcp')

  // One preview manager per process: it owns the dev servers started for
  // Coding / Design mode and the proxies the browser embeds.
  const previews = new PreviewManager()
  previewsForExit = previews

  const app = new Hono()

  app.use('*', cors())
  // Log method + path only — never bodies, never keys.
  app.use('*', logger((msg) => console.log(`[re] ${msg}`)))

  app.route('/api', healthRoutes(rt.frontendDist))
  app.route('/api', resourceRoutes(rt))
  app.route('/api', fsRoutes(rt))
  app.route('/api', ideRoutes(rt))
  app.route('/api', previewRoutes(rt, previews))
  app.route('/api', connectorRoutes(rt))
  app.route('/api', mcpRoutes())
  app.route('/api/search', searchRoutes)
  app.route('/api/chat', chatRoutes)
  app.route('/api/documents', documentRoutes)
  app.route('/api/ollama', ollamaRoutes)
  app.route('/api/integrations', integrationRoutes)
  app.route('/api', providerRoutes)

  app.onError((err, c) => {
    // Surface the real error to the client — the UI shows it verbatim.
    return c.json({ error: err.message }, 500)
  })

  // Serve the built frontend when present (single-process mode).
  if (rt.frontendDist) {
    const handler = staticHandler(rt.frontendDist)
    app.get('*', handler)
  }

  serve({ fetch: app.fetch, port: rt.port, hostname: rt.host }, (info) => {
    console.log(`Research Engine listening on http://${rt.host}:${info.port}`)
    console.log(`  data dir : ${rt.dataDir}`)
    console.log(`  profile  : ${rt.profile} (${rt.caps.floodWorkers} flood worker${rt.caps.floodWorkers > 1 ? 's' : ''}, ${rt.caps.concurrentStreams} concurrent stream${rt.caps.concurrentStreams > 1 ? 's' : ''})`)
    console.log(`  frontend : ${rt.frontendDist ?? 'not found — API only (run `npm run build` in frontend/ for single-process mode)'}${rt.frontendDist ? webBuildNote(rt) : ''}`)
    console.log(`  database : ${rt.dbPath}`)
    if (rt.rememberedPort) console.log(`  note     : preferred port was busy — using ${info.port} (remembered in config.json)`)
  })
}

/**
 * Print the fingerprint of the bundle being served next to the folder it came
 * from. A copy built before the last `git pull` is the usual reason a fix
 * "did not work" — this line makes that visible at startup instead.
 */
function webBuildNote(rt: Runtime): string {
  const served = webBuild(rt.frontendDist)
  if (!served) return ' (no build-info.json — rebuild the frontend to get a fingerprint)'
  const source = sourceVersion()
  const stale = source && served.version !== source ? ` — STALE, source is ${source} (run: npm run build)` : ''
  return ` [${served.version}]${stale}`
}

// Never leave orphaned dev servers behind when the backend goes down (or is
// restarted by tsx watch during development).
let previewsForExit: { stopAllSync: () => void } | null = null
process.on('exit', () => { try { previewsForExit?.stopAllSync() } catch { /* ignore */ } })
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => { try { previewsForExit?.stopAllSync() } catch { /* ignore */ } ; process.exit(0) })
}

main().catch((e) => {
  console.error('[re] fatal:', e)
  process.exit(1)
})
