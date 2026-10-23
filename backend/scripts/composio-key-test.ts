// Composio keys: the server finds which header a key belongs in, and says so when
// no kind of key is accepted. Composio itself is replaced by a stand-in fetch that
// accepts one header per key, the way the real service does.
import { checkKey, keyFingerprint } from '../src/services/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

// key → the one header that Composio accepts it in
const accepts: Record<string, string> = {
  'ak_project_123': 'x-api-key',
  'uak_user_456': 'x-user-api-key',
  'org_789': 'x-org-api-key',
}
let calls: string[] = []
let network = false
const realFetch = globalThis.fetch
globalThis.fetch = (async (url: any, init: any) => {
  if (network) throw new Error('offline')
  const headers = init?.headers ?? {}
  const pair = Object.entries(headers).find(([k]) => k.startsWith('x-') && k !== 'x-user-agent')
  const header = pair?.[0] ?? ''
  const key = String(pair?.[1] ?? '')
  calls.push(header)
  const ok = accepts[key] === header
  return new Response(JSON.stringify(ok ? { items: [], total_items: 7 } : { error: { message: 'Invalid API key' } }), {
    status: ok ? 200 : 401,
    headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

for (const key of Object.keys(accepts)) {
  calls = []
  const r = await checkKey(key)
  check(`${key.split('_')[0]}… key is accepted`, r.ok, JSON.stringify(r))
  check(`${key.split('_')[0]}… key goes in ${accepts[key]}`, calls[calls.length - 1] === accepts[key], calls.join(','))
}

// Once found, the header is remembered: a second check makes one request per check, not three.
calls = []
await checkKey('ak_project_123')
check('a known project key is one request', calls.length === 1 && calls[0] === 'x-api-key', calls.join(','))

// Nothing accepts it: a clear message, and the key is not echoed.
calls = []
const bad = await checkKey('nope_secret_value')
check('an unknown key is refused', !bad.ok && bad.status === 401, JSON.stringify(bad))
check('the refusal names where to find the key', !bad.ok && /Project Settings/.test(bad.error), JSON.stringify(bad))
check('the refusal does not echo the key', !(!bad.ok && bad.error.includes('nope_secret_value')))
check('the key was tried in all three headers', calls.join(',') === 'x-api-key,x-user-api-key,x-org-api-key', calls.join(','))

// A network failure is not a verdict on the key kind: no header guessing.
network = true
calls = []
const off = await checkKey('ak_offline_1')
network = false
check('a network failure is reported as such', !off.ok && off.status === 502, JSON.stringify(off))
check('no further headers are tried after a network failure', calls.length === 0, calls.join(','))

check('the fingerprint is not the key', keyFingerprint('ak_project_123') !== 'ak_project_123' && keyFingerprint('ak_project_123').length === 16)

globalThis.fetch = realFetch
console.log(`composio-key-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
