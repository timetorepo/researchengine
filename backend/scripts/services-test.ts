// Third-party services: addresses, the OpenSEO handshake, the clone permission
// gate, Postiz drafts (never published), and the Twenty payloads. Runs offline:
// every request goes to a fake fetch that records what would have been sent.
import { Hono } from 'hono'
import { parseBase, openseoCall, openseoDomain, openseoKeywords, voiceClone, voiceSpeak, voiceList, crmCreate, crmSearch, postizDraft, postizChannels } from '../src/services/serviceClients'
import { serviceRoutes } from '../src/routes/services'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`)
}

interface Seen { url: string; method: string; headers: Record<string, string>; body: any }

/** A fake fetch: `reply` decides the response for each call, and every call is recorded. */
function fakeFetch(reply: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const seen: Seen[] = []
  const f = async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input)
    const headers: Record<string, string> = {}
    new Headers(init.headers as HeadersInit | undefined).forEach((v, k) => { headers[k] = v })
    let body: any = init.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* plain */ } }
    seen.push({ url, method: init.method ?? 'GET', headers, body })
    return reply(url, init)
  }
  return { f: f as any, seen }
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } })
const sse = (v: unknown) => new Response(`event: message\ndata: ${JSON.stringify(v)}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } })

// ---- addresses
check('https address accepted, trailing slash dropped', parseBase('https://app.example.com/') .ok === true && (parseBase('https://app.example.com/') as any).url === 'https://app.example.com')
check('a missing address falls back to the default', (parseBase('', 'https://api.postiz.com/public/v1') as any).url === 'https://api.postiz.com/public/v1')
check('no address and no default is refused', parseBase('').ok === false)
check('ftp is refused', parseBase('ftp://x.example.com').ok === false)
check('a login inside the address is refused', parseBase('https://me:secret@x.example.com').ok === false)
check('a local VoiceStudio address is allowed', (parseBase('http://127.0.0.1:3900') as any).ok === true)

// ---- OpenSEO: the stateless MCP handshake and the tool call
{
  const { f, seen } = fakeFetch((url, init) => {
    const body = JSON.parse(String(init.body))
    if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } })
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
    return sse({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'ok' }], structuredContent: { organicTraffic: 1200, backlinks: 40 } } })
  })
  const out = await openseoCall(f, 'https://app.openseo.so', 'oseo_KEY', 'get_domain_overview', { projectId: 'p1', domain: 'example.com' })
  check('OpenSEO call returns the structured result', out.ok && (out as any).data.organicTraffic === 1200)
  check('OpenSEO sends the key as a bearer token', seen.every((s) => s.headers.authorization === 'Bearer oseo_KEY'))
  check('OpenSEO goes to /mcp', seen[0].url === 'https://app.openseo.so/mcp')
  check('OpenSEO handshake runs initialize, confirm, then the tool', seen.map((s) => s.body.method).join(',') === 'initialize,notifications/initialized,tools/call')
  check('OpenSEO tool call carries the tool name and arguments', seen[2].body.params.name === 'get_domain_overview' && seen[2].body.params.arguments.domain === 'example.com')
  check('OpenSEO asks for the MCP protocol version header', seen[0].headers['mcp-protocol-version'] === '2025-06-18')
}
{
  const { f } = fakeFetch(() => new Response('no', { status: 401 }))
  const out = await openseoCall(f, 'https://app.openseo.so', 'bad', 'list_projects', {})
  check('a rejected OpenSEO key says so, with 401', !out.ok && out.status === 401 && /did not accept the key/.test(out.error))
}
{
  const { f, seen } = fakeFetch((url, init) => {
    const body = JSON.parse(String(init.body))
    if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: 1, result: {} })
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
    if (body.params.name === 'list_projects') return sse({ jsonrpc: '2.0', id: 2, result: { structuredContent: { projects: [{ id: 'proj_9', name: 'Main' }] } } })
    return sse({ jsonrpc: '2.0', id: 2, result: { structuredContent: { domain: 'example.com' } } })
  })
  await openseoDomain(f, { base: 'https://app.openseo.so', key: 'oseo_K', domain: 'example.com' })
  const tools = seen.filter((s) => s.body.method === 'tools/call').map((s) => s.body.params.name)
  check('without a project id, the first project is found first', tools.join(',') === 'list_projects,get_domain_overview')
  check('the domain call uses that project', seen[seen.length - 1].body.params.arguments.projectId === 'proj_9')
}
{
  const { f, seen } = fakeFetch((url, init) => {
    const body = JSON.parse(String(init.body))
    if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: 1, result: {} })
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
    return sse({ jsonrpc: '2.0', id: 2, result: { structuredContent: { keywords: [] } } })
  })
  await openseoKeywords(f, { base: 'https://app.openseo.so', projectId: 'p1', seeds: ['  coffee beans ', '', 'espresso'] })
  const args = seen[2].body.params.arguments
  check('keyword research sends the seeds without blanks', args.seeds.length === 2 && args.seeds[0].seed === 'coffee beans')
}

