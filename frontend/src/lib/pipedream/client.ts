// Pipedream Connect, from the browser's side. The OAuth client (client ID and secret),
// project ID and environment are saved as one JSON token, encrypted with the vault
// passphrase when the vault is in use, like the Composio key. They are sent to our
// server per request (base64 in `x-re-pipedream`); the server does not keep them.
import { getVaultPassphrase } from '@/lib/crypto/session'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'
import { composioUserId, hasComposioUserId } from '@/lib/composio/client'
import { newSignInId } from '@/lib/signin/client'

export type PipedreamEnvironment = 'development' | 'production'

export interface PipedreamCredentials {
  clientId: string
  clientSecret: string
  projectId: string
  environment: PipedreamEnvironment
}

export interface PipedreamApp {
  slug: string
  name: string
  description: string
  imgSrc: string
  authType: string
  categories: string[]
}

export interface PipedreamAccount {
  id: string
  app: string
  name: string
  healthy: boolean
}

const PROJECT_RE = /^proj_[A-Za-z0-9]{4,64}$/

/** Checks what the person typed. Returns the first problem, or null when all is well. */
export function pipedreamProblem(c: Partial<PipedreamCredentials>): string | null {
  if (!c.clientId?.trim()) return 'Paste the OAuth client ID from Pipedream’s API settings.'
  if (!c.clientSecret?.trim()) return 'Paste the OAuth client secret.'
  if (!PROJECT_RE.test((c.projectId ?? '').trim())) return 'The project ID starts with proj_. Copy it from the project’s Settings tab.'
  if (c.environment !== 'development' && c.environment !== 'production') return 'Choose development or production.'
  return null
}

export function pipedreamConfigured(): boolean {
  return !!useStore.getState().settings.pipedream?.token
}

/** The saved credentials, decrypted. Empty when none are saved. */
export async function savedPipedreamCredentials(): Promise<PipedreamCredentials | null> {
  const stored = useStore.getState().settings.pipedream?.token
  if (!stored) return null
  try {
    const raw = await usableKey(stored)
    const parsed = JSON.parse(raw) as PipedreamCredentials
    return pipedreamProblem(parsed) ? null : parsed
  } catch {
    return null
  }
}

/** Save the credentials. They are encrypted when a vault passphrase is set. */
export async function savePipedreamCredentials(c: PipedreamCredentials): Promise<void> {
  const clean: PipedreamCredentials = {
    clientId: c.clientId.trim(),
    clientSecret: c.clientSecret.trim(),
    projectId: c.projectId.trim(),
    environment: c.environment,
  }
  const pass = getVaultPassphrase()
  const json = JSON.stringify(clean)
  const token = pass ? await encryptWithPassphrase(json, pass) : json
  useStore.setState((s) => ({ settings: { ...s.settings, pipedream: { token } } }))
}

export function clearPipedreamCredentials(): void {
  useStore.setState((s) => ({ settings: { ...s.settings, pipedream: undefined } }))
}

/** One header value: the credentials as base64 JSON. ASCII only, so btoa is enough. */
async function credentialsHeader(): Promise<Record<string, string>> {
  const c = await savedPipedreamCredentials()
  if (!c) throw new PipedreamNeedsCredentials()
  return { 'x-re-pipedream': btoa(JSON.stringify(c)) }
}

export class PipedreamNeedsCredentials extends Error {
  readonly code = 'no_credentials'
  constructor() { super('Add your Pipedream client ID, client secret and project first.') }
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({} as any))
  return typeof body?.error === 'string' ? body.error : `Pipedream answered ${res.status}.`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(await credentialsHeader()), ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<T>
}

/** Do the saved credentials work? Says why not when they do not. */
export async function checkPipedream(): Promise<{ ok: boolean; error?: string }> {
  try {
    await request<{ ok: true }>('/api/pipedream/status')
    return { ok: true }
  } catch (e: any) {
    if (e instanceof PipedreamNeedsCredentials) return { ok: false }
    return { ok: false, error: String(e?.message ?? e) }
  }
}

export async function listPipedreamApps(q: string): Promise<PipedreamApp[]> {
  const params = new URLSearchParams({ limit: '100' })
  if (q.trim()) params.set('q', q.trim())
  const body = await request<{ apps: PipedreamApp[] }>(`/api/pipedream/apps?${params}`)
  return body.apps
}

export async function listPipedreamAccounts(): Promise<PipedreamAccount[]> {
  if (!hasComposioUserId()) return []
  const user = encodeURIComponent(composioUserId())
  const body = await request<{ accounts: PipedreamAccount[] }>(`/api/pipedream/accounts?user=${user}`)
  return body.accounts
}

/**
 * Start one sign-in. The returned flight id is watched by the same tracker as Composio
 * (lib/signin). The sign-in link opens in the default browser on the desktop app, and in
 * a new tab on the web.
 */
export async function startPipedreamConnect(app: string): Promise<{ flightId: string; connectUrl: string }> {
  const user = composioUserId()
  const flightId = newSignInId()
  const body = await request<{ connectUrl: string }>('/api/pipedream/connect', {
    method: 'POST',
    body: JSON.stringify({ app, user, flight: flightId, returnTo: window.location.origin }),
  })
  return { flightId, connectUrl: body.connectUrl }
}

export async function removePipedreamAccount(id: string): Promise<void> {
  await request<{ removed: true }>(`/api/pipedream/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
