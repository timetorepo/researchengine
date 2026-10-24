// Third-party services for the chat and the bots, called from the server.
//
//   OpenSEO    (MIT, every-app/open-seo)   SEO data over its MCP endpoint
//   VoiceStudio (AGPL-3.0, debpalash/VoiceStudio)  text to speech and voice profiles
//   Twenty     (AGPL-3.0, twentyhq/twenty) CRM records over its REST API
//   Postiz     (AGPL-3.0, gitroomhq/postiz-app) social drafts over its public API
//
// Every call takes the address and key for that request only. Nothing is stored
// on the server. The fetch function is a parameter so the tests run offline.

export type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

export type Outcome<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const TIMEOUT_MS = 25_000
const MAX_JSON_BYTES = 2_000_000
const MAX_AUDIO_BYTES = 25_000_000

export function fail(status: number, error: string): { ok: false; status: number; error: string } {
  return { ok: false, status, error }
}

/**
 * A base address the person typed. http and https only, no login inside the
 * address (the key goes in its own field), and a trailing slash is dropped.
 */
export function parseBase(raw: string | undefined, fallback?: string): { ok: true; url: string } | { ok: false; error: string } {
  const text = (raw ?? '').trim() || (fallback ?? '')
  if (!text) return { ok: false, error: 'This service has no address yet. Add it under Connectors.' }
  let u: URL
  try { u = new URL(text) } catch { return { ok: false, error: 'That is not a valid web address.' } }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'Use an http or https address.' }
  if (u.username || u.password) return { ok: false, error: 'Take the login out of the address. The key goes in its own field.' }
  return { ok: true, url: u.toString().replace(/\/+$/, '') }
}

async function send(f: Fetcher, url: string, init: RequestInit, service: string): Promise<Response | { error: string; status: number }> {
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return { status: 502, error: `${service} could not be reached from this machine.` }
  }
}

function isFailure(x: Response | { error: string; status: number }): x is { error: string; status: number } {
  return !(x instanceof Response) && 'error' in x
}

async function readJson(res: Response, cap = MAX_JSON_BYTES): Promise<unknown> {
  const text = await res.text()
  if (text.length > cap) throw new Error('too large')
  try { return JSON.parse(text) } catch { return text }
}

function bearer(key?: string): Record<string, string> {
  return key ? { authorization: `Bearer ${key}` } : {}
}

// ---------------------------------------------------------------- OpenSEO

const MCP_PROTOCOL = '2025-06-18'

/** Pull the JSON-RPC message with the given id out of a plain or event-stream body. */
function rpcMessage(body: string, id: number): any | null {
  const trimmed = body.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try { const v = JSON.parse(trimmed); return v?.id === id ? v : null } catch { return null }
  }
  for (const line of trimmed.split('\n')) {
    if (!line.startsWith('data:')) continue
    try { const v = JSON.parse(line.slice(5).trim()); if (v?.id === id) return v } catch { /* next line */ }
  }
  return null
}

/**
 * One MCP tool call over Streamable HTTP. OpenSEO serves MCP statelessly, so each
 * call is initialise, confirm, then the call. Returns the tool's structured result.
 */
export async function openseoCall(f: Fetcher, base: string, key: string | undefined, tool: string, args: Record<string, unknown>): Promise<Outcome<any>> {
  const url = /\/mcp\/?$/.test(base) ? base : `${base}/mcp`
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': MCP_PROTOCOL,
    ...bearer(key),
  }
  const post = (body: unknown) => send(f, url, { method: 'POST', headers, body: JSON.stringify(body) }, 'OpenSEO')

  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'researchengine', version: '1' } } })
  if (isFailure(init)) return fail(init.status, init.error)
  if (init.status === 401 || init.status === 403) return fail(401, 'OpenSEO did not accept the key. Check the key under Connectors.')
  if (!init.ok) return fail(502, `OpenSEO answered ${init.status}.`)
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }).catch(() => undefined)

  const called = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } })
  if (isFailure(called)) return fail(called.status, called.error)
  if (!called.ok) return fail(502, `OpenSEO answered ${called.status}.`)
  const msg = rpcMessage(await called.text(), 2)
  if (!msg) return fail(502, 'OpenSEO sent an answer this app could not read.')
  if (msg.error) return fail(502, String(msg.error.message ?? 'OpenSEO refused the request.').slice(0, 300))
  const result = msg.result ?? {}
  const text = Array.isArray(result.content) ? result.content.map((c: any) => String(c?.text ?? '')).join('\n') : ''
  if (result.isError) return fail(422, (text || 'OpenSEO could not run that.').slice(0, 400))
  if (result.structuredContent && typeof result.structuredContent === 'object') return { ok: true, data: result.structuredContent }
  return { ok: true, data: { text: text.slice(0, 8000) } }
}

