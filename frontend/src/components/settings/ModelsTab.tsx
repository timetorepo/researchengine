import React, { useState } from 'react'
import { ScrollText, RotateCcw, GitBranch } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { MASTERS, MASTER_VERSION } from '@/lib/prompts/masters'
import { saveNotice } from '@/stores/useNotices'

export function ModelsTab() {
  const settings = useStore((s) => s.settings)
  const model = settings.defaultModel.split(':')[1] ?? settings.defaultModel
  const d = settings.modelDefaults[model] ?? { temperature: 0.7, topP: 1, maxTokens: 1024 }
  const update = (patch: any) =>
    useStore.setState((s) => ({ settings: { ...s.settings, modelDefaults: { ...s.settings.modelDefaults, [model]: { ...d, ...patch } } } }))

  const sysKey = 'default'
  const sys = settings.customSystemPrompts[sysKey] ?? ''

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Models</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Defaults for the currently selected model: <code className="font-mono text-[12px] px-1.5 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>{model}</code>
      </p>

      <div className="space-y-6">
        <Slider label="Temperature" value={d.temperature} min={0} max={2} step={0.1} onChange={(v) => update({ temperature: v })}
          hint="Lower = focused and deterministic. Higher = creative." />
        <Slider label="Top-p" value={d.topP} min={0} max={1} step={0.05} onChange={(v) => update({ topP: v })}
          hint="Nucleus sampling threshold." />
        <Slider label="Max tokens" value={d.maxTokens} min={128} max={4096} step={128} onChange={(v) => update({ maxTokens: v })}
          hint="Upper bound per response. AIFlowEngine still calibrates per query." />

        <MasterPromptsSection />

        <div>
          <div className="text-[13px] font-medium mb-1.5">Custom system prompt</div>
          <textarea
            value={sys}
            onChange={(e) => useStore.setState((s) => ({ settings: { ...s.settings, customSystemPrompts: { ...s.settings.customSystemPrompts, [sysKey]: e.target.value } } }))}
            placeholder="Optional. Prepended to Research Engine's per-query system prompt."
            rows={4}
            className="w-full px-3 py-2 rounded-[12px] outline-none text-[13px] resize-y"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          />
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
            AIFlowEngine builds the rest of the system prompt per query — this is only your standing instruction.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Master Prompts — locked-good defaults, overridable, divergence visually marked. */
function MasterPromptsSection() {
  const overrides = useStore((s) => s.settings.masterPromptOverrides)
  const ui = useUI()
  const [open, setOpen] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const save = (key: string) => {
    const text = drafts[key] ?? ''
    useStore.setState((s) => {
      const next = { ...s.settings.masterPromptOverrides }
      const def = MASTERS.find((m) => m.key === key)
      if (!text.trim() || text === def?.text) delete next[key]
      else next[key] = text
      return { settings: { ...s.settings, masterPromptOverrides: next } }
    })
    saveNotice('Master prompt saved', 'Active immediately for new messages.')
  }
  const reset = (key: string) => {
    useStore.setState((s) => {
      const next = { ...s.settings.masterPromptOverrides }
      delete next[key]
      return { settings: { ...s.settings, masterPromptOverrides: next } }
    })
    setDrafts((d) => ({ ...d, [key]: '' }))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <ScrollText size={15} style={{ color: 'var(--primary)' }} />
        <span className="text-[13px] font-medium">Master prompts</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>v{MASTER_VERSION}</span>
      </div>
      <p className="text-[11px] mb-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        The seven system prompts that shape every answer. Defaults are tuned and versioned; override only when you know why.
        Overridden masters carry a <span style={{ color: 'var(--warning)' }}>divergence marker</span>.
      </p>
      <div className="space-y-1.5">
        {MASTERS.map((m) => {
          const overridden = !!overrides[m.key]
          const isOpen = open === m.key
          const value = drafts[m.key] ?? overrides[m.key] ?? m.text
          return (
            <div key={m.key} className="rounded-[12px] overflow-hidden" style={{ border: `1px solid ${overridden ? 'color-mix(in srgb, var(--warning) 45%, var(--surface-border))' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
              <button onClick={() => { setOpen(isOpen ? null : m.key); setDrafts((d) => ({ ...d, [m.key]: value })) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                <span className="text-[12.5px] font-medium flex-1">{m.label}</span>
                {overridden && (
                  <span className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--warning) 16%, transparent)', color: 'var(--warning)' }}>
                    <GitBranch size={9} /> overridden
                  </span>
                )}
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>v{m.version}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  <textarea value={value} rows={7}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[12px] font-mono resize-y leading-relaxed"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => save(m.key)} className="px-3 py-1.5 rounded-full text-[11.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Save</button>
                    {overridden && (
                      <button onClick={() => reset(m.key)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                        <RotateCcw size={11} /> Restore default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]" aria-label={label} />
      {hint && <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  )
}
