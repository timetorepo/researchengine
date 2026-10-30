/**
 * Composio, from the server's side: the catalog of apps it supports, connected
 * accounts (the user's signed-in apps), the OAuth link that connects one, and
 * tool execution on a connected account.
 *
 * The project API key comes from the caller on every request (`x-re-composio-key`).
 * It is used for that request only, never written, logged or echoed back. The
 * catalog is cached in memory for a few minutes, keyed by a hash of the key, so
 * the key itself is never a cache key.
 *
 * Endpoints used (Composio REST, v3.1, base https://backend.composio.dev):
 *   GET  /api/v3.1/toolkits                 catalog, paged by cursor
 *   GET  /api/v3.1/connected_accounts       accounts for a user id
 *   GET  /api/v3.1/auth_configs             auth config per toolkit
 *   POST /api/v3.1/auth_configs             create one (Composio-managed)
 *   POST /api/v3.1/connected_accounts/link  OAuth link → redirect_url
 *   DELETE /api/v3.1/connected_accounts/:id remove an account
 *   GET  /api/v3.1/tools                    tools of one toolkit
 *   POST /api/v3.1/tools/execute/:slug      run a tool on an account
 */
import { createHash } from 'node:crypto'
import { BoundedMap } from './boundedMap'

export const COMPOSIO_BASE = 'https://backend.composio.dev'
const TIMEOUT_MS = 20_000
const CATALOG_TTL_MS = 5 * 60_000
const MAX_CATALOG_PAGES = 10

export interface ComposioApp {
  slug: string
  name: string
  description: string
  logo?: string
  categories: string[]
  authSchemes: string[]
  noAuth: boolean
  toolsCount: number
}

export interface ComposioAccount {
  id: string
  toolkit: string
  status: string
  alias?: string
  userId?: string
  createdAt?: string
}

export interface ComposioTool {
  slug: string
  name: string
  description: string
}

/** `code` is set when the caller can fix the request, e.g. `needs_app_credentials`. */
export type ComposioResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number; code?: string }

/** Where Composio receives the provider's OAuth redirect. Register this URL in the provider's app. */
export const COMPOSIO_OAUTH_CALLBACK = 'https://backend.composio.dev/api/v3/toolkits/auth/callback'

/** The user's own developer app for one toolkit (Spotify and others have no Composio-managed OAuth). */
export interface AppCredentials { clientId: string; clientSecret: string; scopes?: string }

/** The name Research Engine gives the auth config it owns for a toolkit. Found again on reconnect. */
const OWN_CONFIG_NAME = (toolkit: string) => `Research Engine · ${toolkit}`

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/
const TOOL_SLUG = /^[A-Z0-9][A-Z0-9_]{1,119}$/

export function isToolkitSlug(v: string): boolean { return SLUG.test(v) }
export function isToolSlug(v: string): boolean { return TOOL_SLUG.test(v) }

