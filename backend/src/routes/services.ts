// Third-party services for the chat and the bots.
//
//   POST /api/services/seo/domain        OpenSEO: domain overview
//   POST /api/services/seo/keywords      OpenSEO: keyword research
//   POST /api/services/crm/search        Twenty: find people or companies
//   POST /api/services/crm/create        Twenty: create a person, company or note
//   POST /api/services/social/channels   Postiz: connected channels
//   POST /api/services/social/draft      Postiz: save a draft (never publishes)
//   GET  /api/services/voice/voices      VoiceStudio: voices it can speak with
//   POST /api/services/voice/speak       VoiceStudio: text to speech (audio back)
//   POST /api/services/voice/clone       VoiceStudio: clone a voice (permission required)
//
// The address and key of the service arrive per request in `x-re-service-url`
// and `x-re-service-key`. They are used for that request and not stored here.
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import {
  crmCreate, crmSearch, openseoDomain, openseoKeywords, parseBase, postizChannels, postizDraft,
  voiceClone, voiceList, voiceSpeak, type CrmCreate, type CrmKind, type Fetcher,
} from '../services/serviceClients'

const DEFAULTS = {
  seo: 'https://app.openseo.so',
  crm: 'https://api.twenty.com',
  social: 'https://api.postiz.com/public/v1',
  voice: 'http://127.0.0.1:3900',
} as const

const MAX_SAMPLE_BYTES = 25_000_000

type Service = keyof typeof DEFAULTS

function target(c: { req: { header: (n: string) => string | undefined } }, service: Service): { ok: true; base: string; key?: string } | { ok: false; error: string } {
  const base = parseBase(c.req.header('x-re-service-url'), DEFAULTS[service])
  if (!base.ok) return base
  const key = (c.req.header('x-re-service-key') ?? '').trim() || undefined
  return { ok: true, base: base.url, key }
}

async function json(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, any> | null> {
  const raw = await c.req.json().catch(() => null)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, any>) : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function serviceRoutes(_rt: Runtime, fetcher: Fetcher = (i, init) => fetch(i, init)) {
  const r = new Hono()

  r.post('/services/seo/domain', async (c) => {
    const t = target(c, 'seo'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body) return c.json({ error: 'Send a JSON object.' }, 400)
    const domain = str(body.domain, 2048).trim()
    if (domain.length < 3) return c.json({ error: 'Name a domain, such as example.com.' }, 400)
    const res = await openseoDomain(fetcher, { base: t.base, key: t.key, projectId: str(body.projectId, 80), domain })
    return res.ok ? c.json({ result: res.data }) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/seo/keywords', async (c) => {
    const t = target(c, 'seo'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body) return c.json({ error: 'Send a JSON object.' }, 400)
    const seeds = Array.isArray(body.seeds) ? body.seeds.filter((s: unknown): s is string => typeof s === 'string') : []
    if (!seeds.length) return c.json({ error: 'Give at least one keyword.' }, 400)
    const res = await openseoKeywords(fetcher, { base: t.base, key: t.key, projectId: str(body.projectId, 80), seeds })
    return res.ok ? c.json({ result: res.data }) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/crm/search', async (c) => {
    const t = target(c, 'crm'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body) return c.json({ error: 'Send a JSON object.' }, 400)
    const kind = body.kind === 'companies' ? 'companies' : 'people'
    const res = await crmSearch(fetcher, { base: t.base, key: t.key, query: str(body.query, 200), kind })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/crm/create', async (c) => {
    const t = target(c, 'crm'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body || !body.record || typeof body.record !== 'object') return c.json({ error: 'Send a record.' }, 400)
    const rec = body.record as Record<string, unknown>
    const kind: CrmKind = rec.kind === 'companies' || rec.kind === 'notes' ? rec.kind : 'people'
    const record: CrmCreate = { kind }
    for (const k of ['firstName', 'lastName', 'email', 'jobTitle', 'name', 'domain', 'title', 'body'] as const) {
      const v = rec[k]
      if (typeof v === 'string') record[k] = v.slice(0, k === 'body' ? 20_000 : 500)
    }
    const res = await crmCreate(fetcher, { base: t.base, key: t.key, record })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/social/channels', async (c) => {
    const t = target(c, 'social'); if (!t.ok) return c.json({ error: t.error }, 400)
    const res = await postizChannels(fetcher, { base: t.base, key: t.key })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/social/draft', async (c) => {
    const t = target(c, 'social'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body) return c.json({ error: 'Send a JSON object.' }, 400)
    const channelId = str(body.channelId, 120)
    if (!channelId) return c.json({ error: 'Choose a channel.' }, 400)
    const res = await postizDraft(fetcher, { base: t.base, key: t.key, channelId, text: str(body.text, 5_001) })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  r.get('/services/voice/voices', async (c) => {
    const t = target(c, 'voice'); if (!t.ok) return c.json({ error: t.error }, 400)
    const res = await voiceList(fetcher, { base: t.base, key: t.key })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  r.post('/services/voice/speak', async (c) => {
    const t = target(c, 'voice'); if (!t.ok) return c.json({ error: t.error }, 400)
    const body = await json(c); if (!body) return c.json({ error: 'Send a JSON object.' }, 400)
    const text = str(body.text, 4001).trim()
    if (!text) return c.json({ error: 'Say what the voice should read.' }, 400)
    const format = body.format === 'wav' ? 'wav' : 'mp3'
    const res = await voiceSpeak(fetcher, { base: t.base, key: t.key, voice: str(body.voice, 120) || 'default', text, format })
    if (!res.ok) return c.json({ error: res.error }, res.status as 400)
    return new Response(res.data.bytes, { headers: { 'content-type': res.data.mime, 'cache-control': 'no-store' } })
  })

  r.post('/services/voice/clone', async (c) => {
    const t = target(c, 'voice'); if (!t.ok) return c.json({ error: t.error }, 400)
    const form = await c.req.parseBody().catch(() => null)
    if (!form) return c.json({ error: 'Send the sample as a form.' }, 400)
    const sample = form.sample
    if (!(sample instanceof File)) return c.json({ error: 'Attach a voice sample.' }, 400)
    if (sample.size > MAX_SAMPLE_BYTES) return c.json({ error: 'The sample is larger than 25 MB.' }, 413)
    // Permission is recorded as an explicit field. The app asks the person before
    // it sends this; the server refuses to clone without it.
    const permission = form.permission === 'granted'
    const res = await voiceClone(fetcher, {
      base: t.base, key: t.key, name: str(form.name, 80), sample, sampleName: sample.name, permission,
    })
    return res.ok ? c.json(res.data) : c.json({ error: res.error }, res.status as 400)
  })

  return r
}
