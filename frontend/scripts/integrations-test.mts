/**
 * Integrations test — the real adapters, against a stubbed network.
 *
 * What this proves: the request each service receives (URL, auth header, version
 * header, method, body), the shape we hand back to the UI and the agent, and
 * that a refusal is reported as "connect this account" rather than as an empty
 * result. Nothing here touches the internet; `fetch` is replaced with a router.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/integrations-test.mts   (from frontend/)
 */
import { readFileSync } from 'node:fs'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const section = (t: string) => console.log(`\n${t}`)

const BACKEND = new URL('../../backend/src/services/integrations/index.ts', import.meta.url)
const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

/* ---------------- network stub ---------------- */

interface Call { url: string; method: string; headers: Record<string, string>; body?: any }
const calls: Call[] = []
type Reply = { status?: number; json?: any; text?: string; headers?: Record<string, string> }
let routes: { match: (url: string, method: string) => boolean; reply: Reply | ((call: Call) => Reply) }[] = []

const stubFetch = async (input: any, init: any = {}) => {
  const url = String(input)
  const method = String(init.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {}
  const h = init.headers ?? {}
  if (h instanceof Headers) h.forEach((v: string, k: string) => { headers[k.toLowerCase()] = v })
  else for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v)
  const call: Call = { url, method, headers, body: init.body }
  calls.push(call)
  const route = routes.find((r) => r.match(url, method))
  if (!route) return new Response(JSON.stringify({ error: { message: `nothing stubbed for ${url}` } }), { status: 501, headers: { 'content-type': 'application/json' } })
  const reply = typeof route.reply === 'function' ? route.reply(call) : route.reply
  const body = reply.json !== undefined ? JSON.stringify(reply.json) : (reply.text ?? '')
  return new Response(body, {
    status: reply.status ?? 200,
    headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
  })
}
// @ts-expect-error test shim
globalThis.fetch = stubFetch

const { searchIntegration, readIntegration, probeIntegration, credsFrom, INTEGRATION_DEFS } =
  await import('../../backend/src/services/integrations/index.ts')

const rt: any = { dataDir: '/tmp/re-int-test' }
const last = () => calls[calls.length - 1]
const reset = () => { calls.length = 0; routes = [] }

/* ---------------- [1] credentials never leak ---------------- */

section('[1] credentials arrive per request and are never repeated back')
{
  const parsed = credsFrom(JSON.stringify({ drive: { token: 'ya29.SECRET', refreshToken: '1//SECRET' } }))
  check('a well-formed credential map parses', parsed.drive?.token === 'ya29.SECRET' && parsed.drive?.refreshToken === '1//SECRET')
  check('garbage is treated as empty', Object.keys(credsFrom('{oops')).length === 0)
  check('null is treated as empty', Object.keys(credsFrom(null)).length === 0)
  check('unknown fields are dropped', Object.keys(credsFrom(JSON.stringify({ drive: { token: 'x', evil: 'y' } })).drive ?? {}).length === 1)

  reset()
  routes = [{ match: (u) => u.includes('googleapis.com/drive'), reply: { status: 401, json: { error: { message: 'Invalid Credentials' } } } }]
  const out = await searchIntegration(rt, 'drive', 'notes', { token: 'ya29.SUPER-SECRET' }, 5)
  check('a refused credential is reported as an auth problem', out.ok === false && out.needs === 'auth', JSON.stringify(out))
  check('and the message never contains the token', !JSON.stringify(out).includes('SUPER-SECRET'))
  check('the message names the service and the status', /Google Drive/.test(out.error ?? '') && /401/.test(out.error ?? ''))
}

/* ---------------- [2] Google: refresh exchange, Drive, Gmail, Calendar ---------------- */