/** A short fingerprint of the key, for cache keys only. */
export function keyFingerprint(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/**
 * Composio has three kinds of key and each one travels in its own header: a
 * project key in x-api-key, a user key (uak_…) in x-user-api-key, an organization
 * key in x-org-api-key. Sending the wrong kind is refused with a 401, so the
 * server works out which kind it was given. The first request tries the three
 * headers in turn; the one that works is remembered for this key (by fingerprint
 * only, never the key itself).
 */
const KEY_HEADERS = ['x-api-key', 'x-user-api-key', 'x-org-api-key'] as const
const headerByKey = new Map<string, string>()
const NOT_ACCEPTED =
  'Composio did not accept this key. Copy the project API key from the Composio dashboard (Settings → Project Settings → API Keys), or a user key that starts with uak_.'

async function send(key: string, header: string, method: string, path: string, body?: unknown): Promise<ComposioResult<any>> {
  let res: Response
  try {
    res = await fetch(`${COMPOSIO_BASE}${path}`, {
      method,
      headers: {
        [header]: key,
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, error: 'Composio did not answer. Check the connection and try again.', status: 502 }
  }
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? json?.error ?? `Composio answered ${res.status}.`
    const status = res.status === 401 || res.status === 403 ? 401 : res.status === 404 ? 404 : res.status === 429 ? 429 : 502
    return { ok: false, error: typeof msg === 'string' ? msg.slice(0, 300) : `Composio answered ${res.status}.`, status }
  }
  return { ok: true, value: json }
}

const CONSUMER_KEY_MSG =
  'That is a Connect consumer key (it starts with ck_). Composio uses it for its Connect MCP endpoint, not for this API. Connectors needs the project API key, which starts with ak_: Composio dashboard → Settings → Project Settings → API Keys.'

/** The header this key goes in. Probes the three kinds once; a key nobody accepts gets no header. */
async function headerFor(key: string): Promise<ComposioResult<string>> {
  if (key.startsWith('ck_')) return { ok: false, error: CONSUMER_KEY_MSG, status: 400 }
  const fp = keyFingerprint(key)
  const known = headerByKey.get(fp)
  if (known) return { ok: true, value: known }
  for (const header of KEY_HEADERS) {
    const r = await send(key, header, 'GET', '/api/v3.1/toolkits?limit=1')
    if (r.ok) { headerByKey.set(fp, header); return { ok: true, value: header } }
    // Only a refusal says "wrong kind". Anything else (network, server) is not about the key kind.
    if (r.status !== 401) return { ok: false, error: r.error, status: r.status }
  }
  return { ok: false, error: NOT_ACCEPTED, status: 401 }
}

async function call(key: string, method: string, path: string, body?: unknown): Promise<ComposioResult<any>> {
  const h = await headerFor(key)
  if (!h.ok) return h
  return send(key, h.value, method, path, body)
}

function asApp(raw: any): ComposioApp | null {
  if (!raw || typeof raw.slug !== 'string') return null
  if (raw.deprecated === true) return null
  const meta = raw.meta ?? {}
  return {
    slug: raw.slug,
    name: String(raw.name ?? raw.slug),
    description: String(meta.description ?? '').slice(0, 300),
    logo: typeof meta.logo === 'string' ? meta.logo : undefined,
    categories: Array.isArray(meta.categories) ? meta.categories.map((c: any) => String(c?.name ?? c?.id ?? '')).filter(Boolean) : [],
    authSchemes: Array.isArray(raw.auth_schemes) ? raw.auth_schemes.map(String) : [],
    noAuth: raw.no_auth === true,
    toolsCount: Number(meta.tools_count) || 0,
  }
}

const catalogCache = new BoundedMap<string, { at: number; apps: ComposioApp[] }>(8)

/** Every toolkit the project can see, paged until the end. Cached for a few minutes. */
export async function listApps(key: string, opts: { refresh?: boolean } = {}): Promise<ComposioResult<ComposioApp[]>> {
  const fp = keyFingerprint(key)
  const hit = catalogCache.get(fp)
  if (hit && !opts.refresh && Date.now() - hit.at < CATALOG_TTL_MS) return { ok: true, value: hit.apps }
  const apps: ComposioApp[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
    const q = new URLSearchParams({ limit: '1000', sort_by: 'alphabetically' })
    if (cursor) q.set('cursor', cursor)
    const r = await call(key, 'GET', `/api/v3.1/toolkits?${q.toString()}`)
    if (!r.ok) return r
    for (const item of r.value?.items ?? []) {
      const app = asApp(item)
      if (app) apps.push(app)
    }
    cursor = typeof r.value?.next_cursor === 'string' && r.value.next_cursor ? r.value.next_cursor : undefined
    if (!cursor) break
  }
  apps.sort((a, b) => a.name.localeCompare(b.name))
  if (apps.length) catalogCache.set(fp, { at: Date.now(), apps })
  return { ok: true, value: apps }
}

/** Cheap check that the key works. */
export async function checkKey(key: string): Promise<ComposioResult<{ apps: number }>> {
  const r = await call(key, 'GET', '/api/v3.1/toolkits?limit=1')
  if (!r.ok) return r
  return { ok: true, value: { apps: Number(r.value?.total_items) || (r.value?.items?.length ?? 0) } }
}

export async function listAccounts(key: string, userId: string): Promise<ComposioResult<ComposioAccount[]>> {
  const r = await call(key, 'GET', `/api/v3.1/connected_accounts?${new URLSearchParams({ user_ids: userId, limit: '200' }).toString()}`)
  if (!r.ok) return r
  const items: ComposioAccount[] = (r.value?.items ?? []).map((a: any) => ({
    id: String(a.id),
    toolkit: String(a.toolkit?.slug ?? ''),
    status: String(a.status ?? ''),
    alias: typeof a.alias === 'string' ? a.alias : undefined,
    userId: typeof a.user_id === 'string' ? a.user_id : undefined,
    createdAt: typeof a.created_at === 'string' ? a.created_at : undefined,
  }))
  return { ok: true, value: items }
}

/** One field a sign-in needs (an API key, a subdomain, …), as Composio names it. */
export interface KeyField { name: string; label: string; description: string; secret: boolean }

/** How one toolkit signs in, read from Composio's toolkit metadata (not hardcoded). */
export interface ToolkitAuth {
  schemes: string[]
  oauth: boolean
  noAuth: boolean
  /** The non-OAuth scheme (API_KEY, BEARER_TOKEN, BASIC …), when the toolkit has one. */
  keyScheme?: string
  keyFields: KeyField[]
}

const OAUTH_RE = /OAUTH|DCR/i

/** The sign-in schemes for one toolkit and the fields a key-based sign-in asks for. */
export async function toolkitAuth(key: string, slug: string): Promise<ComposioResult<ToolkitAuth>> {
  const r = await call(key, 'GET', `/api/v3.1/toolkits/${encodeURIComponent(slug)}`)
  if (!r.ok) return r
  const details: any[] = Array.isArray(r.value?.auth_config_details) ? r.value.auth_config_details : []
  const modes = details.map((d) => String(d?.mode ?? '').toUpperCase()).filter(Boolean)
  const keyDetail = details.find((d) => !OAUTH_RE.test(String(d?.mode ?? '')) && String(d?.mode ?? '').trim() !== '')
  const required: any[] = keyDetail?.fields?.connected_account_initiation?.required ?? []
  const keyFields: KeyField[] = required
    .filter((f) => typeof f?.name === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(f.name))
    .map((f) => ({
      name: f.name,
      label: String(f.displayName ?? f.name).slice(0, 80),
      description: String(f.description ?? '').slice(0, 240),
      secret: f.is_secret === true,
    }))
  return {
    ok: true,
    value: {
      schemes: modes,
      oauth: modes.some((m) => OAUTH_RE.test(m)),
      noAuth: r.value?.no_auth === true,
      keyScheme: keyDetail ? String(keyDetail.mode).toUpperCase() : undefined,
      keyFields,
    },
  }
}

/**
 * Start sign-in for one app. Which path runs depends on how the app signs in:
 *  - OAuth (the default when the app offers it): the person's own developer app
 *    (`appCredentials`), else an existing or managed sign-in config. Returns a
 *    `redirectUrl` to open. If Composio has no managed OAuth, the result carries
 *    `code: 'needs_app_credentials'`.
 *  - API key, bearer or basic (no OAuth offered): the key goes straight to Composio
 *    in `fields`, and the connection is active at once. No window opens. Without the
 *    key the result carries `code: 'needs_key'` and the fields to ask for.
 *  - No sign-in at all: the connection is created without credentials.
 */
export async function startConnect(
  key: string,
  input: { toolkit: string; userId: string; callbackUrl: string; appCredentials?: AppCredentials; fields?: Record<string, string> },
): Promise<ComposioResult<{ redirectUrl?: string; connected?: boolean; connectedAccountId?: string }>> {
  const found = await call(key, 'GET', `/api/v3.1/auth_configs?${new URLSearchParams({ toolkit_slug: input.toolkit, limit: '20' }).toString()}`)
  if (!found.ok) return found
  const items: any[] = found.value?.items ?? []
  const live = items.filter((c) => c?.status !== 'DISABLED' && c?.id)

  const meta = await toolkitAuth(key, input.toolkit)
  if (!meta.ok) return meta
  const t = meta.value
  if (!t.oauth && !input.appCredentials && (t.keyScheme || t.noAuth)) {
    if (t.keyScheme) return connectWithKey(key, input, t, live)
    return connectWithoutSignIn(key, input, live)
  }

  let authConfigId: string | undefined

  if (input.appCredentials) {
    const name = OWN_CONFIG_NAME(input.toolkit)
    const credentials: Record<string, string> = {
      client_id: input.appCredentials.clientId,
      client_secret: input.appCredentials.clientSecret,
      oauth_redirect_uri: COMPOSIO_OAUTH_CALLBACK,
    }
    if (input.appCredentials.scopes) credentials.scopes = input.appCredentials.scopes
    const own = live.find((c) => c.name === name)
    if (own) {
      const updated = await call(key, 'PATCH', `/api/v3.1/auth_configs/${encodeURIComponent(own.id)}`, { type: 'custom', credentials })
      if (!updated.ok) return updated
      authConfigId = own.id
    } else {
      const created = await call(key, 'POST', '/api/v3.1/auth_configs', {
        toolkit: { slug: input.toolkit },
        auth_config: { type: 'use_custom_auth', auth_scheme: 'OAUTH2', name, credentials },
      })
      if (!created.ok) return created
      authConfigId = created.value?.auth_config?.id
    }
  } else {
    authConfigId = (live.find((c) => c.is_composio_managed !== false) ?? live[0])?.id
    if (!authConfigId) {
      const created = await call(key, 'POST', '/api/v3.1/auth_configs', { toolkit: { slug: input.toolkit } })
      if (!created.ok) {
        return {
          ok: false,
          status: 409,
          code: 'needs_app_credentials',
          error: `${input.toolkit} has no sign-in that Composio manages for this project. Add your own ${input.toolkit} developer app, then connect again.`,
        }
      }
      authConfigId = created.value?.auth_config?.id
    }
  }
  if (!authConfigId) return { ok: false, error: `Composio has no sign-in for ${input.toolkit} that this project can use.`, status: 422 }

  const link = await call(key, 'POST', '/api/v3.1/connected_accounts/link', {
    auth_config_id: authConfigId,
    user_id: input.userId,
    callback_url: input.callbackUrl,
  })
  if (!link.ok) return link
  if (typeof link.value?.redirect_url !== 'string') return { ok: false, error: 'Composio did not return a sign-in link.', status: 502 }
  return {
    ok: true,
    value: {
      redirectUrl: link.value.redirect_url,
      connectedAccountId: typeof link.value.connected_account_id === 'string' ? link.value.connected_account_id : undefined,
    },
  }
}

/** API key / bearer / basic: the values are stored by Composio on the connected account. */
async function connectWithKey(
  key: string,
  input: { toolkit: string; userId: string; fields?: Record<string, string> },
  t: ToolkitAuth,
  live: any[],
): Promise<ComposioResult<{ connected: true; connectedAccountId?: string }>> {
  const scheme = t.keyScheme as string
  const label = t.keyFields.map((f) => f.label).join(', ') || 'the key'
  if (!input.fields) {
    return { ok: false, status: 422, code: 'needs_key', error: `${input.toolkit} signs in with ${scheme.toLowerCase()}. Enter ${label} to connect.` }
  }
  const val: Record<string, string> = {}
  for (const f of t.keyFields) {
    const v = (input.fields[f.name] ?? '').trim()
    if (!v) return { ok: false, status: 422, code: 'needs_key', error: `Enter ${f.label} to connect.` }
    val[f.name] = v
  }
  if (t.keyFields.length === 0) {
    const v = (input.fields.generic_api_key ?? '').trim()
    if (!v) return { ok: false, status: 422, code: 'needs_key', error: `Enter the key for ${input.toolkit}.` }
    val.generic_api_key = v
  }

  let authConfigId = live.find((c) => String(c.auth_scheme ?? '').toUpperCase() === scheme)?.id
  if (!authConfigId) {
    const created = await call(key, 'POST', '/api/v3.1/auth_configs', {
      toolkit: { slug: input.toolkit },
      auth_config: { type: 'use_custom_auth', auth_scheme: scheme, name: `Research Engine · ${input.toolkit} · ${scheme}`, credentials: {} },
    })
    if (!created.ok) return created
    authConfigId = created.value?.auth_config?.id
  }
  if (!authConfigId) return { ok: false, status: 502, error: `Composio did not create a sign-in for ${input.toolkit}.` }

  const acct = await call(key, 'POST', '/api/v3.1/connected_accounts', {
    auth_config: { id: authConfigId },
    connection: { user_id: input.userId, state: { authScheme: scheme, val: { ...val, status: 'ACTIVE' } } },
    validate_credentials: true,
  })
  if (!acct.ok) return acct
  const status = String(acct.value?.status ?? 'ACTIVE').toUpperCase()
  if (status !== 'ACTIVE') {
    return { ok: false, status: 502, error: `Composio saved the connection, but it is ${status.toLowerCase()}. Check the key and try again.` }
  }
  return { ok: true, value: { connected: true, connectedAccountId: typeof acct.value?.id === 'string' ? acct.value.id : undefined } }
}

/** No sign-in at all: the connection is created for the person without credentials. */
async function connectWithoutSignIn(
  key: string,
  input: { toolkit: string; userId: string },
  live: any[],
): Promise<ComposioResult<{ connected: true; connectedAccountId?: string }>> {
  let authConfigId = live[0]?.id
  if (!authConfigId) {
    const created = await call(key, 'POST', '/api/v3.1/auth_configs', { toolkit: { slug: input.toolkit } })
    if (!created.ok) return created
    authConfigId = created.value?.auth_config?.id
  }
  if (!authConfigId) return { ok: false, status: 422, error: `${input.toolkit} has no sign-in this project can use.` }
  const acct = await call(key, 'POST', '/api/v3.1/connected_accounts', { auth_config: { id: authConfigId }, connection: { user_id: input.userId } })
  if (!acct.ok) return acct
  return { ok: true, value: { connected: true, connectedAccountId: typeof acct.value?.id === 'string' ? acct.value.id : undefined } }
}

export async function removeAccount(key: string, accountId: string): Promise<ComposioResult<{ removed: true }>> {
  const r = await call(key, 'DELETE', `/api/v3.1/connected_accounts/${encodeURIComponent(accountId)}`)
  if (!r.ok) return r
  return { ok: true, value: { removed: true } }
}

export async function listTools(key: string, toolkit: string): Promise<ComposioResult<ComposioTool[]>> {
  const q = new URLSearchParams({ toolkit_slug: toolkit, limit: '100' })
  const r = await call(key, 'GET', `/api/v3.1/tools?${q.toString()}`)
  if (!r.ok) return r
  const tools: ComposioTool[] = (r.value?.items ?? [])
    .filter((t: any) => typeof t?.slug === 'string')
    .map((t: any) => ({ slug: t.slug, name: String(t.name ?? t.slug), description: String(t.description ?? '').slice(0, 240) }))
  return { ok: true, value: tools }
}

export async function executeTool(
  key: string,
  input: { tool: string; userId: string; connectedAccountId?: string; arguments: Record<string, unknown> },
): Promise<ComposioResult<{ successful: boolean; data: unknown; error?: string }>> {
  const body: Record<string, unknown> = {
    user_id: input.userId,
    arguments: input.arguments,
    version: 'latest',
  }
  if (input.connectedAccountId) body.connected_account_id = input.connectedAccountId
  const r = await call(key, 'POST', `/api/v3.1/tools/execute/${encodeURIComponent(input.tool)}?toolkit_versions=latest`, body)
  if (!r.ok) return r
  return {
    ok: true,
    value: {
      successful: r.value?.successful !== false && !r.value?.error,
      data: r.value?.data ?? null,
      error: typeof r.value?.error === 'string' ? r.value.error.slice(0, 500) : undefined,
    },
  }
}
