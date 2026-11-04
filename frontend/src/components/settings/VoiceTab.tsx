import React, { useEffect, useMemo, useState } from 'react'
import { Mic, AudioLines, ExternalLink } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { providerById } from '@/lib/providers/registry'
import { smoothCaretProps } from '@/components/input/SmoothText'
import { ToggleRow } from './AppearanceTab'
import {
  browserSttSupported, describeStt, recorderSupported, resolveMode,
  type SttMode,
} from '@/lib/voice/stt'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'

/**
 * Voice — dictation and the microphone glow.
 *
 * Three engines, and the page always says which one is live rather than letting
 * you pick something the browser cannot do: the Web Speech API in the page
 * (Chrome/Edge and the Windows build), any OpenAI-compatible transcription
 * endpoint you have a key for (OpenAI, Groq, your own gateway), or a
 * whisper.cpp / faster-whisper server running on this machine. Wispr Flow and
 * friends keep working too — hold the mic and dictate, or dictate into their
 * app and paste; the composer never fights over the cursor.
 *
 * The glow around the composer is Voice by Jakub Antalik (@libraries.dev).
 */

const MODES: { id: SttMode; name: string; desc: string }[] = [
  { id: 'browser', name: 'In this browser', desc: 'Web Speech API — free, instant, words appear as you speak. Chrome, Edge and the Windows build have it; Linux WebKit does not.' },
  { id: 'provider', name: 'A provider', desc: 'Records, then posts the audio to any OpenAI-compatible transcription endpoint with a key you already saved.' },
  { id: 'local', name: 'Local whisper server', desc: 'Records, then posts the audio to whisper.cpp / faster-whisper on this machine. Nothing leaves the host.' },
]

const BEAM_VARIANTS = ['colorful', 'mono', 'ocean', 'sunset', 'forest', 'candy', 'ice', 'gold'] as const

