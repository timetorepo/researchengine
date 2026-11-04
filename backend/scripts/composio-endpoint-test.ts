// Advanced → Composio endpoint. Checks the rule (https anywhere, http only on this
// machine), that the endpoint travels per request, that it changes the cache identity,
// and that the route refuses a bad address before any request leaves the server.
import { Hono } from 'hono'
import {
  COMPOSIO_BASE, composioBase, keyFingerprint, normalizeComposioBase, runWithComposioBase,
} from '../src/services/composio'
import { composioRoutes } from '../src/routes/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

// --- the rule -------------------------------------------------------------
const ok = (raw: string) => { const r = normalizeComposioBase(raw); return r.ok ? r.value : null }
check('empty means hosted', ok('') === COMPOSIO_BASE)
check('whitespace means hosted', ok('   ') === COMPOSIO_BASE)
check('https is accepted', ok('https://composio.corp.internal') === 'https://composio.corp.internal')
check('trailing slash is trimmed', ok('https://composio.corp.internal/') === 'https://composio.corp.internal')
check('path prefix kept', ok('https://gw.example.com/composio/') === 'https://gw.example.com/composio')
check('localhost http allowed', ok('http://localhost:8080') === 'http://localhost:8080')
check('127.0.0.1 http allowed', ok('http://127.0.0.1:9000') === 'http://127.0.0.1:9000')
check('remote http refused', ok('http://composio.example.com') === null)
check('ftp refused', ok('ftp://composio.example.com') === null)
check('credentials refused', ok('https://user:pass@composio.example.com') === null)
check('query refused', ok('https://composio.example.com/?key=1') === null)
check('fragment refused', ok('https://composio.example.com/#x') === null)
check('not a url refused', ok('composio gateway') === null)
check('overlong refused', ok('https://' + 'a'.repeat(400) + '.com') === null)

// --- per request ------------------------------------------------------------
check('default base is hosted', composioBase() === COMPOSIO_BASE)
const inside = await runWithComposioBase('https://gw.example.com', async () => composioBase())
check('base inside a request scope', inside === 'https://gw.example.com')
check('base is restored after the scope', composioBase() === COMPOSIO_BASE)

const fpHosted = keyFingerprint('ak_project_123')
const fpSelf = await runWithComposioBase('https://gw.example.com', async () => keyFingerprint('ak_project_123'))
check('same key, different endpoint, different cache identity', fpHosted !== fpSelf)
check('fingerprint never contains the key', !fpHosted.includes('ak_project'))

// --- the route --------------------------------------------------------------
const app = new Hono()
app.route('/api', composioRoutes({} as any))

let fetched: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (url: any, init: any) => {
  fetched.push(String(url))
  const headers = init?.headers ?? {}
  // A stand-in gateway that accepts the project key in x-api-key, like the real service.
  if (headers['x-api-key'] === 'ak_project_123') {
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response('{}', { status: 401 })
}) as typeof fetch

const bad = await app.request('/api/composio/status', {
  headers: { 'x-re-composio-key': 'ak_project_123', 'x-re-composio-base': 'http://evil.example.com' },
})
check('route refuses a remote http endpoint with 400', bad.status === 400, `status ${bad.status}`)
check('refused endpoint never reaches fetch', fetched.length === 0, fetched.join(', '))

const good = await app.request('/api/composio/status', {
  headers: { 'x-re-composio-key': 'ak_project_123', 'x-re-composio-base': 'https://gw.example.com/' },
})
check('route accepts a valid endpoint', good.status === 200, `status ${good.status}`)
check('request goes to the self-hosted gateway', fetched.some((u) => u.startsWith('https://gw.example.com/api/v3.1/')), fetched.join(', '))
check('request never goes to the hosted API when an endpoint is set', fetched.every((u) => !u.startsWith(COMPOSIO_BASE)), fetched.join(', '))

fetched = []
const hosted = await app.request('/api/composio/status', { headers: { 'x-re-composio-key': 'ak_project_123' } })
check('no endpoint header means hosted', hosted.status === 200 && fetched.every((u) => u.startsWith(COMPOSIO_BASE)), fetched.join(', '))

globalThis.fetch = realFetch
console.log(`composio-endpoint-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