section('[2] Google: a refresh token is exchanged, then used')
{
  reset()
  routes = [
    { match: (u) => u.includes('oauth2.googleapis.com/token'), reply: { json: { access_token: 'ya29.FRESH' } } },
    { match: (u) => u.includes('/drive/v3/files?'), reply: { json: { files: [{ id: 'f1', name: 'Thesis.pdf', mimeType: 'application/pdf', modifiedTime: '2026-09-01T10:00:00Z', webViewLink: 'https://drive/f1', owners: [{ displayName: 'Dnish' }] }] } } },
  ]
  const out = await searchIntegration(rt, 'drive', 'thesis', { refreshToken: '1//r', clientId: 'cid', clientSecret: 'csecret' }, 5)
  const tokenCall = calls.find((c) => c.url.includes('oauth2.googleapis.com'))
  check('the refresh token is exchanged for an access token', !!tokenCall && tokenCall.method === 'POST')
  check('with the client id and secret in the body', /client_id=cid/.test(String(tokenCall?.body)) && /grant_type=refresh_token/.test(String(tokenCall?.body)))
  check('the fresh token is what the API call carries', calls[1]?.headers.authorization === 'Bearer ya29.FRESH')
  check('Drive results are mapped into hits',
    out.ok && out.data?.[0]?.title === 'Thesis.pdf' && out.data?.[0]?.integration === 'drive' && out.data?.[0]?.kind === 'file',
    JSON.stringify(out).slice(0, 200))
  check('the modified date is carried through', out.data?.[0]?.date === '2026-09-01T10:00:00Z')
  const driveQuery = new URL(calls[1]?.url ?? 'https://x').searchParams.get('q') ?? ''
  check('the search term is escaped into the Drive query', /name contains 'thesis'/.test(driveQuery), driveQuery)
}
{
  reset()
  routes = [
    { match: (u) => u.includes('oauth2.googleapis.com/token'), reply: { json: { access_token: 'ya29.FRESH' } } },
    { match: (u) => u.includes('/drive/v3/files/f1?'), reply: { json: { id: 'f1', name: 'Doc', mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://drive/f1' } } },
    { match: (u) => u.includes('/export?'), reply: { text: 'The exported document text.' } },
  ]
  const out = await readIntegration(rt, 'drive', 'f1', { token: 'ya29.x' })
  check('a Google Doc is exported as text', out.ok && out.data?.text === 'The exported document text.')
  check('and the export URL is the Docs one', calls.some((c) => c.url.includes('/export?mimeType=text/plain')))
}
{
  reset()
  routes = [
    { match: (u) => u.includes('oauth2.googleapis.com/token'), reply: { json: { access_token: 'ya29.FRESH' } } },
    { match: (u) => u.includes('/messages?' ), reply: { json: { messages: [{ id: 'm1' }] } } },
    { match: (u) => u.includes('/messages/m1'), reply: { json: { id: 'm1', snippet: 'About the budget', internalDate: '1758880000000', payload: { headers: [{ name: 'Subject', value: 'Budget review' }, { name: 'From', value: 'ada@example.com' }] } } } },
  ]
  const out = await searchIntegration(rt, 'gmail', 'budget', { token: 'ya29.x' }, 5)
  check('Gmail search returns the subject and sender',
    out.ok && out.data?.[0]?.title === 'Budget review' && out.data?.[0]?.subtitle === 'ada@example.com', JSON.stringify(out).slice(0, 160))
  check('and keeps the provider snippet', /budget/i.test(out.data?.[0]?.snippet ?? ''))
}
{
  reset()
  routes = [
    { match: (u) => u.includes('oauth2.googleapis.com/token'), reply: { json: { access_token: 'ya29.FRESH' } } },
    { match: (u) => u.includes('/messages/m1?format=full'), reply: { json: { id: 'm1', payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: 'Hi' }, { name: 'From', value: 'a@b.c' }], parts: [{ mimeType: 'text/plain', body: { data: Buffer.from('The plain body.').toString('base64url') } }] } } } },
  ]
  const out = await readIntegration(rt, 'gmail', 'm1', { token: 'ya29.x' })
  check('a full mail body is decoded from the MIME tree', out.ok && out.data?.text.includes('The plain body.'), JSON.stringify(out).slice(0, 160))
  check('and the headers are kept with it', out.ok && /From: a@b\.c/.test(out.data?.text ?? ''))
}
{
  reset()
  routes = [
    { match: (u) => u.includes('oauth2.googleapis.com/token'), reply: { json: { access_token: 'ya29.FRESH' } } },
    { match: (u) => u.includes('calendar/v3'), reply: { json: { items: [{ id: 'e1', summary: 'Standup', start: { dateTime: '2026-09-28T09:00:00Z' }, attendees: [{ email: 'a@b.c' }], htmlLink: 'https://cal/e1' }] } } },
  ]
  const out = await searchIntegration(rt, 'gcal', 'standup', { token: 'ya29.x' }, 5)
  check('Calendar events come back with their time and guests',
    out.ok && out.data?.[0]?.title === 'Standup' && out.data?.[0]?.date === '2026-09-28T09:00:00Z' && /1 invited/.test(out.data?.[0]?.subtitle ?? ''),
    JSON.stringify(out).slice(0, 200))
}

