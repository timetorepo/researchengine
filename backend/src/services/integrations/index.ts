// Integrations that actually talk to the real services.
//
// Every credential arrives with the request (`x-re-integrations`, a JSON map of
// id → { token?, refreshToken?, clientId?, clientSecret?, base? }) and is never
// written to disk by the backend, never logged, and never included in an error
// message. That mirrors how search keys work: the browser holds the secret (in
// the encrypted vault), the server is a stateless proxy for the duration of one
// call. A refresh token can be exchanged for a short-lived access token here,
// so a Google connection set up once keeps working without re-pasting anything.
import type { Runtime } from '../../runtime'

export type IntId = 'files' | 'drive' | 'gmail' | 'gcal' | 'github' | 'notion' | 'slack'

export interface IntCreds {
  token?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  /** Self-hosted base URL (Notion-compatible servers, GitHub Enterprise, Slack proxies). */
  base?: string
}

export interface IntHit {
  integration: IntId
  id: string
  title: string
  subtitle?: string
  url?: string
  snippet?: string
  date?: string
  kind: 'file' | 'message' | 'event' | 'issue' | 'page' | 'note'
}

export interface IntRead {
  integration: IntId
  id: string
  title: string
  url?: string
  text: string
  meta?: Record<string, unknown>
}

/** A result the caller must interpret: `needs: 'auth'` is not a failure, it is
 *  an instruction for the UI ("connect this account"), and it is what the agent
 *  is told so it can ask the user instead of inventing data. */
export interface IntOutcome<T> {
  ok: boolean
  data?: T
  error?: string
  needs?: 'auth' | 'network' | 'rate-limit'
}

export const INTEGRATION_DEFS: {
  id: IntId; name: string; auth: 'none' | 'token'; scopes: string[]; docs: string; hint: string
}[] = [
  {
    id: 'files', name: 'Local files', auth: 'none', scopes: ['read:workspace'],
    docs: '', hint: 'Everything in your Research Engine workspace folder. No account needed.',
  },
  {
    id: 'drive', name: 'Google Drive', auth: 'token', scopes: ['drive.readonly'],
    docs: 'https://developers.google.com/drive/api/guides/api-specific-auth',
    hint: 'A Google OAuth access token (or a refresh token + client id/secret) with drive.readonly.',
  },
  {
    id: 'gmail', name: 'Gmail', auth: 'token', scopes: ['gmail.readonly'],
    docs: 'https://developers.google.com/gmail/api/auth/scopes',
    hint: 'Same Google connection as Drive — gmail.readonly is enough to search and read mail.',
  },
  {
    id: 'gcal', name: 'Google Calendar', auth: 'token', scopes: ['calendar.readonly'],
    docs: 'https://developers.google.com/calendar/api/guides/auth',
    hint: 'calendar.readonly. Events are read only — nothing is ever written back.',
  },
  {
    id: 'github', name: 'GitHub', auth: 'token', scopes: ['repo:read', 'issues:read'],
    docs: 'https://github.com/settings/tokens',
    hint: 'A fine-grained token with read-only access to the repositories you want the agent to see.',
  },
  {
    id: 'notion', name: 'Notion', auth: 'token', scopes: ['read_content'],
    docs: 'https://www.notion.so/my-integrations',
    hint: 'An internal integration token — remember to share the pages with it in Notion.',
  },
  {
    id: 'slack', name: 'Slack', auth: 'token', scopes: ['search:read'],
    docs: 'https://api.slack.com/authentication/token-types',
    hint: 'A user token with search:read (bot tokens cannot search messages).',
  },
]

export const integrationDef = (id: string) => INTEGRATION_DEFS.find((d) => d.id === id)

/** Parse the per-request credential map. A malformed map is treated as empty. */
export function credsFrom(header: string | undefined | null): Record<string, IntCreds> {
  if (!header) return {}
  try {
    const parsed = JSON.parse(header)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, IntCreds> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
      if (!v || typeof v !== 'object') continue
      const creds: IntCreds = {}
      for (const field of ['token', 'refreshToken', 'clientId', 'clientSecret', 'base'] as const) {
        const raw = v[field]
        if (typeof raw === 'string' && raw) creds[field] = raw
      }
      if (Object.keys(creds).length) out[k] = creds
    }
    return out
  } catch { return {} }
}

const TIMEOUT_MS = 12_000

