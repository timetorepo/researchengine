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

export type ComposioIdentityMode = 'automatic' | 'account'

/** Same rule the server applies to user ids (letters, digits and _ . @ : -, up to 128). */
export const COMPOSIO_USER_RE = /^[A-Za-z0-9_.@:-]{1,128}$/

export function composioIdentity(): { mode: ComposioIdentityMode; accountUserId: string } {
  const c = useStore.getState().settings.composio ?? {}
  return { mode: c.identityMode === 'account' ? 'account' : 'automatic', accountUserId: c.accountUserId ?? '' }
}

/**
 * The user id Composio files connections under. Two ways to get one:
 *  - "account": the person's own Composio user id (the one their Composio
 *    dashboard uses). Connections made there show up here.
 *  - "automatic": an id made once on this machine, so nothing needs typing.
 */
export function composioUserId(): string {
  const who = composioIdentity()
  if (who.mode === 'account' && COMPOSIO_USER_RE.test(who.accountUserId.trim())) return who.accountUserId.trim()
  const current = useStore.getState().settings.composio?.userId
  if (current) return current
  const id = `re-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  useStore.setState((s) => ({ settings: { ...s.settings, composio: { ...(s.settings.composio ?? {}), userId: id } } }))
  return id
}

/** Switch identity mode. Returns an error text when the chosen account id is not usable. */
export function setComposioIdentity(mode: ComposioIdentityMode, accountUserId?: string): string | null {
  const id = (accountUserId ?? composioIdentity().accountUserId).trim()
  if (mode === 'account' && !COMPOSIO_USER_RE.test(id)) {
    return 'Enter your Composio user id: letters, numbers, and _ . @ : - only, up to 128 characters.'
  }
  useStore.setState((s) => ({
    settings: { ...s.settings, composio: { ...(s.settings.composio ?? {}), identityMode: mode, accountUserId: id } },
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

/** Does the saved key work? Never shows the key. */
export async function checkComposio(): Promise<{ configured: boolean; ok: boolean; apps?: number; error?: string }> {
  if (!composioConfigured()) return { configured: false, ok: false }
  try {
    const res = await fetch('/api/composio/status', { headers: await headers() })
    const body = await res.json().catch(() => ({} as any))
    return { configured: true, ok: !!body.ok, apps: body.apps, error: body.error }
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
export async function startComposioConnect(toolkit: string): Promise<{ redirectUrl: string }> {
  const callbackUrl = `${window.location.origin}/?composio=connected`
  const res = await fetch('/api/composio/connect', {
    method: 'POST',
    headers: await headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ toolkit, user: composioUserId(), callbackUrl }),
  })
  if (!res.ok) throw new Error(await readError(res))
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
