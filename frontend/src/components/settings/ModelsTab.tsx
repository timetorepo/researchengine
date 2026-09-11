import React from 'react'
import { useStore } from '@/stores/useStore'

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