const mapStatus = (status: number, what: string): { error: string; needs?: IntOutcome<never>['needs'] } => {
  if (status === 401 || status === 403) return { error: `${what} refused the credential (${status}). Check the token and its scopes.`, needs: 'auth' }
  if (status === 404) return { error: `${what} has no such item (404).` }
  if (status === 429) return { error: `${what} is rate-limiting this token (429). Try again in a moment.`, needs: 'rate-limit' }
  return { error: `${what} answered ${status}.` }
}

/** One fetch, one timeout, no credential ever echoed back. */
async function jfetch(url: string, init: RequestInit & { json?: unknown } = {}, what = 'The service'): Promise<
  { ok: true; status: number; body: any; text: string; res: Response } | { ok: false; error: string; needs?: IntOutcome<never>['needs']; status?: number }
> {
  try {
    const headers = new Headers(init.headers)
    if (init.json !== undefined) headers.set('content-type', 'application/json')
    const res = await fetch(url, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = await res.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { body = null }
    if (!res.ok) {
      const mapped = mapStatus(res.status, what)
      // The service's own words are useful, but the status is what tells the
      // difference between "wrong token" and "you are not allowed to". Both.
      const detail = typeof body?.error?.message === 'string' ? body.error.message : typeof body?.message === 'string' ? body.message : ''
      const extra = detail && detail.length < 200 && !mapped.error.includes(detail) ? ` ${detail}` : ''
      return { ok: false, ...mapped, error: `${mapped.error}${extra}`, status: res.status }
    }
    return { ok: true, status: res.status, body, text, res }
  } catch (e: any) {
    const msg = String(e?.name === 'TimeoutError' ? `${what} did not answer in ${TIMEOUT_MS / 1000}s.` : (e?.message ?? e))
    return { ok: false, error: msg, needs: 'network' }
  }
}

/* ---------------- Google: access token, or a refresh exchange ---------------- */

async function googleToken(creds: IntCreds): Promise<IntOutcome<string>> {
  if (creds.token) return { ok: true, data: creds.token }
  if (!creds.refreshToken || !creds.clientId || !creds.clientSecret) {
    return { ok: false, error: 'This Google integration needs an access token, or a refresh token with a client id and secret.', needs: 'auth' }
  }
  const out = await jfetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  }, 'Google sign-in')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs ?? 'auth' }
  const token = out.body?.access_token
  if (!token) return { ok: false, error: 'Google did not return an access token.', needs: 'auth' }
  return { ok: true, data: token }
}

/* ---------------- adapters ---------------- */

/** Google Drive: search by name + full text, read text files and Docs. */
async function driveSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const escaped = q.replace(/'/g, "\\'")
  const query = q ? `(name contains '${escaped}' or fullText contains '${escaped}') and trashed = false` : 'trashed = false'
  const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
    q: query, pageSize: String(limit), orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size,owners(displayName))',
  })
  const out = await jfetch(url, { headers: { authorization: `Bearer ${token.data}` } }, 'Google Drive')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  const files = Array.isArray(out.body?.files) ? out.body.files : []
  return {
    ok: true,
    data: files.map((f: any): IntHit => ({
      integration: 'drive', id: String(f.id), title: String(f.name ?? 'Untitled'),
      subtitle: `${String(f.mimeType ?? '').replace('application/vnd.google-apps.', 'Google ')}${f.owners?.[0]?.displayName ? ` · ${f.owners[0].displayName}` : ''}`,
      url: f.webViewLink, date: f.modifiedTime, kind: 'file',
    })),
  }
}

async function driveRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const meta = await jfetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink,modifiedTime`, {
    headers: { authorization: `Bearer ${token.data}` },
  }, 'Google Drive')
  if (!meta.ok) return { ok: false, error: meta.error, needs: meta.needs }
  const mime = String(meta.body?.mimeType ?? '')
  const isDoc = mime.startsWith('application/vnd.google-apps')
  const url = isDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`
  const body = await jfetch(url, { headers: { authorization: `Bearer ${token.data}` } }, 'Google Drive')
  if (!body.ok) return { ok: false, error: body.error, needs: body.needs }
  const text = body.body === null ? body.text : JSON.stringify(body.body, null, 2)
  return {
    ok: true,
    data: {
      integration: 'drive', id, title: String(meta.body?.name ?? id), url: meta.body?.webViewLink,
      text: text.slice(0, 200_000), meta: { mimeType: mime, modifiedTime: meta.body?.modifiedTime },
    },
  }
}