// ---- VoiceStudio: permission gate, speech, voice list
{
  const { f, seen } = fakeFetch(() => json({ id: 'x' }))
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' })
  const refused = await voiceClone(f, { base: 'http://127.0.0.1:3900', name: 'Ana', sample: blob, sampleName: 'a.wav', permission: false })
  check('cloning without permission is refused', !refused.ok && refused.status === 403)
  check('a refused clone never reaches VoiceStudio', seen.length === 0)
}
{
  const { f, seen } = fakeFetch(() => json({ id: 'prof_42', name: 'Ana' }))
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' })
  const out = await voiceClone(f, { base: 'http://127.0.0.1:3900', name: '  Ana ', sample: blob, sampleName: 'ana.wav', permission: true })
  check('a permitted clone returns the new voice id', out.ok && (out as any).data.id === 'prof_42')
  check('the clone posts to /profiles as a clone form', seen[0].url === 'http://127.0.0.1:3900/profiles' && seen[0].body instanceof FormData && (seen[0].body as FormData).get('kind') === 'clone')
  check('the clone form carries the trimmed name and the sample', seen[0].body.get('name') === 'Ana' && seen[0].body.get('ref_audio') instanceof File)
}
{
  const { f } = fakeFetch(() => new Response(new Uint8Array([9, 9]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
  const out = await voiceSpeak(f, { base: 'http://127.0.0.1:3900', voice: 'default', text: 'Hello there' })
  check('speech returns the audio bytes with their type', out.ok && (out as any).data.mime === 'audio/mpeg' && (out as any).data.bytes.byteLength === 2)
}
{
  const { f, seen } = fakeFetch(() => json({ data: [{ id: 'v1', name: 'Ana', type: 'profile' }, { id: 'alloy', name: 'Alloy', type: 'openai_alias' }] }))
  const out = await voiceList(f, { base: 'http://127.0.0.1:3900' })
  check('voice list reads the data array', out.ok && (out as any).data.voices.length === 2)
}
{
  const { f, seen } = fakeFetch(() => new Response(new Uint8Array(1), { headers: { 'content-type': 'audio/mpeg' } }))
  await voiceSpeak(f, { base: 'http://127.0.0.1:3900', voice: 'Ana', text: 'Hi' })
  check('speech posts the text and the voice name to the OpenAI-style route', seen[0].url === 'http://127.0.0.1:3900/v1/audio/speech' && seen[0].body.voice === 'Ana' && seen[0].body.input === 'Hi')
}

// ---- Twenty CRM: payloads and search
{
  const { f, seen } = fakeFetch(() => json({ data: { createPerson: { id: 'per_1' } } }))
  const out = await crmCreate(f, { base: 'https://api.twenty.com', key: 'tw_K', record: { kind: 'people', firstName: 'Ana', lastName: 'Lima', email: 'ana@example.com' } })
  check('a person is created with a name object and email', out.ok && seen[0].method === 'POST' && seen[0].url.endsWith('/rest/people') && seen[0].body.name.firstName === 'Ana' && seen[0].body.emails.primaryEmail === 'ana@example.com')
  check('CRM calls send the bearer key', seen[0].headers.authorization === 'Bearer tw_K')
}
{
  const { f } = fakeFetch(() => json({}))
  const out = await crmCreate(f, { base: 'https://api.twenty.com', record: { kind: 'people', lastName: 'NoFirst' } })
  check('a person without a first name is refused before any call', !out.ok && out.status === 400)
}
{
  const { f, seen } = fakeFetch(() => json({ data: { companies: [{ id: 'c1', name: 'Acme', domainName: { primaryLinkUrl: 'acme.test' } }] } }))
  const out = await crmSearch(f, { base: 'https://api.twenty.com', key: 'k', query: 'Ac"me', kind: 'companies' })
  check('company search filters by name and returns the record', out.ok && (out as any).data.records[0].name === 'Acme' && seen[0].url.includes('filter='))
  check('quotes are stripped from the search text', !seen[0].url.includes('%22me') && !decodeURIComponent(seen[0].url).includes('Ac"me'))
}
{
  const { f, seen } = fakeFetch(() => json({ data: { notes: [] } }))
  await crmCreate(f, { base: 'https://api.twenty.com', record: { kind: 'notes', title: 'Call notes', body: 'Agreed a trial.' } })
  check('a note sends its title and markdown body', seen[0].url.endsWith('/rest/notes') && seen[0].body.bodyV2.markdown === 'Agreed a trial.')
}

// ---- Postiz: drafts only
{
  const { f, seen } = fakeFetch((url, init) => {
    if (url.endsWith('/integrations')) return json([{ id: 'ch1', name: 'Acme Blog', identifier: 'devto', disabled: false }])
    return json([{ postId: 'post_7', integration: 'ch1' }])
  })
  const out = await postizDraft(f, { base: 'https://api.postiz.com/public/v1', key: 'pz', channelId: 'ch1', text: 'Hello', now: new Date('2026-10-24T00:00:00Z') })
  check('a draft is saved and returns the post id', out.ok && (out as any).data.postId === 'post_7')
  const post = seen.find((s) => s.url.endsWith('/posts'))!
  check('the draft is sent as type draft, never now or schedule', post.body.type === 'draft')
  check('the draft uses the channel identifier as its settings type', post.body.posts[0].settings.__type === 'devto' && post.body.posts[0].integration.id === 'ch1')
  check('the draft content is the text', post.body.posts[0].value[0].content === 'Hello')
}
{
  const { f, seen } = fakeFetch(() => json([{ id: 'ch1', name: 'Acme', identifier: 'x', disabled: false }]))
  const out = await postizDraft(f, { base: 'https://api.postiz.com/public/v1', channelId: 'missing', text: 'Hi' })
  check('an unknown channel is refused and nothing is posted', !out.ok && out.status === 404 && seen.length === 1)
}
{
  const { f, seen } = fakeFetch(() => json([{ id: 'ch1', name: 'Acme', identifier: 'x', disabled: true }]))
  const out = await postizDraft(f, { base: 'https://api.postiz.com/public/v1', channelId: 'ch1', text: 'Hi' })
  check('a disabled channel is refused', !out.ok && out.status === 409 && seen.length === 1)
}
{
  const { f } = fakeFetch(() => json([{ id: 'a', name: 'A', identifier: 'x', disabled: false }]))
  const out = await postizChannels(f, { base: 'https://api.postiz.com/public/v1' })
  check('channel list maps to id, name and identifier', out.ok && (out as any).data.channels[0].identifier === 'x')
}

// ---- Routes: the permission gate end to end, through the HTTP layer
{
  const { f, seen } = fakeFetch(() => json({ id: 'x' }))
  const app = new Hono()
  app.route('/api', serviceRoutes({} as any, f))
  const form = new FormData()
  form.set('name', 'Ana')
  form.set('sample', new File([new Uint8Array([1])], 'ana.wav', { type: 'audio/wav' }))
  const res = await app.request('/api/services/voice/clone', { method: 'POST', headers: { 'x-re-service-url': 'http://127.0.0.1:3900' }, body: form })
  check('the route refuses a clone without permission', res.status === 403)
  check('the route never calls VoiceStudio for a refused clone', seen.length === 0)
  const form2 = new FormData()
  form2.set('name', 'Ana')
  form2.set('permission', 'granted')
  form2.set('sample', new File([new Uint8Array([1])], 'ana.wav', { type: 'audio/wav' }))
  const ok = await app.request('/api/services/voice/clone', { method: 'POST', headers: { 'x-re-service-url': 'http://127.0.0.1:3900' }, body: form2 })
  check('the route clones once the permission field is granted', ok.status === 200 && seen.length === 1)
}
{
  const { f } = fakeFetch(() => json({}))
  const app = new Hono()
  app.route('/api', serviceRoutes({} as any, f))
  const res = await app.request('/api/services/social/draft', { method: 'POST', headers: { 'content-type': 'application/json', 'x-re-service-url': 'ftp://nope' }, body: JSON.stringify({ channelId: 'c', text: 'x' }) })
  check('a bad address is refused at the route, before any call', res.status === 400)
}

console.log(`\nservices-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