/** Domain overview: traffic, keywords, backlinks, referring domains. */
export async function openseoDomain(f: Fetcher, opts: { base: string; key?: string; projectId?: string; domain: string }): Promise<Outcome<any>> {
  let projectId = opts.projectId?.trim()
  if (!projectId) {
    const projects = await openseoCall(f, opts.base, opts.key, 'list_projects', {})
    if (!projects.ok) return projects
    const first = Array.isArray(projects.data?.projects) ? projects.data.projects[0] : undefined
    if (!first?.id) return fail(404, 'OpenSEO has no project yet. Create one in OpenSEO, then try again.')
    projectId = String(first.id)
  }
  return openseoCall(f, opts.base, opts.key, 'get_domain_overview', { projectId, domain: opts.domain.slice(0, 2048) })
}

/** Keyword research for one to five seeds. */
export async function openseoKeywords(f: Fetcher, opts: { base: string; key?: string; projectId?: string; seeds: string[] }): Promise<Outcome<any>> {
  let projectId = opts.projectId?.trim()
  if (!projectId) {
    const projects = await openseoCall(f, opts.base, opts.key, 'list_projects', {})
    if (!projects.ok) return projects
    const first = Array.isArray(projects.data?.projects) ? projects.data.projects[0] : undefined
    if (!first?.id) return fail(404, 'OpenSEO has no project yet. Create one in OpenSEO, then try again.')
    projectId = String(first.id)
  }
  const seeds = opts.seeds.map((s) => s.trim()).filter(Boolean).slice(0, 5).map((seed) => ({ seed: seed.slice(0, 200) }))
  return openseoCall(f, opts.base, opts.key, 'research_keywords', { projectId, seeds, resultLimit: 150 })
}

// ---------------------------------------------------------------- VoiceStudio

