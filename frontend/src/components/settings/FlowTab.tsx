import React, { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { cacheSize, cacheClear } from '@/lib/flow/cache'
import { flowDiagnostics } from '@/lib/flow/engine'
import { AnimatedCounter } from '@/components/ui/reactbits/AnimatedCounter'
import { fmt } from '@/lib/utils'
import { ToggleRow } from './AppearanceTab'

const MODES = [
  { id: 'efficient', name: 'Efficient', desc: 'Maximum token savings. Aggressive context pruning.' },
  { id: 'balanced', name: 'Balanced', desc: 'Default. Prunes old turns into a compact capsule.' },
  { id: 'fidelity', name: 'Fidelity', desc: 'Minimal pruning. Full context every call.' },
]

const SHAPING = [
  { id: 'off', name: 'Off', desc: 'Raw stream, no shaping. Fastest, can feel bursty.' },
  { id: 'subtle', name: 'Subtle', desc: 'Nearly raw flow, softened at punctuation.' },
  { id: 'standard', name: 'Standard', desc: 'Continuous flow with soft punctuation pauses. Each block settles into focus from a gentle blur.' },
  { id: 'cinematic', name: 'Cinematic', desc: 'Deliberate pacing with dramatic pauses. Slower, calmer.' },
] as const

const THINKING_STYLES = [
  { id: 'minimal', name: 'Minimal' },
  { id: 'standard', name: 'Standard' },
  { id: 'verbose', name: 'Verbose' },
] as const

function Segmented({ options, value, onChange }: {
  options: readonly { id: string; name: string }[]
  value: string
  onChange: (v: any) => void
}) {
  return (
    <div className="flex rounded-[12px] p-1 gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className="flex-1 py-1.5 rounded-[9px] text-[12.5px] font-medium transition-colors"
          style={{
            background: value === o.id ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent',
            color: value === o.id ? 'var(--text-1)' : 'var(--text-3)',
          }}>
          {o.name}
        </button>
      ))}
    </div>
  )
}

