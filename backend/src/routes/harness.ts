/**
 * The agent harness over HTTP.
 *
 *   GET    /harness/profiles                  the boot profiles
 *   GET    /harness/sessions                  session list, newest first
 *   POST   /harness/sessions                  create { profile, project?, title? }
 *   GET    /harness/sessions/:id              the full log (for resume and replay)
 *   DELETE /harness/sessions/:id              delete a session
 *   POST   /harness/sessions/:id/fork         fork at an event { at }
 *   GET    /harness/search?q=                 search every session's text
 *   POST   /harness/sessions/:id/turn         run one turn; streams events (SSE)
 *
 * The model key arrives in the turn body, is used for that request only, and
 * is never logged or stored. Shell runs only when the turn says approve: true,
 * and only through the IDE's agent-access check.
 */
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { stat } from 'node:fs/promises'
import type { Runtime } from '../runtime'
import { harnessFor } from '../harness'
import { PROFILES, isProfileId } from '../harness/profiles'
import { getAccess } from '../services/agent-access'
import { projectDirOf, projectsRootOf } from '../preview/paths'

const ID = /^[0-9a-f-]{36}$/

export function harnessRoutes(rt: Runtime) {
  const r = new Hono()
  const h = () => harnessFor(rt.dataDir)
  const projectsRoot = projectsRootOf(rt.dataDir)

  r.get('/harness/profiles', (c) => c.json({
    profiles: Object.entries(PROFILES).map(([id, p]) => ({ id, title: p.title, description: p.description, tools: p.tools, maxSteps: p.maxSteps })),
  }))

  r.get('/harness/sessions', async (c) => c.json({ sessions: await h().sessions.list() }))

  r.post('/harness/sessions', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    if (!isProfileId(body.profile ?? 'minimal')) return c.json({ error: 'Unknown profile.' }, 400)
    let project: string | null = null
    if (body.project) {
      const dir = projectDirOf(projectsRoot, String(body.project))
      if (!dir || !(await stat(dir).then((s) => s.isDirectory(), () => false))) {
        return c.json({ error: 'That project is not in your Coding projects.' }, 400)
      }
      project = String(body.project)
    }
    const s = await h().sessions.create({ profile: body.profile ?? 'minimal', workspace: project, title: typeof body.title === 'string' ? body.title : undefined })
    return c.json({ session: s }, 201)
  })

  r.get('/harness/sessions/:id', async (c) => {
    const id = c.req.param('id')
    if (!ID.test(id)) return c.json({ error: 'Invalid session id.' }, 400)
    const events = await h().sessions.read(id)
    if (!events.length) return c.json({ error: 'Session not found.' }, 404)
    return c.json({ events })
  })

  r.delete('/harness/sessions/:id', async (c) => {
    const id = c.req.param('id')
    if (!ID.test(id)) return c.json({ error: 'Invalid session id.' }, 400)
    await h().sessions.remove(id)
    return c.json({ ok: true })
  })

  r.post('/harness/sessions/:id/fork', async (c) => {
    const id = c.req.param('id')
    if (!ID.test(id)) return c.json({ error: 'Invalid session id.' }, 400)
    const body = await c.req.json().catch(() => ({}))
    try {
      return c.json({ session: await h().sessions.fork(id, Number(body.at)) }, 201)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Could not fork.' }, 400)
    }
  })

  r.get('/harness/search', async (c) => {
    const q = c.req.query('q') ?? ''
    return c.json({ results: await h().sessions.search(q, 30) })
  })

  r.post('/harness/sessions/:id/turn', async (c) => {
    const id = c.req.param('id')
    if (!ID.test(id)) return c.json({ error: 'Invalid session id.' }, 400)
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.text !== 'string' || !body.text.trim()) return c.json({ error: 'Write a message first.' }, 400)
    if (body.text.length > 20_000) return c.json({ error: 'That message is too long (20,000 characters at most).' }, 413)
    const model = body.model ?? {}
    if (typeof model.base !== 'string' || typeof model.model !== 'string') return c.json({ error: 'A model base URL and name are required.' }, 400)

    const harness = h()
    const events = await harness.sessions.read(id)
    if (!events.length) return c.json({ error: 'Session not found.' }, 404)
    const header = events[0]
    const profile = isProfileId(header.profile) ? header.profile : 'minimal'
    const workspace = header.workspace ? projectDirOf(projectsRoot, header.workspace) : null
    const access = await getAccess(rt.dataDir)

    return streamSSE(c, async (stream) => {
      const controller = new AbortController()
      // Stop the turn when the client goes away: the model call and any shell command are aborted.
      c.req.raw.signal.addEventListener('abort', () => controller.abort(), { once: true })
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ session: id, profile }) })
      // Events are written in order, one after another, so 'end' always comes last.
      let chain: Promise<unknown> = Promise.resolve()
      const send = (event: string, data: unknown) => {
        chain = chain.then(() => stream.writeSSE({ event, data: JSON.stringify(data) })).catch(() => {})
      }
      const result = await harness.agent.run({
        sessionId: id,
        text: body.text,
        profile,
        target: { base: model.base, model: model.model, key: typeof model.key === 'string' ? model.key : '' },
        workspace,
        approve: body.approve === true,
        access,
        signal: controller.signal,
        onEvent: (e) => send(e.type, e),
      })
      send('end', result)
      await chain
    })
  })

  return r
}
