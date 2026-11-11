/**
 * Speech to text.
 *
 * The point of this module is that *push the mic button and talk* works, and
 * that whichever engine ends up doing the transcribing is visible rather than
 * guessed at. Three modes, chosen in Settings → Voice:
 *
 *   browser  — the Web Speech API, straight from the page. Free, instant, and
 *              the only one that streams words as you speak. It exists in
 *              Chromium (Chrome, Edge, and the WebView2 the Windows build uses)
 *              and is *absent* in WebKitGTK, which is what Linux uses — so the
 *              mode is a preference, not a promise, and the UI says which one is
 *              actually live.
 *   provider — record, then post the audio to any OpenAI-compatible
 *              transcription endpoint (OpenAI `whisper-1` / `gpt-4o-transcribe`,
 *              Groq `whisper-large-v3`, your own gateway) with the key you
 *              already saved for that provider.
 *   local    — record, then post the audio to a whisper.cpp / faster-whisper
 *              server on this machine. Nothing leaves the host.
 *
 * `provider` and `local` go through our own backend so the audio is posted to
 * one place and keys are never put in a URL from the page.
 */

export type SttMode = 'browser' | 'provider' | 'local'

export interface SttSettings {
  mode?: SttMode
  provider?: string
  model?: string
  localUrl?: string
  language?: string
}

export interface SttResult {
  text: string
  /** What did the work — surfaced in the UI, never implied. */
  engine: string
  /** True when nothing was heard (an empty transcript is not an error). */
  empty?: boolean
}

export interface SttContext {
  /** Key for `provider` mode — read from the vault by the caller. */
  apiKey?: string
  /** Base URL override for `provider` mode. */
  baseUrl?: string
  /** Our patience, ms. */
  timeoutMs?: number
  signal?: AbortSignal
}

/** Can this browser do speech recognition in the page at all? */
export function browserSttSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function recorderSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(navigator.mediaDevices && (window as any).MediaRecorder)
}

/**
 * Pick the mode that will actually work here. A `browser` preference on a
 * browser without the API falls back to the recorder rather than failing at the
 * moment the user presses the mic.
 */
export function resolveMode(settings: SttSettings): { mode: SttMode; reason: string } {
  const wanted = settings.mode ?? 'browser'
  if (wanted === 'browser' && browserSttSupported()) {
    return { mode: 'browser', reason: 'in-page speech recognition' }
  }
  if (wanted === 'browser') {
    if (recorderSupported()) {
      if (settings.localUrl) return { mode: 'local', reason: 'this browser has no Speech API — using your local whisper server' }
      if (settings.provider) return { mode: 'provider', reason: 'this browser has no Speech API — using the provider you picked' }
      return { mode: 'provider', reason: 'this browser has no Speech API — pick a transcription provider or a local whisper server' }
    }
    return { mode: 'browser', reason: 'no microphone access in this environment' }
  }
  return { mode: wanted, reason: wanted === 'local' ? 'your local whisper server' : `${settings.model ?? 'whisper-1'} on ${settings.provider ?? 'a provider'}` }
}

/** Best audio format this browser can actually record. */
export function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  const MR = (typeof window !== 'undefined' ? (window as any).MediaRecorder : null)
  if (!MR?.isTypeSupported) return ''
  for (const c of candidates) if (MR.isTypeSupported(c)) return c
  return ''
}

/**
 * Record until `stop()` is called. Returns the recorder plus the promise of the
 * blob, so the caller can show a level meter while it runs.
 */
export async function startRecording(): Promise<{
  stop: () => Promise<Blob>
  cancel: () => void
  stream: MediaStream
  mimeType: string
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const mimeType = pickMimeType()
  const rec = new (window as any).MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e: BlobEvent) => { if (e.data?.size) chunks.push(e.data) }
  rec.start(250)

  const finish = (): Promise<Blob> => new Promise((resolve) => {
    const done = () => {
      stream.getTracks().forEach((t) => t.stop())
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
    if (rec.state === 'inactive') return done()
    rec.onstop = done
    rec.stop()
  })

  return {
    stream,
    mimeType: mimeType || 'audio/webm',
    stop: finish,
    cancel: () => {
      try { rec.state !== 'inactive' && rec.stop() } catch { /* already stopped */ }
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}

/** Post recorded audio to our backend, which forwards it to the right server. */
export async function transcribeBlob(blob: Blob, settings: SttSettings, ctx: SttContext = {}): Promise<SttResult> {
  const mode = settings.mode === 'local' ? 'local' : 'provider'
  const params = new URLSearchParams({ mode })
  if (settings.language) params.set('language', settings.language)
  if (ctx.timeoutMs) params.set('timeout', String(ctx.timeoutMs))
  if (mode === 'local') {
    if (settings.localUrl) params.set('localUrl', settings.localUrl)
  } else {
    if (settings.model) params.set('model', settings.model)
    if (ctx.baseUrl) params.set('base', ctx.baseUrl)
    if (ctx.apiKey) params.set('key', ctx.apiKey)
  }
  const res = await fetch(`/api/voice/transcribe?${params.toString()}`, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'audio/webm' },
    body: blob,
    signal: ctx.signal,
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(String(json?.error ?? `Transcription failed (${res.status})`))
  const text = String(json?.text ?? '').trim()
  return { text, engine: String(json?.engine ?? (mode === 'local' ? 'local whisper' : settings.model ?? 'provider')), empty: !text }
}

/**
 * One-shot in-page recognition (the `browser` mode). Resolves on the final
 * result, and rejects only when the browser refuses — an empty transcript is a
 * result, not a failure.
 */
export function recognizeOnce(settings: SttSettings): { stop: () => void; result: Promise<SttResult> } {
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return { stop: () => {}, result: Promise.reject(new Error('This browser has no Speech Recognition API')) }

  const rec = new Ctor()
  rec.lang = settings.language && settings.language.length >= 2 ? settings.language : navigator.language || 'en-US'
  rec.continuous = true
  rec.interimResults = true
  let finalText = ''
  let resolveResult: (r: SttResult) => void = () => {}
  let rejectResult: (e: Error) => void = () => {}
  const result = new Promise<SttResult>((res, rej) => { resolveResult = res; rejectResult = rej })

  rec.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const part = event.results[i]
      if (part.isFinal) finalText += part[0].transcript
    }
  }
  rec.onerror = (event: any) => {
    const code = String(event?.error ?? 'error')
    rejectResult(new Error(code === 'not-allowed'
      ? 'Microphone permission was refused for speech recognition'
      : `Speech recognition error: ${code}`))
  }
  rec.onend = () => {
    const text = finalText.trim()
    resolveResult({ text, engine: 'browser speech recognition', empty: !text })
  }
  try { rec.start() } catch (e: any) { rejectResult(new Error(String(e?.message ?? e))) }

  return { stop: () => { try { rec.stop() } catch { /* not started */ } }, result }
}

/** A short, honest line about the current setup, for the settings page. */
export function describeStt(settings: SttSettings): string {
  const { mode, reason } = resolveMode(settings)
  return mode === 'browser'
    ? `Transcribing in the page (${reason})`
    : mode === 'local'
      ? `Transcribing on your own machine — ${settings.localUrl}`
      : `Transcribing with ${settings.model ?? 'whisper-1'} via ${settings.provider ?? 'a provider'}`
}