/** Speech from VoiceStudio's OpenAI-compatible endpoint. Returns the audio bytes. */
export async function voiceSpeak(f: Fetcher, opts: { base: string; key?: string; voice: string; text: string; format?: 'mp3' | 'wav' }): Promise<Outcome<{ bytes: ArrayBuffer; mime: string }>> {
  const res = await send(f, `${opts.base}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...bearer(opts.key) },
    body: JSON.stringify({ model: 'omnivoice', input: opts.text.slice(0, 4000), voice: opts.voice || 'default', response_format: opts.format ?? 'mp3' }),
  }, 'VoiceStudio')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 401 || res.status === 403) return fail(401, 'VoiceStudio did not accept the key or PIN.')
  if (res.status === 409) return fail(409, 'More than one voice has that name. Use the voice id instead.')
  if (!res.ok) return fail(502, `VoiceStudio answered ${res.status}.`)
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > MAX_AUDIO_BYTES) return fail(413, 'The audio is too large to send back.')
  return { ok: true, data: { bytes, mime: res.headers.get('content-type') ?? (opts.format === 'wav' ? 'audio/wav' : 'audio/mpeg') } }
}

/** Voices VoiceStudio can speak with: built-in aliases and saved profiles. */
export async function voiceList(f: Fetcher, opts: { base: string; key?: string }): Promise<Outcome<{ voices: { id: string; name: string; type: string }[] }>> {
  const res = await send(f, `${opts.base}/v1/audio/voices`, { headers: bearer(opts.key) }, 'VoiceStudio')
  if (isFailure(res)) return fail(res.status, res.error)
  if (!res.ok) return fail(res.status === 401 ? 401 : 502, res.status === 401 ? 'VoiceStudio did not accept the key or PIN.' : `VoiceStudio answered ${res.status}.`)
  const body: any = await readJson(res).catch(() => ({}))
  const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body?.voices) ? body.voices : []
  return { ok: true, data: { voices: list.slice(0, 200).map((v) => ({ id: String(v.id ?? v.voice_id ?? ''), name: String(v.name ?? v.id ?? ''), type: String(v.type ?? '') })).filter((v) => v.id) } }
}

/**
 * Clone a voice from a sample. Refused unless the caller says the speaker has given
 * permission; the app keeps that record too, and the agent cannot reach this path.
 */
export async function voiceClone(f: Fetcher, opts: { base: string; key?: string; name: string; sample: Blob; sampleName: string; permission: boolean }): Promise<Outcome<{ id: string; name: string }>> {
  if (!opts.permission) return fail(403, 'Cloning needs the speaker’s permission. Confirm it before cloning.')
  const name = opts.name.trim().slice(0, 80)
  if (!name) return fail(400, 'Give the voice a name.')
  const form = new FormData()
  form.set('name', name)
  form.set('kind', 'clone')
  form.set('language', 'Auto')
  form.set('ref_text', '')
  form.set('ref_audio', opts.sample, opts.sampleName.slice(0, 120) || 'sample.wav')
  const res = await send(f, `${opts.base}/profiles`, { method: 'POST', headers: bearer(opts.key), body: form }, 'VoiceStudio')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 401 || res.status === 403) return fail(401, 'VoiceStudio did not accept the key or PIN.')
  if (!res.ok) return fail(502, `VoiceStudio could not clone the voice (${res.status}).`)
  const body: any = await readJson(res).catch(() => ({}))
  const id = String(body?.id ?? '')
  if (!id) return fail(502, 'VoiceStudio did not return a voice id.')
  return { ok: true, data: { id, name: String(body?.name ?? name) } }
}

// ---------------------------------------------------------------- Twenty CRM

export type CrmKind = 'people' | 'companies' | 'notes'

function crmHeaders(key?: string): Record<string, string> {
  return { accept: 'application/json', ...bearer(key) }
}

/** Find people or companies whose name contains the text. */
export async function crmSearch(f: Fetcher, opts: { base: string; key?: string; query: string; kind: 'people' | 'companies' }): Promise<Outcome<{ records: { id: string; name: string; detail: string }[] }>> {
  const q = opts.query.trim().slice(0, 120).replace(/"/g, '')
  if (q.length < 2) return fail(400, 'Search for at least two letters.')
  const field = opts.kind === 'people' ? 'name.firstName' : 'name'
  const url = new URL(`${opts.base}/rest/${opts.kind}`)
  url.searchParams.set('filter', `${field}[ilike]:"%${q}%"`)
  url.searchParams.set('limit', '20')
  const res = await send(f, url.toString(), { headers: crmHeaders(opts.key) }, 'Twenty')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 401 || res.status === 403) return fail(401, 'Twenty did not accept the key. Check the key under Connectors.')
  if (!res.ok) return fail(502, `Twenty answered ${res.status}.`)
  const body: any = await readJson(res).catch(() => ({}))
  const rows: any[] = Array.isArray(body?.data?.[opts.kind]) ? body.data[opts.kind] : []
  return {
    ok: true,
    data: {
      records: rows.slice(0, 20).map((r) => ({
        id: String(r.id ?? ''),
        name: opts.kind === 'people' ? `${r.name?.firstName ?? ''} ${r.name?.lastName ?? ''}`.trim() : String(r.name ?? ''),
        detail: opts.kind === 'people' ? String(r.jobTitle ?? r.emails?.primaryEmail ?? '') : String(r.domainName?.primaryLinkUrl ?? ''),
      })).filter((r) => r.id),
    },
  }
}

export interface CrmCreate {
  kind: CrmKind
  /** person: first + last + email; company: name + domain; note: title + body */
  firstName?: string
  lastName?: string
  email?: string
  jobTitle?: string
  name?: string
  domain?: string
  title?: string
  body?: string
}

/** Create one person, company or note. The caller has checked the person asked for it. */
export async function crmCreate(f: Fetcher, opts: { base: string; key?: string; record: CrmCreate }): Promise<Outcome<{ id: string; kind: CrmKind }>> {
  const r = opts.record
  let payload: Record<string, unknown>
  if (r.kind === 'people') {
    const first = (r.firstName ?? '').trim().slice(0, 80)
    if (!first) return fail(400, 'A person needs at least a first name.')
    payload = {
      name: { firstName: first, lastName: (r.lastName ?? '').trim().slice(0, 80) },
      ...(r.email ? { emails: { primaryEmail: r.email.trim().slice(0, 200) } } : {}),
      ...(r.jobTitle ? { jobTitle: r.jobTitle.trim().slice(0, 120) } : {}),
    }
  } else if (r.kind === 'companies') {
    const name = (r.name ?? '').trim().slice(0, 200)
    if (!name) return fail(400, 'A company needs a name.')
    payload = { name, ...(r.domain ? { domainName: { primaryLinkUrl: r.domain.trim().slice(0, 200) } } : {}) }
  } else {
    const title = (r.title ?? '').trim().slice(0, 200)
    if (!title) return fail(400, 'A note needs a title.')
    payload = { title, bodyV2: { markdown: (r.body ?? '').slice(0, 20_000) } }
  }
  const res = await send(f, `${opts.base}/rest/${r.kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...crmHeaders(opts.key) },
    body: JSON.stringify(payload),
  }, 'Twenty')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 401 || res.status === 403) return fail(401, 'Twenty did not accept the key, or the key cannot write this object.')
  if (!res.ok) return fail(502, `Twenty answered ${res.status}.`)
  const body: any = await readJson(res).catch(() => ({}))
  const id = String(body?.data?.[r.kind]?.id ?? body?.data?.id ?? '')
  return { ok: true, data: { id, kind: r.kind } }
}

