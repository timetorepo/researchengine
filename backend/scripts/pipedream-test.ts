// Pipedream provider: credential rules, token caching, the catalogue and account
// mapping, the connect link, the error wording, and the route's input checks.
// Pipedream is stubbed with a fake fetch, so nothing leaves this machine.
import { Hono } from 'hono'
import {
  clearPipedreamTokens, createPipedreamConnect, isPipedreamSlug, listPipedreamAccounts, listPipedreamApps,
  parsePipedreamCredentials, pipedreamAccessToken, removePipedreamAccount, type PipedreamCredentials,
} from '../src/services/pipedream'
import { pipedreamRoutes } from '../src/routes/pipedream'
import { getSignIn } from '../src/services/signin'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const GOOD = { clientId: 'cid_123', clientSecret: 'sec_456', projectId: 'proj_abcd1234', environment: 'development' }
const CREDS = GOOD as PipedreamCredentials

// --- the credential rule ------------------------------------------------------
check('good credentials parse', parsePipedreamCredentials(GOOD) !== null)
check('missing secret refused', parsePipedreamCredentials({ ...GOOD, clientSecret: '' }) === null)
check('project without proj_ refused', parsePipedreamCredentials({ ...GOOD, projectId: 'abcd1234' }) === null)
check('unknown environment refused', parsePipedreamCredentials({ ...GOOD, environment: 'staging' }) === null)
check('null refused', parsePipedreamCredentials(null) === null)
check('app slug accepted', isPipedreamSlug('google_sheets'))
check('slug with slash refused', !isPipedreamSlug('../x'))

// --- fake Pipedream -------------------------------------------------------------
type Hit = { method: string; url: string; headers: Record<string, string>; body: any }
let hits: Hit[] = []
let tokenCalls = 0
let answer: (h: Hit) => { status: number; body: any } = () => ({ status: 200, body: {} })
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input)
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]))
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
  const h: Hit = { method: init.method ?? 'GET', url, headers, body }
  hits.push(h)
  if (url.endsWith('/oauth/token')) tokenCalls++
  const out = url.endsWith('/oauth/token') ? { status: 200, body: { access_token: 'tok_' + tokenCalls, expires_in: 3600 } } : answer(h)
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

