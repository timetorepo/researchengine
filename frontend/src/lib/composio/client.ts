/**
 * Composio, from the browser's side: the project key (encrypted with the vault
 * passphrase like provider keys), the list of apps, connecting an account, and
 * running a tool on a connected account. The key is sent to our own server per
 * request (`x-re-composio-key`); the server uses it and does not keep it.
 *
 * Connected accounts belong to a user id. That id is made once on this machine
 * and kept in settings, so every bot and the main chat share one set of
 * connections.
 */
import { getVaultPassphrase } from '@/lib/crypto/session'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'

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
  createdAt?: string
}

export interface ComposioTool { slug: string; name: string; description: string }

export type ComposioRun = { ok: true; data: unknown } | { ok: false; error: string }

const ACTIVE = new Set(['ACTIVE', 'CONNECTED', 'INITIALIZED'])

/** The stored key, decrypted when the vault is open. */
export async function composioKey(): Promise<string> {
  const stored = useStore.getState().settings.composio?.token
  return stored ? usableKey(stored) : ''
}

export function composioConfigured(): boolean {
  return !!useStore.getState().settings.composio?.token
}

/** Same rule the server applies to user ids (letters, digits and _ . @ : -, up to 128). */
export const COMPOSIO_USER_RE = /^[A-Za-z0-9_.@:-]{1,128}$/

/** The person's Composio user id: the one their Composio dashboard uses. */
export function composioIdentity(): { accountUserId: string } {
  const c = useStore.getState().settings.composio ?? {}
  return { accountUserId: (c.accountUserId ?? '').trim() }
}

/** True once a valid Composio user id is saved. Connections are filed under it. */
export function hasComposioUserId(): boolean {
  return COMPOSIO_USER_RE.test(composioIdentity().accountUserId)
}

/** The user id Composio files connections under. Throws a plain message until one is saved. */
export function composioUserId(): string {
  const id = composioIdentity().accountUserId
  if (!COMPOSIO_USER_RE.test(id)) throw new Error('Enter your Composio user id in Connectors first.')
  return id
}

/** Save the Composio user id. Returns an error text when it is not usable. */
export function setComposioIdentity(accountUserId: string): string | null {
  const id = accountUserId.trim()
  if (!COMPOSIO_USER_RE.test(id)) {
    return 'Enter your Composio user id: letters, numbers, and _ . @ : - only, up to 128 characters.'
  }
  useStore.setState((s) => ({
    settings: { ...s.settings, composio: { ...(s.settings.composio ?? {}), accountUserId: id } },
  }))
  return null
}

/** Save (or clear) the project key, encrypted when the vault is in use. */
export async function saveComposioKey(raw: string): Promise<void> {
  const key = raw.trim()
  const pass = getVaultPassphrase()
  const token = key ? (pass ? await encryptWithPassphrase(key, pass) : key) : undefined
  useStore.setState((s) => {
    const prev = s.settings.composio ?? {}
    return { settings: { ...s.settings, composio: token ? { ...prev, token } : { ...prev, token: undefined } } }
  })
}

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const key = await composioKey()
  return key ? { 'x-re-composio-key': key, ...extra } : { ...extra }
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({} as any))
  return typeof body?.error === 'string' ? body.error : `Composio answered ${res.status}.`
}

/**
 * Does the saved key work? Never shows the key. Each failure says what actually
 * went wrong: a locked vault is not a rejected key, and a missing answer is not
 * a verdict on the key.
 */