/** Gmail: message search + full body read. */
async function gmailSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const auth = { authorization: `Bearer ${token.data}` }
  const list = await jfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?' + new URLSearchParams({ q, maxResults: String(limit) }), { headers: auth }, 'Gmail')
  if (!list.ok) return { ok: false, error: list.error, needs: list.needs }
  const ids: string[] = (list.body?.messages ?? []).map((m: any) => String(m.id)).slice(0, limit)
  const hits = await Promise.all(ids.map(async (mid): Promise<IntHit | null> => {
    const one = await jfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${mid}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: auth }, 'Gmail')
    if (!one.ok) return null
    const headers: any[] = one.body?.payload?.headers ?? []
    const head = (n: string) => String(headers.find((h) => String(h.name).toLowerCase() === n.toLowerCase())?.value ?? '')
    return {
      integration: 'gmail', id: mid, title: head('subject') || '(no subject)',
      subtitle: head('from'), snippet: String(one.body?.snippet ?? '').slice(0, 300),
      date: new Date(Number(one.body?.internalDate ?? Date.now())).toISOString(), kind: 'message',
    }
  }))
  return { ok: true, data: hits.filter(Boolean) as IntHit[] }
}

function decodeBase64Url(data: string): string {
  try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') } catch { return '' }
}

/** Walk a Gmail MIME tree and collect text/plain parts. */
function gmailText(payload: any): string {
  if (!payload) return ''
  const mime = String(payload.mimeType ?? '')
  if (payload.body?.data && (mime === 'text/plain' || !mime.startsWith('multipart'))) return decodeBase64Url(payload.body.data)
  const parts: any[] = payload.parts ?? []
  const plain = parts.filter((p) => String(p.mimeType) === 'text/plain').map(gmailText).filter(Boolean)
  if (plain.length) return plain.join('\n\n')
  const html = parts.filter((p) => String(p.mimeType) === 'text/html').map(gmailText).join('\n\n')
  if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return parts.map(gmailText).filter(Boolean).join('\n\n')
}

async function gmailRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const one = await jfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {
    headers: { authorization: `Bearer ${token.data}` },
  }, 'Gmail')
  if (!one.ok) return { ok: false, error: one.error, needs: one.needs }
  const headers: any[] = one.body?.payload?.headers ?? []
  const head = (n: string) => String(headers.find((h) => String(h.name).toLowerCase() === n.toLowerCase())?.value ?? '')
  const text = gmailText(one.body?.payload) || String(one.body?.snippet ?? '')
  return {
    ok: true,
    data: {
      integration: 'gmail', id, title: head('subject') || '(no subject)',
      text: `From: ${head('from')}\nTo: ${head('to')}\nDate: ${head('date')}\n\n${text}`.slice(0, 200_000),
      meta: { labels: one.body?.labelIds ?? [], threadId: one.body?.threadId },
    },
  }
}

/** Calendar: upcoming + matching events. */
async function gcalSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const params: Record<string, string> = {
    singleEvents: 'true', orderBy: 'startTime', maxResults: String(limit),
    timeMin: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  }
  if (q) params.q = q
  const out = await jfetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams(params), {
    headers: { authorization: `Bearer ${token.data}` },
  }, 'Google Calendar')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  const items: any[] = out.body?.items ?? []
  return {
    ok: true,
    data: items.map((e): IntHit => ({
      integration: 'gcal', id: String(e.id), title: String(e.summary ?? '(no title)'),
      subtitle: e.location ? String(e.location) : (e.attendees?.length ? `${e.attendees.length} invited` : ''),
      snippet: String(e.description ?? '').slice(0, 300),
      url: e.htmlLink, date: e.start?.dateTime ?? e.start?.date, kind: 'event',
    })),
  }
}

