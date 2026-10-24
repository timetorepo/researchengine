import { Hono } from 'hono'

/**
 * Speech to text, proxied.
 *
 * Dictation has three possible back ends, and none of them should require a
 * restart or an environment variable:
 *
 *   • `provider` — anything OpenAI-compatible that takes audio: OpenAI's own
 *     `whisper-1` / `gpt-4o-transcribe`, Groq's `whisper-large-v3`, a
 *     self-hosted gateway… The user's key rides along with the request, exactly
 *     as it does for chat, and the server keeps nothing.
 *   • `local` — a whisper.cpp / faster-whisper server on this machine
 *     (`http://127.0.0.1:8080/inference` and friends). No key, no cloud, no
 *     internet: the audio never leaves the host.
 *   • `browser` — the Web Speech API. That runs entirely in the page, so it
 *     never reaches this route at all; it is listed here so the shape of the
 *     feature is in one place.
 *
 * Audio arrives as the raw request body (one format to forward, no multipart
 * parsing here), with the options in the query string.
 */
export const voiceRoutes = new Hono()

const DEFAULT_TIMEOUT = 120_000

function pick(query: Record<string, string | undefined>, name: string): string | null {
  const v = query[name]
  return v && v.length ? v : null
}

voiceRoutes.post('/voice/transcribe', async (c) => {
  const mode = c.req.query('mode') ?? 'provider'
  const language = c.req.query('language') ?? ''
  const audio = await c.req.arrayBuffer()
  if (!audio.byteLength) return c.json({ error: 'No audio in the request body' }, 400)

  const timeout = Number(c.req.query('timeout') ?? 0)
  const ms = Number.isFinite(timeout) && timeout >= 3000 ? Math.min(timeout, 600_000) : DEFAULT_TIMEOUT

  if (mode === 'local') {
    const base = (pick(c.req.query(), 'localUrl') ?? process.env.WHISPER_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '')
    const form = new FormData()
    form.append('file', new Blob([audio], { type: c.req.header('content-type') ?? 'audio/webm' }), 'dictation.webm')
    form.append('response_format', 'json')
    form.append('temperature', '0.0')
    if (language) form.append('language', language)
    try {
      const res = await fetch(`${base}/inference`, { method: 'POST', body: form, signal: AbortSignal.timeout(ms) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return c.json({ error: `Local whisper responded ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}` }, 502)
      }
      const json: any = await res.json().catch(() => ({}))
      const text = String(json?.text ?? json?.transcription ?? '').trim()
      return c.json({ text, engine: `local:${base}` })
    } catch (e: any) {
      return c.json({ error: `Could not reach the local whisper server at ${base} (${e?.message ?? e})` }, 502)
    }
  }

  // --- provider (OpenAI-compatible /audio/transcriptions) -------------------
  const key = pick(c.req.query(), 'key') ?? c.req.header('x-re-provider-key') ?? ''
  const base = (pick(c.req.query(), 'base') ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = pick(c.req.query(), 'model') ?? 'whisper-1'
  if (!key) return c.json({ error: 'No key for this provider — add one in Settings → Providers' }, 400)

  const form = new FormData()
  form.append('file', new Blob([audio], { type: c.req.header('content-type') ?? 'audio/webm' }), 'dictation.webm')
  form.append('model', model)
  if (language) form.append('language', language)

  try {
    const res = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(ms),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return c.json({ error: `${model} responded ${res.status}${text ? `: ${text.slice(0, 240)}` : ''}` }, 502)
    }
    const json: any = await res.json().catch(() => ({}))
    const text = String(json?.text ?? json?.transcription ?? '').trim()
    return c.json({ text, engine: `${model}` })
  } catch (e: any) {
    return c.json({ error: `Transcription failed: ${e?.message ?? e}` }, 502)
  }
})

/** What is available for dictation, so the settings page can be honest. */
voiceRoutes.get('/voice/status', async (c) => {
  const localUrl = (pick(c.req.query(), 'localUrl') ?? process.env.WHISPER_URL ?? '').replace(/\/$/, '')
  let local = false
  if (localUrl) {
    try {
      const res = await fetch(localUrl, { signal: AbortSignal.timeout(2500) })
      local = res.ok || res.status === 404 // a whisper server answers, even on /
    } catch { local = false }
  }
  return c.json({ local, localUrl: localUrl || null })
})
