/**
 * The browser side of the third-party services. Each function calls one route on
 * our server and returns a plain result, so the chat tools and the bots can share
 * them and show the same message.
 */
import { serviceHeaders, serviceReady, openseoProject, permittedVoice, recordConsent, type ServiceName } from './config'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const NOT_SET_UP: Record<ServiceName, string> = {
  openseo: 'OpenSEO is not set up. Add its key under Marketplace → Built in → OpenSEO.',
  voicestudio: 'VoiceStudio is not set up. Start VoiceStudio on this machine, or add its address and key under Marketplace → Built in → VoiceStudio.',
  twenty: 'Twenty is not set up. Add its key under Marketplace → Built in → Twenty CRM.',
  postiz: 'Postiz is not set up. Add its key under Marketplace → Built in → Postiz.',
}

async function call<T>(name: ServiceName, path: string, init: { method?: 'GET' | 'POST'; body?: unknown; form?: FormData } = {}): Promise<Result<T>> {
  if (!serviceReady(name)) return { ok: false, error: NOT_SET_UP[name] }
  try {
    const headers: Record<string, string> = await serviceHeaders(name)
    let body: BodyInit | undefined
    if (init.form) body = init.form
    else if (init.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(init.body) }
    const res = await fetch(`/api/services${path}`, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : `The service answered ${res.status}.` }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'The local server did not answer.' }
  }
}

// ---------------------------------------------------------------- OpenSEO

export const seoDomain = (domain: string) =>
  call<{ result: Record<string, unknown> }>('openseo', '/seo/domain', { body: { domain, projectId: openseoProject() } })

export const seoKeywords = (seeds: string[]) =>
  call<{ result: Record<string, unknown> }>('openseo', '/seo/keywords', { body: { seeds, projectId: openseoProject() } })

// ---------------------------------------------------------------- Twenty CRM

export type CrmSearchKind = 'people' | 'companies'
export type CrmRecord =
  | { kind: 'people'; firstName: string; lastName?: string; email?: string; jobTitle?: string }
  | { kind: 'companies'; name: string; domain?: string }
  | { kind: 'notes'; title: string; body?: string }

export const crmSearch = (kind: CrmSearchKind, query: string) =>
  call<{ records: { id: string; name: string; detail: string }[] }>('twenty', '/crm/search', { body: { kind, query } })

export interface CrmOverviewKind {
  total: number
  recent: { id: string; name: string; detail: string; createdAt: string }[]
  last14: number[]
  coverage: { sample: number; email: number; jobTitle: number; company: number; domain: number }
}

/** Totals, newest records and a 14-day count for the CRM page. */
export const crmOverview = () =>
  call<{ people: CrmOverviewKind; companies: CrmOverviewKind }>('twenty', '/crm/overview', { body: {} })

export const crmCreate = (record: CrmRecord) =>
  call<{ id: string; kind: string }>('twenty', '/crm/create', { body: { record } })

// ---------------------------------------------------------------- Postiz

export const socialChannels = () =>
  call<{ channels: { id: string; name: string; identifier: string; disabled: boolean }[] }>('postiz', '/social/channels', { body: {} })

export const socialDraft = (channelId: string, text: string) =>
  call<{ postId: string; channel: string }>('postiz', '/social/draft', { body: { channelId, text } })

// ---------------------------------------------------------------- VoiceStudio

export const voiceList = () =>
  call<{ voices: { id: string; name: string; type: string }[] }>('voicestudio', '/voice/voices', { method: 'GET' })

/** Speak text with a voice. Returns the audio as a blob the page can play. */
export async function voiceSpeak(voice: string, text: string): Promise<Result<{ blob: Blob }>> {
  if (!serviceReady('voicestudio')) return { ok: false, error: NOT_SET_UP.voicestudio }
  try {
    const headers: Record<string, string> = { ...(await serviceHeaders('voicestudio')), 'content-type': 'application/json' }
    const res = await fetch('/api/services/voice/speak', { method: 'POST', headers, body: JSON.stringify({ voice, text, format: 'mp3' }) })
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({}))
      return { ok: false, error: typeof data.error === 'string' ? data.error : `VoiceStudio answered ${res.status}.` }
    }
    return { ok: true, data: { blob: await res.blob() } }
  } catch {
    return { ok: false, error: 'The local server did not answer.' }
  }
}

/**
 * Clone a voice. The permission is passed as an explicit `granted` only when the
 * person ticked the box for this speaker. The consent is kept with the new voice.
 */
export async function voiceClone(input: { speaker: string; sample: File; permission: boolean }): Promise<Result<{ id: string; name: string }>> {
  if (!input.permission) return { ok: false, error: 'Cloning needs the speaker’s permission. Tick the box to confirm it.' }
  if (!serviceReady('voicestudio')) return { ok: false, error: NOT_SET_UP.voicestudio }
  if (permittedVoice(input.speaker)) return { ok: false, error: `A voice called “${input.speaker}” already has permission on record.` }
  const form = new FormData()
  form.set('name', input.speaker.trim())
  form.set('permission', 'granted')
  form.set('sample', input.sample, input.sample.name)
  const res = await call<{ id: string; name: string }>('voicestudio', '/voice/clone', { form })
  if (res.ok) recordConsent({ speaker: input.speaker.trim(), voiceId: res.data.id })
  return res
}
