// The Composio gateway.
//
//   GET    /api/composio/status            does the key work (never echoes it)
//   POST   /api/composio/open              open a sign-in link in the default browser
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
import { openInDefaultBrowser } from '../services/browser'
import {
  checkKey, executeTool, isToolSlug, isToolkitSlug, listAccounts, listApps, listTools, removeAccount, startConnect, toolkitAuth, type AppCredentials,
} from '../services/composio'

const USER = /^[A-Za-z0-9_.@:-]{1,128}$/

export function composioRoutes(_rt: Runtime) {
  const r = new Hono()

  const keyOf = (c: { req: { header: (n: string) => string | undefined } }) => (c.req.header('x-re-composio-key') ?? '').trim()
  const noKey = (c: any) => c.json({ error: 'No Composio key. Add it under Connectors.', needs: 'key' }, 401)
  const fail = (c: any, r: { error: string; status: number; code?: string }) =>
    c.json(r.code ? { error: r.error, code: r.code } : { error: r.error }, r.status as 400)
  /** The person's own developer app, sent per request. Strict length and character limits. */
  const parseAppCredentials = (raw: unknown): AppCredentials | undefined => {
    if (raw === undefined || raw === null) return undefined
    if (typeof raw !== 'object') return undefined
    const o = raw as Record<string, unknown>
    const clientId = typeof o.clientId === 'string' ? o.clientId.trim() : ''
    const clientSecret = typeof o.clientSecret === 'string' ? o.clientSecret.trim() : ''
    const scopes = typeof o.scopes === 'string' ? o.scopes.trim() : ''
    if (!/^[\x21-\x7e]{4,200}$/.test(clientId) || !/^[\x21-\x7e]{8,300}$/.test(clientSecret)) return undefined
    if (scopes.length > 500 || /[\x00-\x1f]/.test(scopes)) return undefined
    return { clientId, clientSecret, ...(scopes ? { scopes } : {}) }
  }
  /** Key-based sign-in values (API key, token, subdomain …), sent per request and never stored here. */
  const parseFields = (raw: unknown): Record<string, string> | undefined => {
    if (raw === undefined || raw === null) return undefined
    if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9_]{1,64}$/.test(k) || typeof v !== 'string' || v.length > 2000) return undefined
      out[k] = v
    }
    return out
  }
  const userOf = (raw: unknown): string | null => {
    const v = typeof raw === 'string' ? raw.trim() : ''
    return USER.test(v) ? v : null
  }

  r.get('/composio/status', async (c) => {
    const key = keyOf(c)
    if (!key) return c.json({ configured: false })
    const res = await checkKey(key)
    if (!res.ok) return c.json({ configured: true, ok: false, error: res.error })
    void listApps(key) // warm the catalog so the marketplace opens with the list
    return c.json({ configured: true, ok: true, apps: res.value.apps })
  })

  // Sign-in pages open in the person's own browser. Only https links are accepted.
  r.post('/composio/open', async (c) => {
    const body = await c.req.json().catch(() => null) as any
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (url.length > 2000 || !/^https:\/\/[^\s]+$/i.test(url)) {
      return c.json({ error: 'Only https sign-in links can be opened.' }, 400)
    }
    const res = await openInDefaultBrowser(url)
    if (!res.ok) return c.json({ error: res.error }, 500)
    return c.json({ opened: true })
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
    const appCredentials = parseAppCredentials(body?.appCredentials)
    if (body?.appCredentials !== undefined && !appCredentials) {
      return c.json({ error: 'The app client id and secret are not valid.' }, 400)
    }
    const fields = parseFields(body?.fields)
    if (body?.fields !== undefined && !fields) return c.json({ error: 'The sign-in values are not valid.' }, 400)
    const res = await startConnect(key, { toolkit, userId: user, callbackUrl, appCredentials, fields })
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

  r.get('/composio/toolkit-auth', async (c) => {
    const key = keyOf(c)
    if (!key) return noKey(c)
    const toolkit = (c.req.query('toolkit') ?? '').trim()
    if (!isToolkitSlug(toolkit)) return c.json({ error: 'That app name is not valid.' }, 400)
    const res = await toolkitAuth(key, toolkit)
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
