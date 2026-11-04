// Pipedream Connect, from the server's side. A second connector provider next to Composio.
//
// The person's own Pipedream OAuth client (client ID + secret), project ID and
// environment arrive with each request in headers and are used for that request only.
// The only thing kept between requests is the short-lived access token Pipedream issues
// for those credentials (about an hour), cached in memory and keyed by a fingerprint.
//
// Endpoints used (api.pipedream.com/v1):
//   POST   /oauth/token                                   client credentials → access token
//   GET    /connect/apps                                  the catalogue of apps (q, limit)
//   POST   /connect/{project}/tokens                      a Connect token → connect_link_url
//   GET    /connect/{project}/users/{user}/accounts       the accounts one user connected
//   DELETE /connect/{project}/accounts/{account}          disconnect one account
import { createHash } from 'node:crypto'

const API = 'https://api.pipedream.com/v1'
const TIMEOUT_MS = 15_000
const ENVIRONMENTS = ['development', 'production'] as const
export type PipedreamEnvironment = typeof ENVIRONMENTS[number]

export interface PipedreamCredentials {
  clientId: string
  clientSecret: string
  projectId: string
  environment: PipedreamEnvironment
}

export type PipedreamResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

const PROJECT = /^proj_[A-Za-z0-9]{4,64}$/
const SLUG = /^[a-z0-9][a-z0-9_-]{0,80}$/i
const USER = /^[A-Za-z0-9_.@:-]{1,128}$/

/** Checks the credentials' shape. Nothing is sent anywhere by this check. */
export function parsePipedreamCredentials(raw: unknown): PipedreamCredentials | null {
  const o = raw as Record<string, unknown> | null
  if (!o || typeof o !== 'object') return null
  const clientId = typeof o.clientId === 'string' ? o.clientId.trim() : ''
  const clientSecret = typeof o.clientSecret === 'string' ? o.clientSecret.trim() : ''
  const projectId = typeof o.projectId === 'string' ? o.projectId.trim() : ''
  const environment = o.environment
  if (!clientId || clientId.length > 200) return null
  if (!clientSecret || clientSecret.length > 400) return null
  if (!PROJECT.test(projectId)) return null
  if (!ENVIRONMENTS.includes(environment as PipedreamEnvironment)) return null
  return { clientId, clientSecret, projectId, environment: environment as PipedreamEnvironment }
}

export function isPipedreamUser(id: string): boolean {
  return USER.test(id)
}

export function isPipedreamSlug(slug: string): boolean {
  return SLUG.test(slug)
}

// --- access tokens -----------------------------------------------------------

interface CachedToken { token: string; expiresAt: number }
const tokens = new Map<string, CachedToken>()
const REFRESH_MARGIN_MS = 5 * 60_000

function fingerprint(c: PipedreamCredentials): string {
  return createHash('sha256').update(`${c.clientId}\n${c.clientSecret}`).digest('hex')
}

function fail(status: number, error: string): PipedreamResult<never> {
  return { ok: false, status, error }
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function transportError(e: unknown): Promise<PipedreamResult<never>> {
  const name = (e as { name?: string } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') return fail(504, 'Pipedream did not answer in time. Try again.')
  return fail(502, 'Pipedream could not be reached. Check the connection on this computer.')
}

function explain(status: number, body: any, what: string): string {
  const detail = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : ''
  if (status === 401 || status === 403) return 'Pipedream rejected the client ID, client secret or project. Check them in Pipedream’s API settings.'
  if (status === 404) return `Pipedream could not find ${what}. Check the project ID and environment.`
  if (status === 429) return 'Pipedream is rate-limiting this client. Wait a minute and try again.'
  return detail ? `Pipedream said: ${detail}` : `Pipedream answered ${status} while trying to ${what}.`
}

/** A short-lived access token for these credentials. Cached until shortly before it expires. */
export async function pipedreamAccessToken(c: PipedreamCredentials, now = Date.now()): Promise<PipedreamResult<string>> {
  const key = fingerprint(c)
  const hit = tokens.get(key)
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > now) return { ok: true, value: hit.token }
  try {
    const { status, body } = await fetchJson(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: c.clientId, client_secret: c.clientSecret }),
    })
    if (status < 200 || status >= 300 || typeof body?.access_token !== 'string') {
      tokens.delete(key)
      return fail(status === 200 ? 502 : status, explain(status, body, 'sign in'))
    }
    const ttl = typeof body.expires_in === 'number' ? body.expires_in * 1000 : 3600_000
    tokens.set(key, { token: body.access_token, expiresAt: now + ttl })
    return { ok: true, value: body.access_token }
  } catch (e) {
    return transportError(e)
  }
}

