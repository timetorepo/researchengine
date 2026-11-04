/**
 * Integrations, from the browser's side.
 *
 * Credentials live in `settings.integrations[id]` — encrypted with the vault
 * passphrase exactly like provider API keys — and are handed to the backend per
 * request (`x-re-integrations`). The server never stores them, so "connected"
 * is a property of this machine, not of an account somewhere.
 */
import { getVaultPassphrase } from '@/lib/crypto/session'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'
import { INTEGRATIONS, integrationById, type CredentialField, type IntegrationId } from './registry'

export interface IntCreds {
  token?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  base?: string
}

export interface StoredCreds extends IntCreds {
  /** Account name reported by the last successful probe. */
  account?: string
  /** When the credential was saved. */
  connectedAt?: number
}

export interface IntHit {
  integration: IntegrationId
  id: string
  title: string
  subtitle?: string
  url?: string
  snippet?: string
  date?: string
  kind: 'file' | 'message' | 'event' | 'issue' | 'page' | 'note'
}

export interface IntSearchReply {
  q: string
  results: IntHit[]
  /** What went wrong, per service — "not connected" is not "no results". */
  errors: { integration: string; name: string; error?: string; needs?: string | null }[]
  /** Same list; the menu and the agent both read it by this name. */
  problems: { integration: string; name: string; error?: string; needs?: string | null }[]
  counts?: { integration: string; n: number }[]
  connected?: string[]
  note?: string
}

/** The raw credential for one integration, decrypted if the vault is unlocked. */
export async function credsFor(id: IntegrationId): Promise<IntCreds> {
  const stored = (useStore.getState().settings.integrations ?? {})[id] as StoredCreds | undefined
  if (!stored) return {}
  const out: IntCreds = {}
  if (stored.token) out.token = await usableKey(stored.token)
  if (stored.refreshToken) out.refreshToken = await usableKey(stored.refreshToken)
  if (stored.clientSecret) out.clientSecret = await usableKey(stored.clientSecret)
  if (stored.clientId) out.clientId = stored.clientId
  if (stored.base) out.base = stored.base
  return out
}

export async function allCreds(): Promise<Record<string, IntCreds>> {
  const stored = useStore.getState().settings.integrations ?? {}
  const out: Record<string, IntCreds> = {}
  for (const id of Object.keys(stored)) {
    const creds = await credsFor(id as IntegrationId)
    if (creds.token || creds.refreshToken) out[id] = creds
  }
  return out
}

/** Headers for any integration call. A locked vault yields {} — the call then
 *  reports `needs: 'auth'`, which is the truth (we cannot decrypt the token). */
export async function integrationHeaders(): Promise<Record<string, string>> {
  try {
    const creds = await allCreds()
    if (!Object.keys(creds).length) return {}
    return { 'x-re-integrations': JSON.stringify(creds) }
  } catch {
    return {}
  }
}

export async function integrationConfigured(id: IntegrationId): Promise<boolean> {
  const stored = (useStore.getState().settings.integrations ?? {})[id] as StoredCreds | undefined
  if (!stored) return false
  return !!(stored.token || stored.refreshToken)
}

/** Save (or clear) an integration's credentials, encrypting the secrets. */
export async function saveCreds(
  id: IntegrationId,
  input: Partial<Record<CredentialField, string>>,
  opts: { clear?: boolean } = {},
): Promise<void> {
  const pass = getVaultPassphrase()
  const protect = async (raw: string) => (pass ? encryptWithPassphrase(raw, pass) : raw)
  const previous = ((useStore.getState().settings.integrations ?? {})[id] ?? {}) as StoredCreds
  const next: StoredCreds = opts.clear ? {} : { ...previous }

  if (opts.clear) {
    useStore.setState((s) => {
      const integrations = { ...(s.settings.integrations ?? {}) }
      delete integrations[id]
      return {
        settings: { ...s.settings, integrations },
        // The older UI slice tracks "is this service connected" — keep it true
        // so the @-picker and the integrations list agree with the vault.
        integrationsState: {
          ...s.integrations,
          [id]: { id, connected: false, scopes: integrationById(id)?.scopes ?? [] },
        },
      }
    })
    return
  }

  for (const field of ['token', 'refreshToken', 'clientSecret'] as const) {
    const raw = (input[field] ?? '').trim()
    if (raw) next[field] = await protect(raw)
    else if (!previous[field]) delete next[field]
  }
  for (const field of ['clientId', 'base'] as const) {
    const raw = (input[field] ?? '').trim()
    if (raw) next[field] = raw
    else delete next[field]
  }
  next.connectedAt = Date.now()
  useStore.setState((s) => ({
    settings: { ...s.settings, integrations: { ...(s.settings.integrations ?? {}), [id]: next } },
    integrations: {
      ...s.integrations,
      [id]: { id, connected: true, scopes: integrationById(id)?.scopes ?? [], lastSync: Date.now() },
    },
  }))
}

export function rememberAccount(id: IntegrationId, account: string) {
  useStore.setState((s) => {
    const current = (s.settings.integrations ?? {})[id] as StoredCreds | undefined
    if (!current) return {}
    return { settings: { ...s.settings, integrations: { ...(s.settings.integrations ?? {}), [id]: { ...current, account } } } }
  })
}

/* ---------------- calls ---------------- */

export async function searchIntegrations(q: string, opts: { ids?: IntegrationId[]; limit?: number } = {}): Promise<IntSearchReply> {
  const headers = await integrationHeaders()
  const params = new URLSearchParams({ q })
  if (opts.ids?.length) params.set('ids', opts.ids.join(','))
  if (opts.limit) params.set('limit', String(opts.limit))
  const res = await fetch(`/api/integrations/search?${params}`, { headers })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const raw = await res.json().catch(() => ({}))
  // The gateway calls them `errors`; older replies and tests say `problems`.
  // Normalise once here so every caller sees the same reply.
  const problems = raw.errors ?? raw.problems ?? []
  return {
    q: raw.q ?? q,
    results: raw.results ?? [],
    errors: problems,
    problems,
    counts: raw.counts,
    connected: raw.connected ?? [],
    note: raw.note,
  }
}

export async function readIntegrationItem(integration: IntegrationId, id: string): Promise<{ title: string; text: string; url?: string }> {
  const headers = await integrationHeaders()
  const res = await fetch(`/api/integrations/read?integration=${encodeURIComponent(integration)}&id=${encodeURIComponent(id)}`, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Read failed (${res.status})`)
  return json
}

export async function probeIntegration(id: IntegrationId): Promise<{ account?: string; detail: string }> {
  const headers = await integrationHeaders()
  const res = await fetch(`/api/integrations/probe?integration=${encodeURIComponent(id)}`, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Test failed (${res.status})`)
  return json
}

/** Combined view used by the menus and the settings tab. */
export function integrationSummary(): { id: IntegrationId; name: string; connected: boolean; account?: string; auth: 'none' | 'token' }[] {
  const stored = useStore.getState().settings.integrations ?? {}
  return INTEGRATIONS.map((i) => ({
    id: i.id,
    name: i.name,
    auth: i.auth,
    connected: i.auth === 'none' ? true : !!(stored[i.id]?.token || stored[i.id]?.refreshToken),
    account: stored[i.id]?.account,
  }))
}
