// The Composio gateway.
//
//   GET    /api/composio/status            does the key work (never echoes it)
//   GET    /api/composio/apps              every app Composio supports
//   GET    /api/composio/accounts          the apps this user has connected
//   POST   /api/composio/connect           start sign-in for one app → redirectUrl
//   DELETE /api/composio/accounts/:id      disconnect one account
//   GET    /api/composio/tools             tools of one app (to pick an action)
//   POST   /api/composio/execute           run one tool on a connected account
//
// The project key arrives in `x-re-composio-key` on every request and is used for
// that request only. Inputs are checked here before they reach Composio.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import {
  checkKey, executeTool, isToolSlug, isToolkitSlug, listAccounts, listApps, listTools, removeAccount, startConnect,
} from '../services/composio'

const USER = /^[A-Za-z0-9_.@:-]{1,128}$/

export function composioRoutes(_rt: Runtime) {
  const r = new Hono()

  const keyOf = (c: { req: { header: (n: string) => string | undefined } }) => (c.req.header('x-re-composio-key') ?? '').trim()
  const noKey = (c: any) => c.json({ error: 'No Composio key. Add it under Connectors.', needs: 'key' }, 401)
  const fail = (c: any, r: { error: string; status: number }) => c.json({ error: r.error }, r.status as 400)
  const userOf = (raw: unknown): string | null => {
    const v = typeof raw === 'string' ? raw.trim() : ''
    return USER.test(v) ? v : null
  }

  r.get('/composio/status', async (c) => {
    const key = keyOf(c)
    if (!key) return c.json({ configured: false })
    const res = await checkKey(key)
    if (!res.ok) return c.json({ configured: true, ok: false, error: res.error })
    return c.json({ configured: true, ok: true, apps: res.value.apps })
  })

  r.get('/composio/apps', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const res = await listApps(key, { refresh: c.req.query('refresh') === '1' })
    if (!res.ok) return fail(c, res)
    const q = (c.req.query('q') ?? '').trim().toLowerCase()
    const apps = q
      ? res.value.filter((a) => `${a.name} ${a.slug} ${a.description} ${a.categories.join(' ')}`.toLowerCase().includes(q))
      : res.value
    return c.json({ apps, total: res.value.length })
  })

  r.get('/composio/accounts', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const user = userOf(c.req.query('user'))
    if (!user) return c.json({ error: 'A valid user id is needed to list accounts.' }, 400)
    const res = await listAccounts(key, user)
    if (!res.ok) return fail(c, res)
    return c.json({ accounts: res.value })
  })

  r.post('/composio/connect', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const body = await c.req.json().catch(() => null) as any
    const toolkit = typeof body?.toolkit === 'string' ? body.toolkit.trim() : ''
    const user = userOf(body?.user)
    const callbackUrl = typeof body?.callbackUrl === 'string' ? body.callbackUrl.trim() : ''
    if (!isToolkitSlug(toolkit)) return c.json({ error: 'That app name is not valid.' }, 400)
    if (!user) return c.json({ error: 'A valid user id is needed to connect an account.' }, 400)
    if (!/^https?:\/\//i.test(callbackUrl) || callbackUrl.length > 500) return c.json({ error: 'The return address is not valid.' }, 400)
    const res = await startConnect(key, { toolkit, userId: user, callbackUrl })
    if (!res.ok) return fail(c, res)
    return c.json(res.value)
  })

  r.delete('/composio/accounts/:id', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const id = c.req.param('id')
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return c.json({ error: 'That account id is not valid.' }, 400)
    const res = await removeAccount(key, id)
    if (!res.ok) return fail(c, res)
    return c.json(res.value)
  })

  r.get('/composio/tools', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const toolkit = (c.req.query('toolkit') ?? '').trim()
    if (!isToolkitSlug(toolkit)) return c.json({ error: 'That app name is not valid.' }, 400)
    const res = await listTools(key, toolkit)
    if (!res.ok) return fail(c, res)
    return c.json({ tools: res.value })
  })

  r.post('/composio/execute', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const body = await c.req.json().catch(() => null) as any
    const tool = typeof body?.tool === 'string' ? body.tool.trim() : ''
    const user = userOf(body?.user)
    const connectedAccountId = typeof body?.connectedAccountId === 'string' ? body.connectedAccountId.trim() : undefined
    const args = body?.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments) ? body.arguments : {}
    if (!isToolSlug(tool)) return c.json({ error: 'That tool name is not valid.' }, 400)
    if (!user) return c.json({ error: 'A valid user id is needed to run a tool.' }, 400)
    if (connectedAccountId && !/^[A-Za-z0-9_-]{1,80}$/.test(connectedAccountId)) return c.json({ error: 'That account id is not valid.' }, 400)
    if (JSON.stringify(args).length > 20_000) return c.json({ error: 'The arguments are too large.' }, 400)
    const res = await executeTool(key, { tool, userId: user, connectedAccountId, arguments: args })
    if (!res.ok) return fail(c, res)
    return c.json(res.value)
  })

  return r
}