async function gcalRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  const token = await googleToken(creds)
  if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
  const out = await jfetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${token.data}` },
  }, 'Google Calendar')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  const e = out.body ?? {}
  const when = e.start?.dateTime ?? e.start?.date ?? ''
  const attendees = (e.attendees ?? []).map((a: any) => a.email).filter(Boolean).join(', ')
  return {
    ok: true,
    data: {
      integration: 'gcal', id, title: String(e.summary ?? '(no title)'), url: e.htmlLink,
      text: [
        `When: ${when}${e.end?.dateTime ? ` – ${e.end.dateTime}` : ''}`,
        e.location ? `Where: ${e.location}` : '',
        attendees ? `With: ${attendees}` : '',
        e.description ? `\n${String(e.description)}` : '',
      ].filter(Boolean).join('\n').slice(0, 100_000),
      meta: { organizer: e.organizer?.email, status: e.status },
    },
  }
}

/** GitHub: issues/PRs and code search. */
async function githubSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  if (!creds.token) return { ok: false, error: 'GitHub needs a personal access token.', needs: 'auth' }
  const api = (creds.base ?? 'https://api.github.com').replace(/\/$/, '')
  const headers = { authorization: `Bearer ${creds.token}`, accept: 'application/vnd.github+json', 'user-agent': 'research-engine' }
  const [issues, code] = await Promise.all([
    jfetch(`${api}/search/issues?${new URLSearchParams({ q, per_page: String(Math.ceil(limit / 2)) })}`, { headers }, 'GitHub'),
    q ? jfetch(`${api}/search/code?${new URLSearchParams({ q, per_page: String(Math.floor(limit / 2)) })}`, { headers }, 'GitHub') : Promise.resolve(null),
  ])
  if (!issues.ok) return { ok: false, error: issues.error, needs: issues.needs }
  const hits: IntHit[] = (issues.body?.items ?? []).map((i: any): IntHit => ({
    integration: 'github', id: `issue:${i.number}`, title: String(i.title ?? '(untitled)'),
    subtitle: `${i.repository_url?.split('/').slice(-2).join('/') ?? ''} · ${i.pull_request ? 'pull request' : 'issue'} · ${i.state}`,
    url: i.html_url, snippet: String(i.body ?? '').slice(0, 300), date: i.updated_at, kind: 'issue',
  }))
  if (code && code.ok) {
    for (const c of code.body?.items ?? []) {
      hits.push({
        integration: 'github', id: `code:${c.repository?.full_name}:${c.path}`, title: String(c.path),
        subtitle: `${c.repository?.full_name ?? ''} · code`, url: c.html_url, kind: 'file',
      })
    }
  } else if (code && !code.ok && code.needs === 'auth') {
    // Code search needs a token with the right scope; the issue search still works.
  }
  return { ok: true, data: hits }
}

async function githubRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  if (!creds.token) return { ok: false, error: 'GitHub needs a personal access token.', needs: 'auth' }
  const api = (creds.base ?? 'https://api.github.com').replace(/\/$/, '')
  const headers = { authorization: `Bearer ${creds.token}`, accept: 'application/vnd.github+json', 'user-agent': 'research-engine' }
  if (id.startsWith('code:')) {
    const [, repo, ...rest] = id.split(':')
    const path = rest.join(':')
    const out = await jfetch(`${api}/repos/${repo}/contents/${path}`, { headers }, 'GitHub')
    if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
    const text = out.body?.content ? decodeBase64Url(String(out.body.content)) : ''
    return { ok: true, data: { integration: 'github', id, title: `${repo}/${path}`, url: out.body?.html_url, text: text.slice(0, 200_000) } }
  }
  return { ok: false, error: 'Open an issue or a file from a GitHub search result to read it.' }
}

/** Notion: workspace search + page text. */
async function notionSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  if (!creds.token) return { ok: false, error: 'Notion needs an internal integration token.', needs: 'auth' }
  const api = (creds.base ?? 'https://api.notion.com').replace(/\/$/, '')
  const out = await jfetch(`${api}/v1/search`, {
    method: 'POST',
    headers: { authorization: `Bearer ${creds.token}`, 'notion-version': '2022-06-28' },
    json: { query: q, page_size: limit },
  }, 'Notion')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  const results: any[] = out.body?.results ?? []
  return {
    ok: true,
    data: results.map((r): IntHit => {
      const title = (r.properties?.title?.title ?? r.properties?.Name?.title ?? []).map((t: any) => t.plain_text).join('')
        || (r.title ?? []).map((t: any) => t.plain_text).join('') || '(untitled)'
      return {
        integration: 'notion', id: String(r.id), title: title || '(untitled)',
        subtitle: r.object === 'database' ? 'database' : 'page',
        url: r.url, date: r.last_edited_time, kind: 'page',
      }
    }),
  }
}

async function notionRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  if (!creds.token) return { ok: false, error: 'Notion needs an internal integration token.', needs: 'auth' }
  const api = (creds.base ?? 'https://api.notion.com').replace(/\/$/, '')
  const headers = { authorization: `Bearer ${creds.token}`, 'notion-version': '2022-06-28' }
  const out = await jfetch(`${api}/v1/blocks/${encodeURIComponent(id)}/children?page_size=100`, { headers }, 'Notion')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  const line = (b: any): string => {
    const rich = b[b.type]?.rich_text ?? []
    const text = rich.map((r: any) => r.plain_text).join('')
    return b.type === 'bulleted_list_item' || b.type === 'numbered_list_item' ? `- ${text}` : text
  }
  const text = (out.body?.results ?? []).map(line).filter(Boolean).join('\n')
  return { ok: true, data: { integration: 'notion', id, title: 'Notion page', text: text.slice(0, 200_000) } }
}

/** Slack: message search (the body comes back with the results). */
async function slackSearch(q: string, creds: IntCreds, limit: number): Promise<IntOutcome<IntHit[]>> {
  if (!creds.token) return { ok: false, error: 'Slack needs a user token with search:read.', needs: 'auth' }
  const api = (creds.base ?? 'https://slack.com/api').replace(/\/$/, '')
  const out = await jfetch(`${api}/search.messages?${new URLSearchParams({ query: q, count: String(limit) })}`, {
    headers: { authorization: `Bearer ${creds.token}` },
  }, 'Slack')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  if (out.body?.ok === false) {
    const err = String(out.body?.error ?? 'unknown_error')
    return { ok: false, error: `Slack: ${err}${err === 'not_allowed_token_type' ? ' — use a user token with search:read.' : ''}`, needs: 'auth' }
  }
  const matches: any[] = out.body?.messages?.matches ?? []
  return {
    ok: true,
    data: matches.map((m): IntHit => ({
      integration: 'slack', id: `${m.channel?.id ?? 'ch'}:${m.ts}`, title: String(m.text ?? '').slice(0, 120) || '(message)',
      subtitle: `#${m.channel?.name ?? 'channel'}${m.username ? ` · ${m.username}` : ''}`,
      snippet: String(m.text ?? '').slice(0, 300),
      url: m.permalink, date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : undefined, kind: 'message',
    })),
  }
}