export function VoiceTab() {
  const settings = useStore((s) => s.settings)
  const toast = useUI((s) => s.toast)
  const voice = settings.voice ?? {}
  const [status, setStatus] = useState<{ local: boolean; localUrl: string } | null>(null)
  const [checking, setChecking] = useState(false)

  const update = (patch: Partial<NonNullable<typeof settings.voice>>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, voice: { ...(s.settings.voice ?? {}), ...patch } } }))

  const stt = useMemo(() => ({
    mode: voice.mode ?? 'browser',
    provider: voice.provider,
    model: voice.model ?? 'whisper-1',
    localUrl: voice.localUrl,
    language: voice.language,
  }), [voice.mode, voice.provider, voice.model, voice.localUrl, voice.language])

  const resolved = resolveMode(stt)
  const providers = settings.addedProviders ?? []
  const canRecord = recorderSupported()

  const checkLocal = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/voice/status')
      const json = await res.json()
      setStatus({ local: !!json?.local, localUrl: String(json?.localUrl ?? '') })
    } catch {
      setStatus({ local: false, localUrl: '' })
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => { void checkLocal() }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <Mic size={20} style={{ color: 'var(--primary)' }} /> Voice
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Dictation for the composer — talk instead of typing, and keep talking mid-draft. The glow is Voice
        by <a href="https://libraries.dev/voice" target="_blank" rel="noreferrer" className="underline">Jakub Antalik</a>.
      </p>

      <ToggleRow label="Microphone in the composer" desc="Shows the dictate button beside send."
        value={voice.enabled !== false} onChange={(v) => update({ enabled: v })} />

      <ToggleRow label="Push to talk" desc="Hold the button while you speak; release to transcribe. Off: click to start and stop."
        value={voice.pushToTalk === true} onChange={(v) => update({ pushToTalk: v })} />

      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2">Transcribe with</div>
        <div className="space-y-2">
          {MODES.map((m) => {
            const active = (voice.mode ?? 'browser') === m.id
            const impossible =
              (m.id === 'browser' && !browserSttSupported()) ||
              ((m.id === 'provider' || m.id === 'local') && !canRecord)
            return (
              <button key={m.id} onClick={() => update({ mode: m.id })}
                aria-pressed={active}
                className="w-full text-left p-3.5 rounded-[14px] transition-colors"
                style={{
                  background: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
                }}>
                <div className="font-medium text-[13.5px] flex items-center gap-2">
                  {m.name}
                  {impossible && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>not available here</span>}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{m.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="surface p-3.5 mt-4 text-[12px]" style={{ color: 'var(--text-2)' }}>
        <div className="flex items-center gap-2 font-medium text-[12.5px] mb-1" style={{ color: 'var(--text-1)' }}>
          <AudioLines size={14} style={{ color: 'var(--primary)' }} /> Right now
        </div>
        <div>{describeStt(stt)}</div>
        <div className="mt-1" style={{ color: 'var(--text-3)' }}>
          {resolved.mode === 'browser'
            ? `Speech recognition is ${browserSttSupported() ? 'available' : 'not available'} in this browser.`
            : resolved.reason}
        </div>
      </div>

      {(voice.mode === 'provider') && (
        <div className="mt-5">
          <div className="text-[13px] font-medium mb-2">Provider & model</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>Provider</label>
              <ModernSelect value={voice.provider ?? ''} onChange={(e) => update({ provider: e.target.value || undefined })}
                aria-label="Transcription provider"
                className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
                <option value="">Choose a provider…</option>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {providerById(p)?.name ?? p}
                    {settings.providers?.[p]?.apiKey ? '' : ' — no key yet'}
                  </option>
                ))}
              </ModernSelect>
            </div>
            <div>
              <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>Model</label>
              <input value={voice.model ?? ''} onChange={(e) => update({ model: e.target.value })}
                placeholder="whisper-1"
                aria-label="Transcription model"
                {...smoothCaretProps()}
                className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            </div>
          </div>
          <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>
            The key is read from the vault when you press the mic — never stored again, never put in a URL in the settings file.
            OpenAI: <code>whisper-1</code> or <code>gpt-4o-transcribe</code>. Groq: <code>whisper-large-v3</code>.
          </div>
        </div>
      )}

      {(voice.mode === 'local') && (
        <div className="mt-5">
          <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>Whisper server URL</label>
          <input value={voice.localUrl ?? ''} onChange={(e) => update({ localUrl: e.target.value })}
            placeholder="http://127.0.0.1:8080"
            aria-label="Local whisper server URL"
            {...smoothCaretProps()}
            className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
          <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>
            {checking ? 'Checking…' : status === null
              ? <button className="underline" onClick={() => void checkLocal()}>Check for a local server</button>
              : status.local
                ? `Found a whisper server at ${status.localUrl}`
                : <>Nothing listening on that address yet. Start one with{' '}
                    <code>docker run -p 8080:8080 ghcr.io/ggerganov/whisper.cpp:main --server --host 0.0.0.0</code>.</>}
          </div>
        </div>
      )}

      <div className="mt-5">
        <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>Spoken language (leave empty to follow the system)</label>
        <input value={voice.language ?? ''} onChange={(e) => update({ language: e.target.value })}
          placeholder="en, id, ja…"
          aria-label="Spoken language"
          {...smoothCaretProps()}
          className="w-40 px-3 py-2 rounded-[10px] text-[13px] outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
      </div>

      <div className="mt-7">
        <div className="text-[13px] font-semibold mb-0.5">Microphone glow</div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          Voice by Jakub Antalik paints a sound-reactive glow along the composer's bottom edge while the microphone is open.
        </p>
        <ToggleRow label="Glow while listening" desc="Off keeps the composer plain while dictating."
          value={voice.beam !== false} onChange={(v) => update({ beam: v })} />
        {voice.beam !== false && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {BEAM_VARIANTS.map((v) => (
              <button key={v} onClick={() => update({ beamVariant: v })}
                aria-pressed={(voice.beamVariant ?? 'colorful') === v}
                className="px-2.5 py-1 rounded-full text-[11.5px] capitalize transition-colors"
                style={{
                  background: (voice.beamVariant ?? 'colorful') === v ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--surface)',
                  border: `1px solid ${(voice.beamVariant ?? 'colorful') === v ? 'var(--primary)' : 'var(--surface-border)'}`,
                  color: (voice.beamVariant ?? 'colorful') === v ? 'var(--text-1)' : 'var(--text-3)',
                }}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-7">
        <div className="text-[13px] font-semibold mb-1">Other speech tools</div>
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
          Wispr Flow, Superwhisper, macOS dictation and anything else that types into a focused field all work here
          unchanged — click the message box and dictate; the composer appends rather than replacing what you already wrote.
          The microphone button only takes over the mic while it is recording.
        </p>
        <ul className="text-[12px] mt-2 space-y-1" style={{ color: 'var(--text-3)' }}>
          <li className="flex items-center gap-1.5"><ExternalLink size={12} /> Wispr Flow — system-wide dictation.</li>
          <li className="flex items-center gap-1.5"><ExternalLink size={12} /> Hold the composer mic for quick notes; paste longer transcripts from any tool.</li>
        </ul>
      </div>
    </div>
  )
}
