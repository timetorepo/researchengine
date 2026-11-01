// Composio connect: the server finds or creates the sign-in config for an app, then
// asks Composio for the link to open. Composio is replaced by a stand-in fetch.
import { startConnect } from '../src/services/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const KEY = 'ak_connect_test_1'
type Seen = { method: string; path: string; body: any }
let seen: Seen[] = []
let existing: any[] = []
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
  if (init.method === 'POST' && path === '/api/v3.1/auth_configs') return json(200, { auth_config: { id: 'ac_new' } })
  if (init.method === 'POST' && path === '/api/v3.1/connected_accounts/link') {
    return json(200, { redirect_url: 'https://composio.example/sign-in', connected_account_id: 'ca_1' })
  }
  return json(404, { error: { message: 'not found' } })
}) as typeof fetch

const input = { toolkit: 'gmail', userId: 'you@example.com', callbackUrl: 'http://127.0.0.1:3000/?composio=connected' }

// No sign-in config yet: one is created, then the link is requested with it.
existing = []
seen = []
const created = await startConnect(KEY, input)
check('a link comes back', created.ok && created.value.redirectUrl === 'https://composio.example/sign-in', JSON.stringify(created))
check('a missing config is created as Composio-managed', seen.some((s) => s.path === '/api/v3.1/auth_configs' && s.body?.toolkit?.slug === 'gmail'))
const link = seen.find((s) => s.path === '/api/v3.1/connected_accounts/link')
check('the link names the config, user and return address', !!link && link.body.auth_config_id === 'ac_new' && link.body.user_id === input.userId && link.body.callback_url === input.callbackUrl, JSON.stringify(link))

// A config that already exists is reused: nothing is created.
existing = [{ id: 'ac_old', status: 'ENABLED', is_composio_managed: true }]
seen = []
const reused = await startConnect(KEY, input)
check('an existing config is reused', reused.ok && !seen.some((s) => s.method === 'POST' && s.path === '/api/v3.1/auth_configs'))
check('the link uses the existing config', seen.some((s) => s.path === '/api/v3.1/connected_accounts/link' && s.body.auth_config_id === 'ac_old'))

// A disabled config is not used.
existing = [{ id: 'ac_off', status: 'DISABLED', is_composio_managed: true }]
seen = []
await startConnect(KEY, input)
check('a disabled config is not used', seen.some((s) => s.path === '/api/v3.1/auth_configs' && s.method === 'POST'))

globalThis.fetch = realFetch
console.log(`composio-connect-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
