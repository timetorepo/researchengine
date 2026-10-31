/**
 * Settings for the third-party services the chat and the bots can use: OpenSEO
 * (SEO data), VoiceStudio (speech and voice cloning), Twenty (CRM) and Postiz
 * (social drafts). Dictation is configured in Settings → Voice (OpenWhispr's model).
 *
 * Keys are encrypted with the vault like the provider keys, and they travel to our
 * server on each request in headers. The server does not keep them.
 */
import { getVaultPassphrase } from '@/lib/crypto/session'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'

export type ServiceName = 'openseo' | 'voicestudio' | 'twenty' | 'postiz'

export const SERVICE_DEFAULTS: Record<ServiceName, string> = {
  openseo: 'https://app.openseo.so',
  voicestudio: 'http://127.0.0.1:3900',
  twenty: 'https://api.twenty.com',
  postiz: 'https://api.postiz.com/public/v1',
}

export interface ServiceEntry { url?: string; token?: string; projectId?: string }

export function serviceEntry(name: ServiceName): ServiceEntry {
  return useStore.getState().settings.services?.[name] ?? {}
}

/** A service is ready once it has a key, or once it is a local address that needs none. */
export function serviceReady(name: ServiceName): boolean {
  const e = serviceEntry(name)
  return !!e.token || (name === 'voicestudio' && /^(https?:\/\/)(127\.0\.0\.1|localhost)/.test(e.url ?? SERVICE_DEFAULTS.voicestudio))
}

/**
 * Save one service's address, key and (OpenSEO) project. A key left undefined keeps
 * the saved one; an empty string removes it.
 */
export async function saveService(name: ServiceName, input: { url?: string; key?: string; projectId?: string }): Promise<void> {
  const pass = getVaultPassphrase()
  const typed = input.key === undefined ? undefined : input.key.trim()
  const token = typed === undefined
    ? serviceEntry(name).token
    : typed ? (pass ? await encryptWithPassphrase(typed, pass) : typed) : undefined
  const url = (input.url ?? '').trim()
  const projectId = (input.projectId ?? '').trim()
  useStore.setState((s) => {
    const current = s.settings.services ?? {}
    const next: ServiceEntry = {
      ...(url ? { url } : {}),
      ...(token ? { token } : {}),
      ...(name === 'openseo' && projectId ? { projectId } : {}),
    }
    return { settings: { ...s.settings, services: { ...current, [name]: next } } }
  })
}

/** The headers that tell our server where a service is and how to reach it. */
export async function serviceHeaders(name: ServiceName): Promise<Record<string, string>> {
  const e = serviceEntry(name)
  const key = e.token ? await usableKey(e.token) : ''
  const headers: Record<string, string> = { 'x-re-service-url': (e.url ?? '').trim() || SERVICE_DEFAULTS[name] }
  if (key) headers['x-re-service-key'] = key
  return headers
}

export function openseoProject(): string {
  return serviceEntry('openseo').projectId ?? ''
}

// ---------------------------------------------------------------- voice consent

export interface VoiceConsent { id: string; speaker: string; voiceId: string; grantedAt: number }

export function voiceConsents(): VoiceConsent[] {
  return useStore.getState().settings.services?.voiceConsents ?? []
}

/**
 * The only way a voice becomes one the agent may speak with: a clone the person
 * made here, with the speaker's permission confirmed.
 */
export function recordConsent(c: Omit<VoiceConsent, 'id' | 'grantedAt'>): VoiceConsent {
  const rec: VoiceConsent = { ...c, id: crypto.randomUUID(), grantedAt: Date.now() }
  useStore.setState((s) => {
    const current = s.settings.services ?? {}
    const list = [rec, ...(current.voiceConsents ?? [])].slice(0, 50)
    return { settings: { ...s.settings, services: { ...current, voiceConsents: list } } }
  })
  return rec
}

export function forgetConsent(id: string): void {
  useStore.setState((s) => {
    const current = s.settings.services ?? {}
    return { settings: { ...s.settings, services: { ...current, voiceConsents: (current.voiceConsents ?? []).filter((c) => c.id !== id) } } }
  })
}

/** Find a permitted voice by its speaker's name (case-insensitive) or its id. */
export function permittedVoice(nameOrId: string): VoiceConsent | undefined {
  const q = nameOrId.trim().toLowerCase()
  if (!q) return undefined
  return voiceConsents().find((c) => c.speaker.toLowerCase() === q || c.voiceId.toLowerCase() === q)
}
