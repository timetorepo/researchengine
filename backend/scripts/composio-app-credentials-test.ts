// Composio connect with the person's own developer app (Spotify and similar apps
// have no Composio-managed sign-in). Composio is replaced by a stand-in fetch.
import { COMPOSIO_OAUTH_CALLBACK, startConnect } from '../src/services/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const KEY = 'ak_connect_test_2'
type Seen = { method: string; path: string; body: any }
let seen: Seen[] = []
let existing: any[] = []
let postStatus = 200
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
  if (init.method === 'GET' && path.startsWith('/api/v3.1/toolkits')) return json(200, { items: [], total_items: 0 })
  if (init.method === 'GET' && path.startsWith('/api/v3.1/auth_configs')) return json(200, { items: existing })
  if (init.method === 'POST' && path === '/api/v3.1/auth_configs') {
    return postStatus === 200
      ? json(200, { auth_config: { id: 'ac_new' } })
      : json(postStatus, { error: { message: 'Composio does not manage auth for this toolkit.' } })
  }
  if (init.method === 'PATCH' && path.startsWith('/api/v3.1/auth_configs/')) return json(200, { auth_config: { id: 'ac_own' } })
  if (init.method === 'POST' && path === '/api/v3.1/connected_accounts/link') {
    return json(200, { redirect_url: 'https://composio.example/sign-in', connected_account_id: 'ca_1' })
  }
  return json(404, { error: { message: 'not found' } })
}) as typeof fetch

const base = { toolkit: 'spotify', userId: 'you@example.com', callbackUrl: 'http://127.0.0.1:3000/?composio=connected' }
const own = { clientId: 'client_abc123', clientSecret: 'secret_xyz789', scopes: 'user-library-read,playlist-modify-public' }

// 1. Own app, none saved yet: a custom auth config is created with the callback, then the link uses it.
existing = []
seen = []
postStatus = 200
const a = await startConnect(KEY, { ...base, appCredentials: own })
const postA = seen.find((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs')
check('own app: link ok', a.ok)
check('own app: custom config created', !!postA && postA.body?.auth_config?.type === 'use_custom_auth' && postA.body?.auth_config?.auth_scheme === 'OAUTH2')
check('own app: credentials and callback sent', postA?.body?.auth_config?.credentials?.client_id === own.clientId && postA?.body?.auth_config?.credentials?.oauth_redirect_uri === COMPOSIO_OAUTH_CALLBACK)
check('own app: scopes sent', postA?.body?.auth_config?.credentials?.scopes === own.scopes)
check('own app: link uses new config', seen.some((s) => s.path.endsWith('/link') && s.body?.auth_config_id === 'ac_new'))

// 2. Own app already configured by Research Engine: the config is updated in place, not duplicated.
existing = [{ id: 'ac_own', name: 'Research Engine · spotify', status: 'ENABLED', is_composio_managed: false }]
seen = []
const b = await startConnect(KEY, { ...base, appCredentials: { clientId: 'client_new1', clientSecret: 'secret_new_2' } })
check('reconnect: link ok', b.ok)
check('reconnect: PATCH not POST', seen.some((s) => s.method === 'PATCH' && s.path === '/api/v3.1/auth_configs/ac_own') && !seen.some((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs'))
check('reconnect: rotated secret sent', seen.find((s) => s.method === 'PATCH')?.body?.credentials?.client_secret === 'secret_new_2')
check('reconnect: link uses same config', seen.some((s) => s.path.endsWith('/link') && s.body?.auth_config_id === 'ac_own'))

// 3. Regression: a custom (non-managed) config that already exists is reused without any app credentials.
existing = [{ id: 'ac_custom', status: 'ENABLED', is_composio_managed: false }]
seen = []
const c = await startConnect(KEY, base)
check('custom config reused', c.ok && seen.some((s) => s.path.endsWith('/link') && s.body?.auth_config_id === 'ac_custom'))
check('custom config reused: nothing created', !seen.some((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs'))

// 4. No config and no own app, and Composio refuses a managed config: the caller is asked for an app.
existing = []
seen = []
postStatus = 400
const d = await startConnect(KEY, base)
check('needs app: refused with code', !d.ok && d.code === 'needs_app_credentials' && d.status === 409, JSON.stringify(d))
check('needs app: no link requested', !seen.some((s) => s.path.endsWith('/link')))

// 5. Managed config exists: used as before.
existing = [{ id: 'ac_managed', status: 'ENABLED', is_composio_managed: true }]
seen = []
postStatus = 200
const e = await startConnect(KEY, { ...base, toolkit: 'gmail' })
check('managed reused', e.ok && seen.some((s) => s.path.endsWith('/link') && s.body?.auth_config_id === 'ac_managed'))

globalThis.fetch = realFetch
console.log(`composio-app-credentials-test: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
