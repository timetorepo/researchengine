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
import { appRoot, installKind, sourceVersion, webBuild } from './build-info'
import { updateRoutes } from './routes/update'
import { linkRoutes } from './routes/link'
import { calendarRoutes } from './routes/calendar'
import { botWebRoutes } from './routes/botweb'
import { artifactRoutes } from './routes/artifacts'
import { bootUpdateCheck, handleFatalWithPending, rollbackAndRestart, scheduleHealthy } from './update/boot'
import { EXIT_RESTART } from './update/service'

/** Resolved by `main` before it can fail, so the fatal handler knows where the
 *  library is and therefore which paths a rollback may not touch. */
let fatalDataDir = ''

async function main() {
  // Resolve the runtime FIRST — db/index.ts reads DB_PATH at import time.
  const rt = await resolveRuntime(process.argv.slice(2))
  fatalDataDir = rt.dataDir

  // NOTE: every module that touches `db` must be imported *after*
  // `resolveRuntime`, because `db/index.ts` opens its database at import time
  // from `DB_PATH` — and that variable is only set once the runtime is
  // resolved. A static import above would open the database in the process's
  // working directory instead of the user's library. It did exactly that for
  // these three routes until the packaged-install test caught it.
  const { healthRoutes } = await import('./routes/health')
  const { feedbackRoutes } = await import('./routes/feedback')
  const { libraryRoutes } = await import('./routes/library')
  const { proxyRoutes } = await import('./routes/proxy')
  const { skillsRoutes } = await import('./routes/skills')
  const { strixRoutes } = await import('./routes/strix')
  const { jevRoutes } = await import('./routes/jev')
  const { dataRoutes } = await import('./routes/data')
  const { searchRoutes } = await import('./routes/search')
  const { learnRoutes } = await import('./routes/learn')
  const { sandboxRoutes } = await import('./routes/sandbox')
  const { personaRoutes } = await import('./routes/personas')
  const { chatRoutes } = await import('./routes/chat')
  const { documentRoutes } = await import('./routes/documents')
  const { ollamaRoutes } = await import('./routes/ollama')
  const { integrationRoutes } = await import('./routes/integrations')
  const { composioRoutes } = await import('./routes/composio')
  const { signinRoutes } = await import('./routes/signin')
  const { pipedreamRoutes } = await import('./routes/pipedream')
  const { harnessRoutes } = await import('./routes/harness')
  const { context7Routes } = await import('./routes/context7')
  const { serviceRoutes } = await import('./routes/services')
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
  app.route('/api/learn', learnRoutes)
  app.route('/api/sandbox', sandboxRoutes)
  app.route('/api/personas', personaRoutes)
  const { voiceRoutes } = await import('./routes/voice')
  app.route('/api', voiceRoutes)
  app.route('/api/chat', chatRoutes)
  app.route('/api/documents', documentRoutes)
  app.route('/api/ollama', ollamaRoutes)
  app.route('/api/integrations', integrationRoutes(rt))
  app.route('/api', composioRoutes(rt))
  app.route('/api', signinRoutes())
  app.route('/api', pipedreamRoutes(rt))
  app.route('/api', harnessRoutes(rt))
  app.route('/api', context7Routes(rt))
  app.route('/api', serviceRoutes(rt))
  app.route('/api', artifactRoutes(rt))
  app.route('/api', providerRoutes)
  // The updater. Everything it can touch is guarded inside update/service.ts.
  app.route('/api', updateRoutes(rt))
  app.route('/api', linkRoutes)
  app.route('/api/feedback', feedbackRoutes)
  app.route('/api/calendar', calendarRoutes)
  app.route('/api/bots/web', botWebRoutes)
  app.route('/api/library', libraryRoutes)
  app.route('/api/proxy', proxyRoutes)
  app.route('/api/skills', skillsRoutes)
  app.route('/api/strix', strixRoutes)
  app.route('/api/jev', jevRoutes)
  app.route('/api/data', dataRoutes)

  app.onError((err, c) => {
    // Surface the real error to the client — the UI shows it verbatim.
    return c.json({ error: err.message }, 500)
  })

  // ---- the JSON guarantee ----------------------------------------------------
  // Everything under /api answers JSON, including the paths this server does not
  // have. Without this, an unknown API path fell through to the SPA catch-all
  // below and came back as index.html with a 200 — which is how the Library got
  // "the local server answered /api/library/search?q=javascript&refresh=1 with
  // something that was not JSON": the server that answered was a build without
  // that route, and nothing in the response said so. Now the response says so
  // itself, in a sentence, with both versions in it.
  app.all('/api/*', (c) => {
    const path = new URL(c.req.url).pathname
    return c.json({
      error: `This server has no route for ${c.req.method} ${path}.`,
      code: 'no_such_route',
      hint: 'The app and its local server are different versions — they always ship together. Restart Research Engine, or install the latest version. Settings → About shows the version this server is running.',
      server: {
        version: sourceVersion() || 'dev',
        frontend: rt.frontendDist ? (webBuild(rt.frontendDist)?.version ?? 'unknown') : 'not served',
      },
    }, 404)
  })

  app.notFound((c) => {
    const path = new URL(c.req.url).pathname
    if (path === '/api' || path.startsWith('/api/')) {
      return c.json({ error: `No route for ${path}.`, code: 'no_such_route' }, 404)
    }
    return c.text('Not found', 404)
  })

  // Serve the built frontend when present (single-process mode).
  if (rt.frontendDist) {
    const handler = staticHandler(rt.frontendDist)
    app.get('*', handler)
  }

  // An update may be on trial (files swapped, this is the first boot of them).
  // Count the attempt; if this is a repeated failure, put the old version back
  // and restart into it instead of serving something that cannot stay up.
  const updateDeps = {
    appRoot: appRoot(), dataDir: rt.dataDir, currentVersion: sourceVersion() || webBuild(rt.frontendDist)?.version || 'dev',
    platform: process.platform, kind: installKind(),
    log: (m: string) => console.log(`[re] update: ${m}`),
  }
  const boot = bootUpdateCheck(updateDeps)
  if (rollbackAndRestart(updateDeps, boot)) {
    console.log('[re] rolled back a failed update — restarting the previous version')
    process.exit(EXIT_RESTART)
  }

  serve({ fetch: app.fetch, port: rt.port, hostname: rt.host }, (info) => {
    console.log(`Research Engine listening on http://${rt.host}:${info.port}`)
    console.log(`  data dir : ${rt.dataDir}`)
    console.log(`  profile  : ${rt.profile} (${rt.caps.floodWorkers} flood worker${rt.caps.floodWorkers > 1 ? 's' : ''}, ${rt.caps.concurrentStreams} concurrent stream${rt.caps.concurrentStreams > 1 ? 's' : ''})`)
    console.log(`  frontend : ${rt.frontendDist ?? 'not found — API only (run `npm run build` in frontend/ for single-process mode)'}${rt.frontendDist ? webBuildNote(rt) : ''}`)
    console.log(`  database : ${rt.dbPath}`)
    if (rt.rememberedPort) console.log(`  note     : preferred port was busy — using ${info.port} (remembered in config.json)`)
    if (boot.pending) console.log(`  update   : ${boot.pending.from} → ${boot.pending.to} on trial (attempt ${boot.attempts}) — kept once this build serves pages`)
    // Serving pages is the test. Only then does the swap become permanent.
    scheduleHealthy(updateDeps, boot)
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
  // If we are a freshly installed version that cannot even start, undo the
  // update and start the version that was working. Never leave the user with a
  // broken install after asking for an update.
  if (handleFatalWithPending({
    appRoot: appRoot(), dataDir: fatalDataDir, currentVersion: sourceVersion() || '0.0.0',
    platform: process.platform, kind: installKind(),
    log: (m: string) => console.log(`[re] update: ${m}`),
  }, e)) {
    console.log('[re] update rolled back — restarting the previous version')
    process.exit(EXIT_RESTART)
  }
  process.exit(1)
})