export async function checkComposio(): Promise<{ configured: boolean; ok: boolean; apps?: number; error?: string }> {
  if (!composioConfigured()) return { configured: false, ok: false }
  let key: string
  try {
    key = await composioKey()
  } catch {
    return { configured: true, ok: false, error: 'The Composio key is encrypted and the vault is locked. Unlock the vault, then press Check key.' }
  }
  if (!key) return { configured: true, ok: false, error: 'The saved Composio key could not be read. Paste it again.' }
  try {
    const res = await fetch('/api/composio/status', { headers: { 'x-re-composio-key': key } })
    const body = await res.json().catch(() => null as any)
    if (!body || typeof body.ok !== 'boolean') {
      return { configured: true, ok: false, error: `The local server answered ${res.status} without a result. Restart the app and try again.` }
    }
    return { configured: true, ok: body.ok, apps: body.apps, error: body.ok ? undefined : (typeof body.error === 'string' ? body.error : 'Composio did not accept the key.') }
  } catch {
    return { configured: true, ok: false, error: 'The local server did not answer.' }
  }
}

export async function listComposioApps(opts: { q?: string; refresh?: boolean } = {}): Promise<ComposioApp[]> {
  const params = new URLSearchParams()
  if (opts.q) params.set('q', opts.q)
  if (opts.refresh) params.set('refresh', '1')
  const res = await fetch(`/api/composio/apps?${params}`, { headers: await headers() })
  if (!res.ok) throw new Error(await readError(res))
  const body = await res.json()
  return Array.isArray(body.apps) ? body.apps : []
}

export async function listComposioAccounts(): Promise<ComposioAccount[]> {
  const res = await fetch(`/api/composio/accounts?user=${encodeURIComponent(composioUserId())}`, { headers: await headers() })
  if (!res.ok) throw new Error(await readError(res))
  const body = await res.json()
  return Array.isArray(body.accounts) ? body.accounts : []
}

export function isActiveAccount(a: ComposioAccount): boolean {
  return ACTIVE.has(a.status.toUpperCase())
}

/** Start sign-in for one app. Returns the URL the person must open. */
/**
 * Open a sign-in page in the person's own default browser (the one that holds their
 * logins). False when the server could not start a browser; the caller then falls back.
 */
export type OpenResult = { ok: true } | { ok: false; error: string }

/**
 * Ask this app's local server to open the link in the default browser on this
 * machine. Only meaningful when the app runs on this machine (the desktop app).
 */