async function run() {
  // --- token ----------------------------------------------------------------
  clearPipedreamTokens()
  const t1 = await pipedreamAccessToken(CREDS, 0)
  const t2 = await pipedreamAccessToken(CREDS, 1000)
  check('token issued', t1.ok && t1.value === 'tok_1')
  check('token cached between calls', t2.ok && t2.value === 'tok_1' && tokenCalls === 1, String(tokenCalls))
  const t3 = await pipedreamAccessToken(CREDS, 56 * 60_000)
  check('token refreshed before expiry', t3.ok && t3.value === 'tok_2', JSON.stringify(t3))
  const tokenHit = hits.find((h) => h.url.endsWith('/oauth/token'))
  check('token request is client credentials', tokenHit?.body?.grant_type === 'client_credentials' && tokenHit?.body?.client_id === 'cid_123')

  // --- catalogue ------------------------------------------------------------
  answer = () => ({ status: 200, body: { data: [
    { name_slug: 'github', name: 'GitHub', description: 'Code', img_src: 'https://x/g.png', auth_type: 'oauth', categories: ['Developer Tools', 'x'] },
    { name: 'no slug' },
    { name_slug: 'notion', name: 'Notion', auth_type: 'oauth', categories: 'bad' },
  ] } })
  hits = []
  const apps = await listPipedreamApps(CREDS, 'git', 500)
  check('apps mapped and bad rows dropped', apps.ok && apps.value.length === 2, JSON.stringify(apps))
  check('apps keep categories as a list', apps.ok && apps.value[0].categories.length === 2 && apps.value[1].categories.length === 0)
  const appHit = hits.find((h) => h.url.includes('/connect/apps'))
  check('apps request carries environment header', appHit?.headers['x-pd-environment'] === 'development')
  check('apps request uses the bearer token', appHit?.headers.authorization === 'Bearer tok_2' || appHit?.headers.authorization?.startsWith('Bearer tok_'))
  check('apps limit is capped at 100', (appHit?.url ?? '').includes('limit=100'), appHit?.url)
  check('apps query is passed', (appHit?.url ?? '').includes('q=git'))

  // --- accounts -------------------------------------------------------------
  answer = () => ({ status: 200, body: { data: [
    { id: 'apn_1', name: 'Me', healthy: true, app: { name_slug: 'github' } },
    { id: 'apn_2', app_slug: 'notion', healthy: false },
    { id: 'apn_3' },
  ] } })
  const accs = await listPipedreamAccounts(CREDS, 'user-1')
  check('accounts mapped', accs.ok && accs.value.length === 2 && accs.value[0].app === 'github' && accs.value[1].healthy === false, JSON.stringify(accs))
  const accHit = hits.at(-1)
  check('accounts path is per project and user', (accHit?.url ?? '').endsWith('/connect/proj_abcd1234/users/user-1/accounts'), accHit?.url)

  // --- connect link ---------------------------------------------------------
  answer = () => ({ status: 200, body: { token: 'ctok', expires_at: '2026-10-30T12:00:00Z', connect_link_url: 'https://pipedream.com/_static/connect.html?token=ctok&connectLink=true' } })
  hits = []
  const link = await createPipedreamConnect(CREDS, 'user-1', 'github', {
    success: 'http://localhost:5173/api/signin/x/done', error: 'http://localhost:5173/api/signin/x/done',
  })
  const tokHit = hits.find((h) => h.url.endsWith('/connect/proj_abcd1234/tokens'))
  check('connect token request body', tokHit?.body?.external_user_id === 'user-1' && tokHit?.body?.success_redirect_uri?.endsWith('/done'))
  check('connect link keeps its token and adds the app', link.ok && link.value.connectUrl.includes('token=ctok') && link.value.connectUrl.includes('app=github'), JSON.stringify(link))

  answer = () => ({ status: 200, body: { token: 'x', connect_link_url: 'http://insecure.example/x' } })
  const insecure = await createPipedreamConnect(CREDS, 'user-1', 'github', { success: 'a', error: 'a' })
  check('non-https connect link refused', !insecure.ok)

  // --- errors -----------------------------------------------------------------
  answer = () => ({ status: 404, body: { error: 'project not found' } })
  const nf = await listPipedreamAccounts(CREDS, 'user-1')
  check('404 explained', !nf.ok && nf.status === 404 && nf.error.includes('project ID'), JSON.stringify(nf))
  answer = () => ({ status: 429, body: {} })
  const rl = await listPipedreamApps(CREDS, '', 10)
  check('429 explained', !rl.ok && rl.status === 429 && rl.error.includes('rate-limiting'))
  answer = () => ({ status: 500, body: { message: 'boom' } })
  const other = await removePipedreamAccount(CREDS, 'apn_1')
  check('other errors show Pipedream text', !other.ok && other.error.includes('boom'))

  globalThis.fetch = (async () => { throw Object.assign(new Error('nope'), { name: 'TypeError' }) }) as typeof fetch
  clearPipedreamTokens()
  const offline = await pipedreamAccessToken(CREDS, 0)
  check('offline explained', !offline.ok && offline.status === 502 && offline.error.includes('could not be reached'))

  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 'tok_r', expires_in: 3600 }), { status: 200 })
    hits.push({ method: init.method ?? 'GET', url, headers: {}, body })
    answer = () => ({ status: 200, body: { data: [] } })
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }) as typeof fetch
  clearPipedreamTokens()

  // --- routes -----------------------------------------------------------------
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 'tok_route', expires_in: 3600 }), { status: 200 })
    hits.push({ method: init.method ?? 'GET', url, headers: {}, body })
    if (url.endsWith('/tokens')) return new Response(JSON.stringify({ token: 't', connect_link_url: 'https://pipedream.com/_static/connect.html?token=t&connectLink=true' }), { status: 200 })
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }) as typeof fetch
  clearPipedreamTokens()

  const app = new Hono()
  app.route('/api', pipedreamRoutes())
  const header = Buffer.from(JSON.stringify(GOOD)).toString('base64')
  const FLIGHT = 'pdflight0000001'

  const noCreds = await app.request('/api/pipedream/apps')
  check('no credentials → 400 with a code', noCreds.status === 400 && (await noCreds.json()).code === 'no_credentials')
  const badHeader = await app.request('/api/pipedream/apps', { headers: { 'x-re-pipedream': 'not base64 json' } })
  check('garbage header refused', badHeader.status === 400)

  const status = await app.request('/api/pipedream/status', { headers: { 'x-re-pipedream': header } })
  const statusBody = await status.text()
  check('status ok and never echoes the secret', status.status === 200 && !statusBody.includes('sec_456'))

  const badUser = await app.request('/api/pipedream/accounts?user=' + encodeURIComponent('a b'), { headers: { 'x-re-pipedream': header } })
  check('accounts refuse a bad user id', badUser.status === 400)

  const post = (body: unknown) => app.request('/api/pipedream/connect', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-re-pipedream': header }, body: JSON.stringify(body),
  })
  const good = { app: 'github', user: 'user-1', flight: FLIGHT, returnTo: 'http://localhost:5173' }
  check('connect refuses a path in the return address', (await post({ ...good, returnTo: 'http://localhost:5173/x' })).status === 400)
  check('connect refuses a remote http return address', (await post({ ...good, returnTo: 'http://example.com' })).status === 400)
  check('connect refuses a bad app slug', (await post({ ...good, app: '../x' })).status === 400)
  check('connect refuses a bad flight id', (await post({ ...good, flight: 'x' })).status === 400)

  const okConnect = await post(good)
  const okBody = await okConnect.json()
  check('connect returns the link', okConnect.status === 200 && String(okBody.connectUrl).includes('app=github'), JSON.stringify(okBody))
  const tokenReq = hits.filter((h) => h.url.endsWith('/tokens')).at(-1)
  check('connect sends the done page as the return address', tokenReq?.body?.success_redirect_uri === `http://localhost:5173/api/signin/${FLIGHT}/done`, JSON.stringify(tokenReq?.body))
  check('connect registers the flight as pipedream', getSignIn(FLIGHT)?.provider === 'pipedream' && getSignIn(FLIGHT)?.state === 'open')

  globalThis.fetch = realFetch
  console.log(`pipedream-test: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

run().catch((e) => { globalThis.fetch = realFetch; console.error(e); process.exit(1) })
