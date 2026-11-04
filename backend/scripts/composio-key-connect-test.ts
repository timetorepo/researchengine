// Composio connect for apps that sign in with a key (API key, bearer, basic) or with
// nothing at all. Composio is replaced by a stand-in fetch; no window is involved.
import { startConnect } from '../src/services/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const KEY = 'ak_connect_test_3'
type Seen = { method: string; path: string; body: any }
let seen: Seen[] = []
let live: any[] = []
let toolkit: any = {}
let accountStatus = 'ACTIVE'
const realFetch = globalThis.fetch
globalThis.fetch = (async (url: any, init: any) => {
  const headers = init?.headers ?? {}
  if (!String(headers['x-api-key'] ?? '').startsWith('ak_connect_test')) {
    return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
  }
  const path = String(url).replace('https://backend.composio.dev', '')
  const body = init?.body ? JSON.parse(init.body) : undefined
  seen.push({ method: init.method, path, body })
  const json = (status: number, v: unknown) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } })
  if (init.method === 'GET' && path.startsWith('/api/v3.1/toolkits/')) return json(200, toolkit)
  if (init.method === 'GET' && path.startsWith('/api/v3.1/toolkits')) return json(200, { items: [], total_items: 0 })
  if (init.method === 'GET' && path.startsWith('/api/v3.1/auth_configs')) return json(200, { items: live })
  if (init.method === 'POST' && path === '/api/v3.1/auth_configs') return json(200, { auth_config: { id: 'ac_new_key' } })
  if (init.method === 'POST' && path === '/api/v3.1/connected_accounts') {
    return json(200, { id: 'ca_key_1', status: accountStatus })
  }
  if (init.method === 'POST' && path === '/api/v3.1/connected_accounts/link') {
    return json(200, { redirect_url: 'https://composio.example/sign-in', connected_account_id: 'ca_link' })
  }
  return json(404, { error: { message: 'not found' } })
}) as typeof fetch

const base = { toolkit: 'posthog', userId: 'you@example.com', callbackUrl: 'http://127.0.0.1:3000/?composio=connected' }
const apiKeyToolkit = {
  slug: 'posthog',
  no_auth: false,
  auth_config_details: [
    { mode: 'API_KEY', fields: { connected_account_initiation: { required: [
      { name: 'generic_api_key', displayName: 'Personal API key', description: 'Starts with phx_', is_secret: true },
      { name: 'region', displayName: 'Region', description: 'us or eu', is_secret: false },
    ], optional: [] } } },
  ],
}

// 1. No values yet: nothing is created, and the caller is asked for the fields.
toolkit = apiKeyToolkit; live = []; seen = []
const a = await startConnect(KEY, base)
check('no values: asks for the key', !a.ok && a.code === 'needs_key' && a.status === 422, JSON.stringify(a))
check('no values: nothing created', !seen.some((s) => s.method === 'POST'))

// 2. Missing one required field: still asked, nothing created.
seen = []
const b = await startConnect(KEY, { ...base, fields: { generic_api_key: 'phx_abc' } })
check('partial values: asks for the region', !b.ok && b.code === 'needs_key' && /Region/.test(b.error), JSON.stringify(b))
check('partial values: nothing created', !seen.some((s) => s.method === 'POST'))

// 3. All values: an API_KEY auth config is created, then the connected account is active with the values.
seen = []
accountStatus = 'ACTIVE'
const c = await startConnect(KEY, { ...base, fields: { generic_api_key: ' phx_abc ', region: 'eu' } })
const cfg = seen.find((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs')
const acct = seen.find((s) => s.method === 'POST' && s.path === '/api/v3.1/connected_accounts')
check('key: connected', c.ok && c.value.connected === true && c.value.connectedAccountId === 'ca_key_1', JSON.stringify(c))
check('key: API_KEY config created with empty credentials', cfg?.body?.auth_config?.auth_scheme === 'API_KEY' && cfg?.body?.auth_config?.type === 'use_custom_auth' && Object.keys(cfg?.body?.auth_config?.credentials ?? {}).length === 0)
check('key: account uses the new config', acct?.body?.auth_config?.id === 'ac_new_key')
check('key: values trimmed and sent as state', acct?.body?.connection?.state?.authScheme === 'API_KEY' && acct?.body?.connection?.state?.val?.generic_api_key === 'phx_abc' && acct?.body?.connection?.state?.val?.region === 'eu' && acct?.body?.connection?.state?.val?.status === 'ACTIVE')
check('key: user id sent', acct?.body?.connection?.user_id === base.userId)
check('key: no redirect link requested', !seen.some((s) => s.path.endsWith('/link')))

// 4. A config for this scheme already exists: it is reused.
live = [{ id: 'ac_existing', auth_scheme: 'API_KEY', status: 'ENABLED', is_composio_managed: false }]
seen = []
const d = await startConnect(KEY, { ...base, fields: { generic_api_key: 'phx_abc', region: 'us' } })
check('key: existing config reused', d.ok && seen.find((s) => s.path === '/api/v3.1/connected_accounts')?.body?.auth_config?.id === 'ac_existing' && !seen.some((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs'))

// 5. Composio does not activate the account: the person is told, not shown a window.
live = []
seen = []
accountStatus = 'INITIATED'
const e = await startConnect(KEY, { ...base, fields: { generic_api_key: 'phx_bad', region: 'us' } })
check('key: non-active result is an error', !e.ok && /initiated/.test(e.error), JSON.stringify(e))
accountStatus = 'ACTIVE'

// 6. An app that offers OAuth too keeps the OAuth path (the redirect link), even with fields.
toolkit = {
  slug: 'supabase', no_auth: false,
  auth_config_details: [
    { mode: 'OAUTH2', fields: { connected_account_initiation: { required: [], optional: [] } } },
    { mode: 'API_KEY', fields: { connected_account_initiation: { required: [{ name: 'generic_api_key', displayName: 'Key' }], optional: [] } } },
  ],
}
live = [{ id: 'ac_oauth', auth_scheme: 'OAUTH2', status: 'ENABLED', is_composio_managed: true }]
seen = []
const f = await startConnect(KEY, { toolkit: 'supabase', userId: base.userId, callbackUrl: base.callbackUrl, fields: { generic_api_key: 'x' } })
check('oauth+key app: redirect path', f.ok && f.value.redirectUrl === 'https://composio.example/sign-in' && !seen.some((s) => s.path === '/api/v3.1/connected_accounts'))

// 7. No sign-in at all: the connection is created without credentials.
toolkit = { slug: 'hackernews', no_auth: true, auth_config_details: [] }
live = [{ id: 'ac_noauth', status: 'ENABLED', is_composio_managed: true }]
seen = []
const g = await startConnect(KEY, { toolkit: 'hackernews', userId: base.userId, callbackUrl: base.callbackUrl })
const noauthAcct = seen.find((s) => s.path === '/api/v3.1/connected_accounts')
check('no-auth: connected without state', g.ok && g.value.connected === true && noauthAcct?.body?.auth_config?.id === 'ac_noauth' && !noauthAcct?.body?.connection?.state)

globalThis.fetch = realFetch
console.log(`composio-key-connect-test: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