export async function openInDefaultBrowser(url: string): Promise<OpenResult> {
  try {
    const res = await fetch('/api/composio/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (res.ok) return { ok: true }
    const body = await res.json().catch(() => ({} as any))
    return { ok: false, error: typeof body?.error === 'string' ? body.error : 'The browser could not be opened.' }
  } catch {
    return { ok: false, error: 'The app could not reach its local server to open the browser.' }
  }
}

/** True when this page is served from the machine the server runs on. */
export function isLocalApp(): boolean {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/** Where Composio receives the provider's OAuth redirect. Register this URL in the provider's developer app. */
export const COMPOSIO_OAUTH_CALLBACK = 'https://backend.composio.dev/api/v3/toolkits/auth/callback'

/** Thrown when Composio has no sign-in for an app: the person must add their own developer app. */
export class NeedsAppCredentialsError extends Error {
  readonly code = 'needs_app_credentials'
}

export interface ComposioAppCredentials { clientId: string; clientSecret: string; scopes?: string }

/** The saved developer app for one toolkit, with the secret decrypted. Undefined when none is saved. */
export async function savedComposioAppCredentials(slug: string): Promise<ComposioAppCredentials | undefined> {
  const entry = useStore.getState().settings.composio?.apps?.[slug]
  if (!entry?.clientId || !entry.clientSecret) return undefined
  return { clientId: entry.clientId, clientSecret: await usableKey(entry.clientSecret), scopes: entry.scopes || undefined }
}

/** Save the person's own developer app for one toolkit. Returns an error text when it is not usable. */
export async function saveComposioAppCredentials(slug: string, input: ComposioAppCredentials): Promise<string | null> {
  const clientId = input.clientId.trim()
  const clientSecret = input.clientSecret.trim()
  const scopes = (input.scopes ?? '').trim()
  if (!/^[\x21-\x7e]{4,200}$/.test(clientId)) return 'Paste the client ID from the developer app (no spaces).'
  if (!/^[\x21-\x7e]{8,300}$/.test(clientSecret)) return 'Paste the client secret from the developer app (no spaces).'
  if (scopes.length > 500 || /[\x00-\x1f]/.test(scopes)) return 'The scope list is too long or has control characters.'
  const pass = getVaultPassphrase()
  const secret = pass ? await encryptWithPassphrase(clientSecret, pass) : clientSecret
  useStore.setState((s) => {
    const prev = s.settings.composio ?? {}
    return {
      settings: {
        ...s.settings,
        composio: { ...prev, apps: { ...(prev.apps ?? {}), [slug]: { clientId, clientSecret: secret, ...(scopes ? { scopes } : {}) } } },
      },
    }
  })
  return null
}

/** Forget the saved developer app for one toolkit. */
export function clearComposioAppCredentials(slug: string): void {
  useStore.setState((s) => {
    const prev = s.settings.composio ?? {}
    const apps = { ...(prev.apps ?? {}) }
    delete apps[slug]
    return { settings: { ...s.settings, composio: { ...prev, apps } } }
  })
}

/**
 * Start sign-in for one app. A saved developer app for the toolkit is sent with the
 * request (the server never stores the secret). Throws NeedsAppCredentialsError when
 * the app has no Composio-managed sign-in and no developer app is saved.
 */
export async function startComposioConnect(toolkit: string, appCredentials?: ComposioAppCredentials): Promise<{ redirectUrl: string }> {
  const callbackUrl = `${window.location.origin}/?composio=connected`
  const own = appCredentials ?? (await savedComposioAppCredentials(toolkit))
  const res = await fetch('/api/composio/connect', {
    method: 'POST',
    headers: await headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ toolkit, user: composioUserId(), callbackUrl, ...(own ? { appCredentials: own } : {}) }),
  })
  if (!res.ok) {
    const body = await res.clone().json().catch(() => ({} as any))
    if (body?.code === 'needs_app_credentials') {
      throw new NeedsAppCredentialsError(typeof body.error === 'string' ? body.error : `${toolkit} needs your own developer app.`)
    }
    throw new Error(await readError(res))
  }
  const body = await res.json()
  if (typeof body.redirectUrl !== 'string') throw new Error('Composio did not return a sign-in link.')
  return { redirectUrl: body.redirectUrl }
}

export async function disconnectComposio(accountId: string): Promise<void> {
  const res = await fetch(`/api/composio/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE', headers: await headers() })
  if (!res.ok) throw new Error(await readError(res))
}

export async function listComposioTools(toolkit: string): Promise<ComposioTool[]> {
  const res = await fetch(`/api/composio/tools?toolkit=${encodeURIComponent(toolkit)}`, { headers: await headers() })
  if (!res.ok) throw new Error(await readError(res))
  const body = await res.json()
  return Array.isArray(body.tools) ? body.tools : []
}

/**
 * Run one tool. The account is the connected one for the tool's app, found from
 * the tool's name prefix (GMAIL_SEND_EMAIL → gmail). Refuses clearly when that
 * app is not connected, rather than guessing.
 */
export async function runComposioTool(tool: string, args: Record<string, unknown>): Promise<ComposioRun> {
  const slug = tool.trim().toUpperCase()
  let accounts: ComposioAccount[]
  try { accounts = await listComposioAccounts() } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
  const match = accounts
    .filter(isActiveAccount)
    .filter((a) => slug.startsWith(`${a.toolkit.toUpperCase()}_`))
    .sort((a, b) => b.toolkit.length - a.toolkit.length)[0]
  if (!match) {
    const app = slug.split('_')[0]?.toLowerCase() ?? 'that app'
    return { ok: false, error: `${app} is not connected. Connect it under Connectors first.` }
  }
  const res = await fetch('/api/composio/execute', {
    method: 'POST',
    headers: await headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ tool: slug, user: composioUserId(), connectedAccountId: match.id, arguments: args }),
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  const body = await res.json()
  if (!body.successful) return { ok: false, error: body.error ?? 'The app reported an error.' }
  return { ok: true, data: body.data }
}
