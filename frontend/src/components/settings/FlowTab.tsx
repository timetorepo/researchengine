import React from 'react'
import { Wind } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { cacheSize, cacheClear } from '@/lib/flow/cache'
import { fmt } from '@/lib/utils'
import { ToggleRow } from './AppearanceTab'

const MODES = [
  { id: 'efficient', name: 'Efficient', desc: 'Maximum token savings. Aggressive context pruning.' },
  { id: 'balanced', name: 'Balanced', desc: 'Default. Prunes old turns into a compact capsule.' },
  { id: 'fidelity', name: 'Fidelity', desc: 'Minimal pruning. Full context every call.' },
]

export function FlowTab() {
  const settings = useStore((s) => s.settings)
  const savedSession = useStore((s) => s.tokensSavedSession)
  const savedLifetime = useStore((s) => s.tokensSavedLifetime)
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
          <div className="text-2xl font-semibold" style={{ color: 'var(--primary)', letterSpacing: '-0.02em' }}>{fmt(savedSession)}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>tokens saved</div>
        </div>
        <div className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Lifetime</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--secondary)', letterSpacing: '-0.02em' }}>{fmt(savedLifetime)}</div>
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

      <div className="mt-6 surface p-4">
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
