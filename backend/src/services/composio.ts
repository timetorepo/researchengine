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

export type ComposioResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number }

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

const catalogCache = new Map<string, { at: number; apps: ComposioApp[] }>()

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

/**
 * Start the OAuth flow for one app. Uses an enabled auth config for the toolkit
 * if the project has one; otherwise it creates a Composio-managed config. Returns
 * the URL the person opens to sign in.
 */
export async function startConnect(
  key: string,
  input: { toolkit: string; userId: string; callbackUrl: string },
): Promise<ComposioResult<{ redirectUrl: string; connectedAccountId?: string }>> {
  const found = await call(key, 'GET', `/api/v3.1/auth_configs?${new URLSearchParams({ toolkit_slug: input.toolkit, limit: '20' }).toString()}`)
  if (!found.ok) return found
  let authConfigId: string | undefined = (found.value?.items ?? []).find((c: any) => c?.status !== 'DISABLED' && c?.is_composio_managed !== false && c?.id)?.id
  if (!authConfigId) {
    const created = await call(key, 'POST', '/api/v3.1/auth_configs', { toolkit: { slug: input.toolkit } })
    if (!created.ok) return created
    authConfigId = created.value?.auth_config?.id
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