function DiagSparkline() {
  const [, force] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => force((n) => n + 1), 500)
    return () => clearInterval(iv)
  }, [])
  const samples = flowDiagnostics.samples.slice(-150)
  if (samples.length < 2) {
    return <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>No active stream. Send a message to sample the pacer.</div>
  }
  const max = Math.max(20, ...samples.map((s) => Math.max(s.arrival, s.rendered)))
  const pt = (vals: number[]) => vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${40 - (v / max) * 38}`).join(' ')
  return (
    <div className="mt-2">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-20" style={{ overflow: 'visible' }}>
        <polyline points={pt(samples.map((s) => s.arrival))} fill="none" stroke="var(--text-3)" strokeWidth="0.6" opacity="0.7" />
        <polyline points={pt(samples.map((s) => s.rendered))} fill="none" stroke="var(--primary)" strokeWidth="0.9" />
      </svg>
      <div className="flex items-center gap-4 text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] inline-block" style={{ background: 'var(--text-3)' }} /> raw arrival (tok/s)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] inline-block" style={{ background: 'var(--primary)' }} /> rendered (tok/s)</span>
      </div>
    </div>
  )
}

export function FlowTab() {
  const settings = useStore((s) => s.settings)
  const savedSession = useStore((s) => s.tokensSavedSession)
  const savedLifetime = useStore((s) => s.tokensSavedLifetime)
  const diagnostics = useUI((s) => s.diagnostics)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <Wind size={20} style={{ color: 'var(--primary)' }} /> AIFlowEngine
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Research Engine's prompt-optimization layer. Classifies each query, prunes context into capsules, shapes the prompt, and caches — cutting token use 40–70%.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>This session</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--primary)', letterSpacing: '-0.02em' }}><AnimatedCounter value={savedSession} duration={800} /></div>
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>tokens saved</div>
        </div>
        <div className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Lifetime</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--secondary)', letterSpacing: '-0.02em' }}><AnimatedCounter value={savedLifetime} duration={800} /></div>
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>tokens saved</div>
        </div>
      </div>

      <ToggleRow label="Enable AIFlowEngine" desc="Applies to chat and every Agent Flood agent by default."
        value={settings.flowEnabled} onChange={(v) => update({ flowEnabled: v })} />

      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2">Mode</div>
        <div className="space-y-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => update({ flowMode: m.id })}
              className="w-full text-left p-3.5 rounded-[14px] transition-colors"
              style={{
                background: settings.flowMode === m.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
                border: `1px solid ${settings.flowMode === m.id ? 'var(--primary)' : 'var(--surface-border)'}`,
              }}>
              <div className="font-medium text-[13.5px]">{m.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Stream shaping ---- */}
      <div className="mt-7">
        <div className="text-[13px] font-semibold mb-0.5">Stream shaping</div>
        <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Responses are buffered and re-timed by the AIFlowEngine so they read as composed prose instead of a raw token burst. This only affects pacing — it never adds or drops words.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {SHAPING.map((m) => (
              <button key={m.id} onClick={() => update({ flowShaping: m.id })}
                className="w-full text-left p-3 rounded-[13px] transition-colors"
                style={{
                  background: settings.flowShaping === m.id ? 'color-mix(in srgb, var(--secondary) 12%, transparent)' : 'var(--surface)',
                  border: `1px solid ${settings.flowShaping === m.id ? 'var(--secondary)' : 'var(--surface-border)'}`,
                }}>
                <div className="font-medium text-[13px]">{m.name}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{m.desc}</div>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div className="surface p-3">
              <div className="text-[12px] font-medium mb-1.5">Thinking indicator</div>
              <Segmented options={THINKING_STYLES} value={settings.thinkingStyle} onChange={(v) => update({ thinkingStyle: v })} />
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                {settings.thinkingStyle === 'minimal' ? 'No label while a response is being composed.'
                  : settings.thinkingStyle === 'verbose' ? 'Orb, stage label, and a full pipeline progress strip.'
                  : 'Orb plus the current pipeline stage.'}
              </div>
            </div>
            <div className="surface p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[12px] font-medium">Pacing sensitivity</div>
                <div className="text-[11px]" style={{ color: 'var(--primary)' }}>{Math.round((settings.pacingSensitivity ?? 0.5) * 100)}%</div>
              </div>
              <input type="range" min={0} max={100} value={Math.round((settings.pacingSensitivity ?? 0.5) * 100)}
                onChange={(e) => update({ pacingSensitivity: Number(e.target.value) / 100 })}
                className="w-full" style={{ accentColor: 'var(--primary)' }} />
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Higher = the stream speeds up faster when the buffer fills.</div>
            </div>
            <ToggleRow label="Punctuation pauses" desc="Slight pause after . ? ! : ; and , for a natural read."
              value={settings.punctuationPauses ?? true} onChange={(v) => update({ punctuationPauses: v })} />
            <ToggleRow label="Speed booster" desc="AIFlowEngine tightens every micro-delay so API models answer in the 1–4 second band while the composed cadence keeps quality high."
              value={settings.flowBoost ?? true} onChange={(v) => update({ flowBoost: v })} />
          </div>
        </div>
      </div>

      {diagnostics && (
        <div className="mt-6 surface p-4">
          <div className="text-[13px] font-medium">Pacer diagnostics</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Live raw-arrival vs rendered token rate during streaming.</div>
          <DiagSparkline />
        </div>
      )}

      <div className="mt-7 surface p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[13px] font-medium">Semantic cache</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{cacheSize()} entries. Similar queries reuse cached answers before hitting the paid model.</div>
          </div>
          <button onClick={() => { cacheClear(); location.reload() }}
            className="px-3 py-1.5 rounded-[10px] text-[12px]"
            style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
            Clear cache
          </button>
        </div>
      </div>

      <div className="mt-4 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
        How it works: (1) a fast on-device classifier tags each query · (2) older turns are summarized into a context capsule · (3) the system prompt is built per query · (4) response length is calibrated to complexity · (5) only relevant skills are injected · (6) a local cache short-circuits repeat queries.
      </div>
    </div>
  )
}
