/**
 * Dictation for the composer.
 *
 * One hook, used by the mic button next to the send tile. It owns the awkward
 * parts — permission, the recording, the wait for a transcript, and the honest
 * error when the chosen engine cannot work here — so the composer only has to
 * decide what to do with the words.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import {
  describeStt, recognizeOnce, recorderSupported, resolveMode, startRecording, transcribeBlob,
  type SttResult, type SttSettings,
} from '@/lib/voice/stt'

export type DictationState = 'idle' | 'starting' | 'recording' | 'transcribing' | 'error'

export interface Dictation {
  state: DictationState
  /** Live level, 0–1, for a meter (voice-glow's beam reads the stream itself). */
  level: number
  /** The microphone stream while recording, for VoiceBeam. */
  stream: MediaStream | null
  error: string | null
  /** What will do the transcribing, in one line. */
  description: string
  supported: boolean
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  /** Start (or stop) listening and resolve with the transcript. */
  listen: () => Promise<string>
  /** Interim words while the browser recogniser is running. */
  interim: string
}

export function useDictation(onTranscript: (text: string, result: SttResult) => void): Dictation {
  const settings = useStore((s) => s.settings)
  const voice = (settings.voice ?? {}) as NonNullable<typeof settings.voice>
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [level, setLevel] = useState(0)
  const [interim, setInterim] = useState('')

  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null)
  /** Resolves the promise `listen()` handed back, once there are words. */
  const pendingText = useRef<{ resolve: (text: string) => void; timer: ReturnType<typeof setTimeout> } | null>(null)
  const browser = useRef<ReturnType<typeof recognizeOnce> | null>(null)
  const raf = useRef<number | null>(null)
  const analyser = useRef<{ ctx: AudioContext; node: AnalyserNode; data: Uint8Array } | null>(null)

  const sttSettings: SttSettings = {
    mode: voice.mode ?? 'browser',
    provider: voice.provider,
    model: voice.model ?? 'whisper-1',
    localUrl: voice.localUrl,
    language: voice.language,
  }
  const { mode: activeMode } = resolveMode(sttSettings)
  const supported = activeMode === 'browser' ? true : recorderSupported()

  /** Settle a `listen()` promise exactly once. */
  const settle = useCallback((text: string) => {
    const wait = pendingText.current
    pendingText.current = null
    if (!wait) return
    clearTimeout(wait.timer)
    wait.resolve(text)
  }, [])

  const teardownLevel = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    analyser.current?.node.disconnect()
    void analyser.current?.ctx.close().catch(() => {})
    analyser.current = null
    setLevel(0)
  }, [])

  const meter = useCallback((media: MediaStream) => {
    try {
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(media)
      const node = ctx.createAnalyser()
      node.fftSize = 512
      src.connect(node)
      const data = new Uint8Array(node.frequencyBinCount)
      analyser.current = { ctx, node, data }
      const tick = () => {
        if (!analyser.current) return
        analyser.current.node.getByteTimeDomainData(analyser.current.data as any)
        let sum = 0
        for (const v of analyser.current.data) { const d = (v - 128) / 128; sum += d * d }
        setLevel(Math.min(1, Math.sqrt(sum / analyser.current.data.length) * 3))
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    } catch { /* a meter is a nicety, never a blocker */ }
  }, [])

  // A failed transcription should say what went wrong out loud rather than
  // leaving the mic button looking idle.
  useEffect(() => {
    if (state === 'error' && error) useUI.getState().toast('Dictation', error, 'danger')
  }, [state, error])

  // Never leave the microphone open behind a closed composer.
  useEffect(() => () => {
    recorder.current?.cancel()
    browser.current?.stop()
    teardownLevel()
  }, [teardownLevel])

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'transcribing') return
    setError(null)
    setInterim('')
    const { mode, reason } = resolveMode(sttSettings)

    if (mode === 'browser') {
      setState('starting')
      try {
        const rec = recognizeOnce(sttSettings)
        browser.current = rec
        setState('recording')
        const result = await rec.result
        browser.current = null
        setState('idle')
        if (result.empty) {
          useUI.getState().toast('Nothing heard', 'The microphone was open but no words arrived.', 'info')
          return
        }
        onTranscript(result.text, result)
        settle(result.text)
      } catch (e: any) {
        browser.current = null
        setState('error')
        setError(String(e?.message ?? e))
        settle('')
      }
      return
    }

    if (!recorderSupported()) {
      setState('error')
      setError('This environment cannot record audio — no microphone access. Try the browser mode in Chrome or Edge, or set up a provider.')
      settle('')
      return
    }

    setState('starting')
    try {
      const rec = await startRecording()
      recorder.current = rec
      setStream(rec.stream)
      // voice-glow analyses the stream itself when the beam is on; only run our
      // own meter when it is not, so the microphone is never analysed twice.
      if (voice.beam === false) meter(rec.stream)
      setState('recording')
    } catch (e: any) {
      setState('error')
      setError(e?.name === 'NotAllowedError'
        ? 'Microphone permission was refused. Allow it for this app and try again.'
        : `Could not start recording: ${e?.message ?? e}`)
    }
  }, [state, sttSettings, onTranscript, meter, voice.beam])

  const stop = useCallback(() => {
    const rec = recorder.current
    if (!rec) return
    setState('transcribing')
    teardownLevel()
    setStream(null)
    void (async () => {
      try {
        const blob = await rec.stop()
        recorder.current = null
        if (blob.size < 1200) {
          setState('idle')
          useUI.getState().toast('Nothing recorded', 'That was too short to transcribe.', 'info')
          return
        }
        // The key is read at the moment of use, through the same vault path the
        // chat uses — never copied into settings or into a URL from the page.
        let apiKey = ''
        if (activeMode === 'provider') {
          const pid = voice.provider ?? ''
          apiKey = await usableKey(settings.providers?.[pid]?.apiKey)
          if (!apiKey) throw new Error('That provider has no key saved — add one under Settings → Providers, or pick another engine in Settings → Voice.')
        }
        const result = await transcribeBlob(blob, { ...sttSettings, mode: activeMode }, {
          apiKey,
          baseUrl: voice.provider ? settings.providers?.[voice.provider]?.baseUrl : undefined,
          timeoutMs: (settings.providerTimeouts?.[voice.provider ?? ''] ?? 120) * 1000,
        })
        setState('idle')
        if (result.empty) {
          useUI.getState().toast('Nothing heard', 'The recording contained no words.', 'info')
          settle('')
          return
        }
        onTranscript(result.text, result)
        settle(result.text)
      } catch (e: any) {
        recorder.current = null
        setState('error')
        setError(String(e?.message ?? e))
        settle('')
      }
    })()
  }, [activeMode, onTranscript, settings.providers, settings.providerTimeouts, sttSettings, teardownLevel, voice.provider])

  /**
   * Promise-shaped dictation for components that hand back a string (React Bits
   * PromptBar's `onDictate`, for one). The first call starts listening; calling
   * it again — or letting the recogniser finish on its own — resolves with the
   * words. Always resolves, never rejects: a refused microphone resolves to ''.
   */
  const listen = useCallback(async (): Promise<string> => {
    if (state === 'recording') {
      const answer = new Promise<string>((resolve) => {
        pendingText.current = { resolve, timer: setTimeout(() => settle(''), 90_000) }
      })
      stop()
      return answer
    }
    if (state === 'transcribing') return ''
    const answer = new Promise<string>((resolve) => {
      pendingText.current = { resolve, timer: setTimeout(() => settle(''), 90_000) }
    })
    await start()
    return answer
  }, [start, stop, state, settle])

  const cancel = useCallback(() => {
    settle('')
    recorder.current?.cancel()
    recorder.current = null
    browser.current?.stop()
    browser.current = null
    teardownLevel()
    setStream(null)
    setInterim('')
    setState('idle')
  }, [teardownLevel, settle])

  return {
    state, level, stream, error, interim, supported,
    description: describeStt(sttSettings),
    start: start as () => Promise<void>,
    stop,
    cancel,
    listen,
  }
}