/* ---------------- [3] GitHub, Notion, Slack ---------------- */

section('[3] GitHub, Notion and Slack')
{
  reset()
  routes = [
    { match: (u) => u.includes('api.github.com/search/issues'), reply: { json: { items: [{ number: 12, title: 'Crash on boot', state: 'open', html_url: 'https://gh/12', repository_url: 'https://api.github.com/repos/a/b', updated_at: '2026-09-20T00:00:00Z', body: 'steps' }] } } },
    { match: (u) => u.includes('api.github.com/search/code'), reply: { json: { items: [{ path: 'src/app.ts', html_url: 'https://gh/blob', repository: { full_name: 'a/b' } }] } } },
  ]
  const out = await searchIntegration(rt, 'github', 'crash', { token: 'ghp_x' }, 6)
  check('GitHub needs a token and says so before calling anything', (await searchIntegration(rt, 'github', 'x', {}, 5)).needs === 'auth')
  check('the token is sent as a bearer token', calls[0]?.headers.authorization === 'Bearer ghp_x')
  check('and the request identifies this app', calls[0]?.headers['user-agent'] === 'research-engine')
  check('issues and code are both returned',
    out.ok && out.data?.some((h: any) => h.id === 'issue:12') && out.data?.some((h: any) => h.id.startsWith('code:a/b:')),
    JSON.stringify(out.data?.map((h: any) => h.id)))
  check('the code hit carries the repository and path', out.data?.find((h: any) => h.kind === 'file')?.subtitle === 'a/b · code')
}
{
  reset()
  routes = [
    { match: (u) => u.includes('api.notion.com/v1/search'), reply: { json: { results: [{ id: 'p1', object: 'page', url: 'https://notion/p1', last_edited_time: '2026-09-10T00:00:00Z', properties: { title: { title: [{ plain_text: 'Reading list' }] } } }] } } },
  ]
  const out = await searchIntegration(rt, 'notion', 'reading', { token: 'secret_x' }, 5)
  check('Notion search uses the integration token', calls[0]?.headers.authorization === 'Bearer secret_x')
  check('with the API version header the API requires', calls[0]?.headers['notion-version'] === '2022-06-28')
  check('and a page title is unpacked from its properties', out.ok && out.data?.[0]?.title === 'Reading list', JSON.stringify(out).slice(0, 160))
  check('search is a POST with the query in the body', last()?.method === 'POST' && /"query":"reading"/.test(String(last()?.body)))
}
{
  reset()
  routes = [
    { match: (u) => u.includes('slack.com/api/search.messages'), reply: { json: { ok: true, messages: { matches: [{ text: 'ship it', ts: '1758800000.1', channel: { id: 'C1', name: 'general' }, username: 'ada', permalink: 'https://slack/p' }] } } } },
  ]
  const out = await searchIntegration(rt, 'slack', 'ship', { token: 'xoxp-x' }, 5)
  check('Slack messages become hits with their channel',
    out.ok && out.data?.[0]?.subtitle === '#general · ada' && out.data?.[0]?.url === 'https://slack/p', JSON.stringify(out).slice(0, 160))
  check('the message timestamp is turned into a date', /^20/.test(out.data?.[0]?.date ?? ''))
  reset()
  routes = [{ match: (u) => u.includes('slack.com'), reply: { json: { ok: false, error: 'not_allowed_token_type' } } }]
  const bad = await searchIntegration(rt, 'slack', 'x', { token: 'xoxb-bot' }, 5)
  check('a bot token is refused with the reason and a fix', bad.needs === 'auth' && /user token/.test(bad.error ?? ''), JSON.stringify(bad))
}

/* ---------------- [4] rate limits and network faults ---------------- */

