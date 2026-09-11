import React from 'react'
import { Check } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { THEMES } from '@/lib/themes/meta'

export function AppearanceTab() {
  const settings = useStore((s) => s.settings)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Appearance</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Fully themeable via CSS custom properties. ResearchEngineOS turns the app into a desktop-like environment.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {THEMES.map((t) => {
          const active = settings.theme === t.id
          return (
            <button key={t.id} onClick={() => update({ theme: t.id })}
              className="p-3 rounded-[14px] text-left transition-all hover:scale-[1.02]"
              style={{ border: `1.5px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
              <div className="flex gap-1.5 mb-2.5">
                {t.swatches.map((c, i) => (
                  <span key={i} className="w-6 h-6 rounded-[7px]" style={{ background: c, border: '1px solid rgba(128,128,128,0.2)' }} />
                ))}
              </div>
              <div className="text-[12.5px] font-medium flex items-center gap-1.5">
                {t.name} {active && <Check size={12} style={{ color: 'var(--primary)' }} />}
              </div>
              <div className="text-[10.5px] mt-0.5 capitalize" style={{ color: 'var(--text-3)' }}>{t.kind} · {t.codeTheme}</div>
            </button>
          )
        })}
      </div>

      <div className="space-y-5">
        <div>
          <span className="text-[12.5px] font-medium mb-2 block">Font size</span>
          <div className="flex gap-1.5">
            {[0.9, 1, 1.1].map((f) => (
              <button key={f} onClick={() => update({ fontScale: f })}
                className="px-4 py-1.5 rounded-full text-[12px]"
                style={{ background: settings.fontScale === f ? 'var(--primary)' : 'var(--elevated)', color: settings.fontScale === f ? '#fff' : 'var(--text-2)' }}>
                {f === 0.9 ? 'Compact' : f === 1 ? 'Default' : 'Large'}
              </button>
            ))}
          </div>
        </div>

        <ToggleRow label="Compact mode" desc="Tighter spacing and smaller type throughout."
          value={settings.compact} onChange={(v) => update({ compact: v })} />
        <ToggleRow label="Reduce motion" desc="Cross-fades under 150ms instead of spring animations. Also honors your OS setting automatically."
          value={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        <ToggleRow label="OS widgets" desc="Show small status widgets in ResearchEngineOS."
          value={settings.osWidgets} onChange={(v) => update({ osWidgets: v })} />
      </div>
    </div>
  )
}

export function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <div className="text-[13.5px] font-medium">{label}</div>
        <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</div>
      </div>
      <button role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
        style={{ background: value ? 'var(--primary)' : 'var(--elevated)' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: value ? 22 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  )
}
