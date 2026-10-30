// Pipedream Connect, the second connector provider.
//
//   GET    /api/pipedream/status           do the credentials work (never echoes them)
//   GET    /api/pipedream/apps?q=&limit=   the catalogue
//   GET    /api/pipedream/accounts?user=   the accounts one user connected
//   POST   /api/pipedream/connect          start one sign-in → connectUrl (tracked as a flight)
//   DELETE /api/pipedream/accounts/:id     disconnect one account
//
// The credentials arrive base64-encoded in `x-re-pipedream` on every request and are
// used for that request only. Inputs are checked here before they reach Pipedream.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import { isSignInTarget, SIGNIN_ID, startSignIn } from '../services/signin'
import {
  checkPipedream, createPipedreamConnect, isPipedreamSlug, isPipedreamUser, listPipedreamAccounts, listPipedreamApps,
  parsePipedreamCredentials, removePipedreamAccount, type PipedreamCredentials, type PipedreamResult,
} from '../services/pipedream'

function credentialsOf(header: string | undefined): PipedreamCredentials | null {
  if (!header || header.length > 2000) return null
  try {
    return parsePipedreamCredentials(JSON.parse(Buffer.from(header, 'base64').toString('utf8')))
  } catch {
    return null
  }
}

/** Only an origin (scheme, host, port) may be used as the return address. */
function returnOrigin(raw: string): string | null {
  if (!isSignInTarget(raw)) return null
  try {
    const u = new URL(raw)
    if (u.pathname !== '/' || u.search || u.hash) return null
    return u.origin
  } catch {
    return null
  }
}

export function pipedreamRoutes(_rt?: Runtime) {
  const r = new Hono()

  const noCredentials = (c: any) => c.json({
    error: 'Add your Pipedream client ID, client secret and project in Marketplace → Pipedream first.',
    code: 'no_credentials',
  }, 400)

  const sendError = (c: any, res: Extract<PipedreamResult<unknown>, { ok: false }>) =>
    c.json({ error: res.error }, res.status >= 400 && res.status < 600 ? res.status : 502)

  r.get('/pipedream/status', async (c) => {
    const creds = credentialsOf(c.req.header('x-re-pipedream'))
    if (!creds) return noCredentials(c)
    const res = await checkPipedream(creds)
    if (!res.ok) return sendError(c, res)
    return c.json({ ok: true, environment: res.value.environment })
  })

  r.get('/pipedream/apps', async (c) => {
    const creds = credentialsOf(c.req.header('x-re-pipedream'))
    if (!creds) return noCredentials(c)
    const q = (c.req.query('q') ?? '').slice(0, 80)
    const limit = Number(c.req.query('limit') ?? 60)
    const res = await listPipedreamApps(creds, q, Number.isFinite(limit) ? limit : 60)
    if (!res.ok) return sendError(c, res)
    return c.json({ apps: res.value })
  })

  r.get('/pipedream/accounts', async (c) => {
    const creds = credentialsOf(c.req.header('x-re-pipedream'))
    if (!creds) return noCredentials(c)
    const user = (c.req.query('user') ?? '').trim()
    if (!isPipedreamUser(user)) return c.json({ error: 'A valid user id is needed.' }, 400)
    const res = await listPipedreamAccounts(creds, user)
    if (!res.ok) return sendError(c, res)
    return c.json({ accounts: res.value })
  })

  r.post('/pipedream/connect', async (c) => {
    const creds = credentialsOf(c.req.header('x-re-pipedream'))
    if (!creds) return noCredentials(c)
    const body = await c.req.json().catch(() => null) as any
    const app = typeof body?.app === 'string' ? body.app.trim() : ''
    const user = typeof body?.user === 'string' ? body.user.trim() : ''
    const flight = typeof body?.flight === 'string' ? body.flight.trim() : ''
    const origin = returnOrigin(typeof body?.returnTo === 'string' ? body.returnTo.trim() : '')
    if (!isPipedreamSlug(app)) return c.json({ error: 'That app name is not valid.' }, 400)
    if (!isPipedreamUser(user)) return c.json({ error: 'A valid user id is needed to connect an account.' }, 400)
    if (!SIGNIN_ID.test(flight)) return c.json({ error: 'That sign-in id is not valid.' }, 400)
    if (!origin) return c.json({ error: 'The return address is not valid.' }, 400)

    const done = `${origin}/api/signin/${flight}/done`
    const res = await createPipedreamConnect(creds, user, app, { success: done, error: done })
    if (!res.ok) return sendError(c, res)
    if (!startSignIn(flight, 'pipedream', res.value.connectUrl)) {
      return c.json({ error: 'Pipedream returned a connect link that cannot be tracked.' }, 502)
    }
    return c.json({ connectUrl: res.value.connectUrl, expiresAt: res.value.expiresAt })
  })

  r.delete('/pipedream/accounts/:id', async (c) => {
    const creds = credentialsOf(c.req.header('x-re-pipedream'))
    if (!creds) return noCredentials(c)
    const id = c.req.param('id')
    if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id)) return c.json({ error: 'That account id is not valid.' }, 400)
    const res = await removePipedreamAccount(creds, id)
    if (!res.ok) return sendError(c, res)
    return c.json(res.value)
  })

  return r
}