section('[4] failures are described, not swallowed')
{
  reset()
  routes = [{ match: (u) => u.includes('api.github.com'), reply: { status: 429, json: { message: 'API rate limit exceeded' } } }]
  const out = await searchIntegration(rt, 'github', 'x', { token: 'ghp' }, 5)
  check('a rate limit is flagged as such', out.needs === 'rate-limit' && /429/.test(out.error ?? ''), JSON.stringify(out))
  check('and the service’s own words are preferred when short', /rate limit/i.test(out.error ?? ''))

  reset()
  routes = [{ match: () => true, reply: () => { throw Object.assign(new Error('socket hang up'), { name: 'TypeError' }) } }]
  const down = await searchIntegration(rt, 'github', 'x', { token: 'ghp' }, 5)
  check('a transport failure is reported as a network problem', down.ok === false && down.needs === 'network', JSON.stringify(down))
}

/* ---------------- [5] probes ---------------- */

section('[5] "test connection" makes a real call and names the account')
{
  reset()
  routes = [{ match: (u) => u.includes('api.github.com/user'), reply: { json: { login: 'dnishh' }, headers: { 'x-oauth-scopes': 'repo, read:user' } } }]
  const out = await probeIntegration('github', { token: 'ghp_x' })
  check('GitHub reports the account it belongs to', out.ok && out.data?.account === 'dnishh', JSON.stringify(out))
  check('and the scopes it actually has', /repo/.test(out.data?.detail ?? ''))
  reset()
  routes = [{ match: (u) => u.includes('slack.com/api/auth.test'), reply: { json: { ok: true, user: 'ada', team: 'Research' } } }]
  const slack = await probeIntegration('slack', { token: 'xoxp' })
  check('Slack reports the user and workspace', slack.data?.account === 'ada' && /Research/.test(slack.data?.detail ?? ''))
  const local = await probeIntegration('files', {})
  check('local files need no credential at all', local.ok && /workspace/.test(local.data?.detail ?? ''))
}

/* ---------------- [6] the catalogue matches the frontend ---------------- */

section('[6] one catalogue, two runtimes')
{
  const feSrc = src('../src/lib/integrations/registry.ts')
  const backendIds = INTEGRATION_DEFS.map((d) => d.id).sort().join(',')
  const frontendIds = [...feSrc.matchAll(/id: '([a-z]+)', name:/g)].map((m) => m[1]).sort().join(',')
  check('the backend and the frontend agree on every integration', backendIds === frontendIds, `${backendIds} vs ${frontendIds}`)
  const feNames = [...feSrc.matchAll(/name: '([^']+)'/g)].map((m) => m[1])
  check('and on their names', INTEGRATION_DEFS.every((d) => feNames.includes(d.name)))
  check('every integration declares the scopes it needs', INTEGRATION_DEFS.every((d) => d.scopes.length > 0))
  check('and an auth kind', INTEGRATION_DEFS.every((d) => d.auth === 'none' || d.auth === 'token'))
}

/* ---------------- [7] wiring: routes, tools, settings ---------------- */

section('[7] wired into the app')
{
  const routeSrc = src('../../backend/src/routes/integrations.ts')
  check('the gateway exposes search, read and probe', ['/integrations/search', '/integrations/read', '/integrations/probe', "/integrations'"].every((s) => routeSrc.includes(s)))
  check('the route is registered on the app', src('../../backend/src/index.ts').includes("integrationRoutes(rt)"))
  check('it reads credentials from the request header', routeSrc.includes("c.req.header('x-re-integrations')") && routeSrc.includes('credsFrom'))
  check('and never echoes a token back', !/token: .*creds\[/.test(routeSrc))
  const toolSrc = src('../src/lib/chat/tools.ts')
  check('the agent gets a search tool', toolSrc.includes("name: 'integration_search'"))
  check('and a read tool', toolSrc.includes("name: 'integration_read'"))
  check('both tell the model that "not connected" is the answer', /not connected/i.test(toolSrc.slice(toolSrc.indexOf('integration_search'), toolSrc.indexOf('connector_search'))))
  const chatSrc = src('../src/lib/chat/runChat.ts')
  check('an attached account item is read through the gateway', chatSrc.includes("ref.box.startsWith('int:')") && chatSrc.includes('readIntegrationItem'))
}

/* ---------------- summary ---------------- */

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
if (failed) console.log(fails.map((f) => `  - ${f}`).join('\n'))
process.exit(failed ? 1 : 0)