async function slackRead(id: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  if (!creds.token) return { ok: false, error: 'Slack needs a user token with search:read.', needs: 'auth' }
  const api = (creds.base ?? 'https://slack.com/api').replace(/\/$/, '')
  const [channel, ts] = id.split(':')
  const out = await jfetch(`${api}/conversations.replies?${new URLSearchParams({ channel, ts })}`, {
    headers: { authorization: `Bearer ${creds.token}` },
  }, 'Slack')
  if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
  if (out.body?.ok === false) return { ok: false, error: `Slack: ${String(out.body?.error ?? 'unknown_error')}`, needs: 'auth' }
  const msgs: any[] = out.body?.messages ?? []
  return {
    ok: true,
    data: {
      integration: 'slack', id, title: `Slack thread (${msgs.length} message${msgs.length === 1 ? '' : 's'})`,
      text: msgs.map((m) => `${m.user ?? 'someone'}: ${m.text ?? ''}`).join('\n').slice(0, 100_000),
    },
  }
}

/** Local workspace files (no account, always available). */
async function filesSearch(rt: Runtime, q: string, limit: number): Promise<IntOutcome<IntHit[]>> {
  const { readdir, stat } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const root = join(rt.dataDir, 'files')
  const hits: IntHit[] = []
  const walk = async (dir: string, depth: number) => {
    if (depth > 2 || hits.length >= limit) return
    let entries: string[] = []
    try { entries = await readdir(dir) } catch { return }
    for (const name of entries) {
      if (hits.length >= limit) return
      const full = join(dir, name)
      let st: any = null
      try { st = await stat(full) } catch { continue }
      if (st.isDirectory()) { await walk(full, depth + 1); continue }
      if (q && !name.toLowerCase().includes(q.toLowerCase())) continue
      hits.push({
        integration: 'files', id: name, title: name,
        subtitle: `${Math.max(1, Math.round(st.size / 1024))} KB${depth ? ` · ${full.slice(root.length + 1).split(/[\\/]/).slice(0, -1).join('/')}` : ''}`,
        date: new Date(st.mtimeMs).toISOString(), kind: 'file',
      })
    }
  }
  await walk(root, 0)
  return { ok: true, data: hits }
}

/* ---------------- the surface ---------------- */