/** Forget cached tokens (for tests, or after a credentials change). */
export function clearPipedreamTokens(): void {
  tokens.clear()
}

async function call(c: PipedreamCredentials, method: string, path: string, body?: unknown): Promise<PipedreamResult<any>> {
  const auth = await pipedreamAccessToken(c)
  if (!auth.ok) return auth
  try {
    const res = await fetchJson(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${auth.value}`,
        'x-pd-environment': c.environment,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status < 200 || res.status >= 300) return fail(res.status, explain(res.status, res.body, 'do that'))
    return { ok: true, value: res.body }
  } catch (e) {
    return transportError(e)
  }
}

// --- catalogue ---------------------------------------------------------------

export interface PipedreamApp {
  slug: string
  name: string
  description: string
  imgSrc: string
  authType: string
  categories: string[]
}

function toApp(a: any): PipedreamApp | null {
  const slug = typeof a?.name_slug === 'string' ? a.name_slug : ''
  if (!slug) return null
  return {
    slug,
    name: typeof a.name === 'string' ? a.name : slug,
    description: typeof a.description === 'string' ? a.description.slice(0, 400) : '',
    imgSrc: typeof a.img_src === 'string' ? a.img_src : '',
    authType: typeof a.auth_type === 'string' ? a.auth_type : '',
    categories: Array.isArray(a.categories) ? a.categories.filter((x: unknown) => typeof x === 'string').slice(0, 8) : [],
  }
}

export async function listPipedreamApps(c: PipedreamCredentials, q: string, limit: number): Promise<PipedreamResult<PipedreamApp[]>> {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) })
  if (q.trim()) params.set('q', q.trim().slice(0, 80))
  const res = await call(c, 'GET', `/connect/apps?${params}`)
  if (!res.ok) return res
  const data = Array.isArray(res.value?.data) ? res.value.data : []
  return { ok: true, value: data.map(toApp).filter((x: PipedreamApp | null): x is PipedreamApp => !!x) }
}

// --- accounts ----------------------------------------------------------------

export interface PipedreamAccount {
  id: string
  app: string
  name: string
  healthy: boolean
}

export async function listPipedreamAccounts(c: PipedreamCredentials, user: string): Promise<PipedreamResult<PipedreamAccount[]>> {
  const path = `/connect/${c.projectId}/users/${encodeURIComponent(user)}/accounts`
  const res = await call(c, 'GET', path)
  if (!res.ok) return res
  const data = Array.isArray(res.value?.data) ? res.value.data : []
  const out: PipedreamAccount[] = []
  for (const a of data) {
    const id = typeof a?.id === 'string' ? a.id : ''
    const app = typeof a?.app?.name_slug === 'string' ? a.app.name_slug : typeof a?.app_slug === 'string' ? a.app_slug : ''
    if (!id || !app) continue
    out.push({
      id,
      app,
      name: typeof a.name === 'string' ? a.name : app,
      healthy: a.healthy !== false,
    })
  }
  return { ok: true, value: out }
}

export async function removePipedreamAccount(c: PipedreamCredentials, accountId: string): Promise<PipedreamResult<{ removed: true }>> {
  const res = await call(c, 'DELETE', `/connect/${c.projectId}/accounts/${encodeURIComponent(accountId)}`)
  if (!res.ok) return res
  return { ok: true, value: { removed: true } }
}

// --- sign-in -----------------------------------------------------------------

/**
 * A Connect Link for one app, for one user. Pipedream sends the person to the success or
 * error address once they finish (our done page closes its window).
 */
export async function createPipedreamConnect(
  c: PipedreamCredentials,
  user: string,
  app: string,
  returns: { success: string; error: string },
): Promise<PipedreamResult<{ connectUrl: string; expiresAt: string | null }>> {
  const res = await call(c, 'POST', `/connect/${c.projectId}/tokens`, {
    external_user_id: user,
    success_redirect_uri: returns.success,
    error_redirect_uri: returns.error,
  })
  if (!res.ok) return res
  const base = typeof res.value?.connect_link_url === 'string' ? res.value.connect_link_url : ''
  if (!/^https:\/\//.test(base)) return fail(502, 'Pipedream did not return a connect link.')
  const url = new URL(base)
  url.searchParams.set('app', app)
  return {
    ok: true,
    value: { connectUrl: url.toString(), expiresAt: typeof res.value?.expires_at === 'string' ? res.value.expires_at : null },
  }
}

/** Checks the credentials by asking Pipedream for an access token. Never echoes them. */
export async function checkPipedream(c: PipedreamCredentials): Promise<PipedreamResult<{ environment: string }>> {
  const res = await pipedreamAccessToken(c)
  if (!res.ok) return res
  return { ok: true, value: { environment: c.environment } }
}