// ---------------------------------------------------------------- Postiz

export interface Channel { id: string; name: string; identifier: string; disabled: boolean }

export async function postizChannels(f: Fetcher, opts: { base: string; key?: string }): Promise<Outcome<{ channels: Channel[] }>> {
  const res = await send(f, `${opts.base}/integrations`, { headers: bearer(opts.key) }, 'Postiz')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 401) return fail(401, 'Postiz did not accept the key. Check the key under Connectors.')
  if (!res.ok) return fail(502, `Postiz answered ${res.status}.`)
  const body: any = await readJson(res).catch(() => [])
  const list: any[] = Array.isArray(body) ? body : []
  return {
    ok: true,
    data: { channels: list.slice(0, 100).map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? ''), identifier: String(c.identifier ?? ''), disabled: c.disabled === true })).filter((c) => c.id) },
  }
}

/**
 * Save a draft on one channel. Drafts only: publishing and scheduling stay with the
 * person in Postiz, so an agent cannot send anything on its own.
 */
export async function postizDraft(f: Fetcher, opts: { base: string; key?: string; channelId: string; text: string; now?: Date }): Promise<Outcome<{ postId: string; channel: string }>> {
  const text = opts.text.trim()
  if (!text) return fail(400, 'The post is empty.')
  if (text.length > 5000) return fail(400, 'The post is longer than 5,000 characters.')
  const channels = await postizChannels(f, { base: opts.base, key: opts.key })
  if (!channels.ok) return channels
  const channel = channels.data.channels.find((c) => c.id === opts.channelId)
  if (!channel) return fail(404, 'That channel is not connected in Postiz.')
  if (channel.disabled) return fail(409, `${channel.name} is disabled in Postiz.`)
  const payload = {
    type: 'draft',
    date: (opts.now ?? new Date()).toISOString(),
    shortLink: false,
    tags: [],
    posts: [{ integration: { id: channel.id }, value: [{ content: text, image: [] }], settings: { __type: channel.identifier } }],
  }
  const res = await send(f, `${opts.base}/posts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...bearer(opts.key) },
    body: JSON.stringify(payload),
  }, 'Postiz')
  if (isFailure(res)) return fail(res.status, res.error)
  if (res.status === 429) return fail(429, 'Postiz is rate-limiting this key. Try again later.')
  if (!res.ok) return fail(502, `Postiz answered ${res.status}.`)
  const body: any = await readJson(res).catch(() => [])
  const postId = String(Array.isArray(body) ? body[0]?.postId ?? '' : '')
  return { ok: true, data: { postId, channel: channel.name } }
}