export async function searchIntegration(
  rt: Runtime, id: IntId, q: string, creds: IntCreds, limit = 12,
): Promise<IntOutcome<IntHit[]>> {
  switch (id) {
    case 'files': return filesSearch(rt, q, limit)
    case 'drive': return driveSearch(q, creds, limit)
    case 'gmail': return gmailSearch(q, creds, limit)
    case 'gcal': return gcalSearch(q, creds, limit)
    case 'github': return githubSearch(q, creds, limit)
    case 'notion': return notionSearch(q, creds, limit)
    case 'slack': return slackSearch(q, creds, limit)
    default: return { ok: false, error: `Unknown integration "${id}".` }
  }
}

export async function readIntegration(rt: Runtime, id: IntId, itemId: string, creds: IntCreds): Promise<IntOutcome<IntRead>> {
  switch (id) {
    case 'files': {
      const { readFile } = await import('node:fs/promises')
      const { join, basename } = await import('node:path')
      try {
        const text = await readFile(join(rt.dataDir, 'files', basename(itemId)), 'utf8')
        return { ok: true, data: { integration: 'files', id: itemId, title: itemId, text: text.slice(0, 200_000) } }
      } catch (e: any) {
        return { ok: false, error: `Could not read ${itemId}: ${String(e?.message ?? e)}` }
      }
    }
    case 'drive': return driveRead(itemId, creds)
    case 'gmail': return gmailRead(itemId, creds)
    case 'gcal': return gcalRead(itemId, creds)
    case 'github': return githubRead(itemId, creds)
    case 'notion': return notionRead(itemId, creds)
    case 'slack': return slackRead(itemId, creds)
    default: return { ok: false, error: `Unknown integration "${id}".` }
  }
}

/** A cheap authenticated call that proves the credential works and names the account. */
export async function probeIntegration(id: IntId, creds: IntCreds): Promise<IntOutcome<{ account?: string; detail: string }>> {
  switch (id) {
    case 'files': return { ok: true, data: { detail: 'Your local workspace folder — always available.' } }
    case 'drive':
    case 'gmail':
    case 'gcal': {
      const token = await googleToken(creds)
      if (!token.ok) return { ok: false, error: token.error, needs: token.needs }
      const out = await jfetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${token.data}` } }, 'Google')
      if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
      const scopes = out.res.headers.get('x-oauth-scopes') ?? ''
      return { ok: true, data: { account: String(out.body?.email ?? ''), detail: scopes ? `Scopes: ${scopes}` : 'Signed in.' } }
    }
    case 'github': {
      if (!creds.token) return { ok: false, error: 'GitHub needs a personal access token.', needs: 'auth' }
      const api = (creds.base ?? 'https://api.github.com').replace(/\/$/, '')
      const out = await jfetch(`${api}/user`, { headers: { authorization: `Bearer ${creds.token}`, 'user-agent': 'research-engine' } }, 'GitHub')
      if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
      const scopes = out.res.headers.get('x-oauth-scopes')
      return { ok: true, data: { account: String(out.body?.login ?? ''), detail: scopes ? `Scopes: ${scopes}` : `Signed in as ${String(out.body?.login ?? '')}.` } }
    }
    case 'notion': {
      if (!creds.token) return { ok: false, error: 'Notion needs an internal integration token.', needs: 'auth' }
      const api = (creds.base ?? 'https://api.notion.com').replace(/\/$/, '')
      const out = await jfetch(`${api}/v1/users/me`, { headers: { authorization: `Bearer ${creds.token}`, 'notion-version': '2022-06-28' } }, 'Notion')
      if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
      return { ok: true, data: { account: String(out.body?.name ?? out.body?.bot?.owner?.user?.name ?? ''), detail: 'Integration token accepted.' } }
    }
    case 'slack': {
      if (!creds.token) return { ok: false, error: 'Slack needs a user token with search:read.', needs: 'auth' }
      const api = (creds.base ?? 'https://slack.com/api').replace(/\/$/, '')
      const out = await jfetch(`${api}/auth.test`, { headers: { authorization: `Bearer ${creds.token}` } }, 'Slack')
      if (!out.ok) return { ok: false, error: out.error, needs: out.needs }
      if (out.body?.ok === false) return { ok: false, error: `Slack: ${String(out.body?.error ?? 'unknown_error')}`, needs: 'auth' }
      return { ok: true, data: { account: String(out.body?.user ?? ''), detail: `Team ${String(out.body?.team ?? '')}.` } }
    }
    default: return { ok: false, error: `Unknown integration "${id}".` }
  }
}
