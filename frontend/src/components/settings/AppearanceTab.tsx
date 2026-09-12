import React, { useRef } from 'react'
import { Check, Upload, RotateCcw } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, THEME_CAPTIONS } from '@/lib/themes/meta'
import { Switch } from '@/components/ui/heroui/Switch'
import { Button } from '@/components/ui/heroui/Button'
import { SpotlightCard } from '@/components/ui/aceternity/SpotlightCard'
import { fileToBackgroundUrl, SOLID_PRESETS } from '@/lib/backgrounds'
import type { BackgroundConfig } from '@/types'

export function AppearanceTab() {
  const settings = useStore((s) => s.settings)
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
  const bg: BackgroundConfig = settings.background ?? { kind: 'default' }
  const setBg = (b: BackgroundConfig) => update({ background: b })
  const activeKind = bg.kind

  const pickImage = (blur: boolean) => async (f: File) => {
    try {
      const dataUrl = await fileToBackgroundUrl(f)
      setBg(blur ? { kind: 'blur', dataUrl } : { kind: 'image', dataUrl })
      ui.toast('Background updated', 'Stored locally, downscaled to stay light.', 'success')
    } catch {
      ui.toast('Could not read image', 'Try a different file.', 'danger')
    }
  }

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
            <SpotlightCard key={t.id} className="rounded-[14px]" onClick={() => update({ theme: t.id })}>
              <div className="p-3 rounded-[14px] text-left transition-all hover:scale-[1.02]"
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
                {THEME_CAPTIONS[t.id] && <div className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-3)' }}>{THEME_CAPTIONS[t.id]}</div>}
              </div>
            </SpotlightCard>
          )
        })}
      </div>

      {/* ---- Background ---- */}
      <h3 className="text-[14px] font-semibold mb-1">Background</h3>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
        Solid color, image, blurred image, or a dark veil. Rendered behind everything, stored locally.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {([['default', 'Default'], ['solid', 'Solid'], ['image', 'Image'], ['blur', 'Blurred'], ['veil', 'Dark veil']] as const).map(([kind, label]) => (
          <button key={kind}
            onClick={() => {
              if (kind === 'default') setBg({ kind: 'default' })
              else if (kind === 'solid') setBg({ kind: 'solid', color: bg.kind === 'solid' ? bg.color : '#101828' })
              else if (kind === 'veil') setBg({ kind: 'veil', opacity: bg.kind === 'veil' ? bg.opacity : 0.4 })
              else fileRef.current?.click()
            }}
            className="px-2 py-2.5 rounded-[12px] text-[12px] font-medium transition-all"
            style={{
              border: `1.5px solid ${activeKind === kind ? 'var(--primary)' : 'var(--surface-border)'}`,
              background: activeKind === kind ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
              color: activeKind === kind ? 'var(--primary)' : 'var(--text-2)',
            }}>
            {label}
          </button>
        ))}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) await pickImage(activeKind === 'blur')(f)
          e.target.value = ''
        }} />
      </div>

      {bg.kind === 'solid' && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {SOLID_PRESETS.map((c) => (
            <button key={c} onClick={() => setBg({ kind: 'solid', color: c })} aria-label={`Color ${c}`}
              className="w-8 h-8 rounded-[9px] transition-transform hover:scale-110"
              style={{ background: c, border: bg.color === c ? '2px solid var(--primary)' : '1px solid var(--surface-border)' }} />
          ))}
          <label className="flex items-center gap-2 text-[12px] ml-1" style={{ color: 'var(--text-2)' }}>
            Custom
            <input type="color" value={bg.color} onChange={(e) => setBg({ kind: 'solid', color: e.target.value })}
              className="w-8 h-8 rounded-[9px] cursor-pointer bg-transparent" style={{ border: '1px solid var(--surface-border)' }} />
          </label>
        </div>
      )}

      {(bg.kind === 'image' || bg.kind === 'blur') && (
        <div className="flex items-center gap-3 mb-4">
          <div className="h-20 w-36 rounded-[12px] overflow-hidden hairline relative shrink-0">
            <img src={bg.dataUrl} alt="Current background" className="w-full h-full object-cover"
              style={{ filter: bg.kind === 'blur' ? 'blur(8px) scale(1.08)' : undefined }} />
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="flat" size="sm" onClick={() => fileRef.current?.click()} startContent={<Upload size={12} />}>Replace image</Button>
            <Button variant="ghost" color="danger" size="sm" onClick={() => setBg({ kind: 'default' })}>Remove</Button>
          </div>
        </div>
      )}

      {bg.kind === 'veil' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium">Veil intensity</span>
            <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>
              {Math.round(bg.opacity * 100)}%
            </span>
          </div>
          <input type="range" min={0.15} max={0.8} step={0.05} value={bg.opacity}
            onChange={(e) => setBg({ kind: 'veil', opacity: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]" aria-label="Veil intensity" />
        </div>
      )}

      <div className="space-y-1 mt-6">
        <div className="text-[12.5px] font-medium mb-1">Font size</div>
        <div className="flex gap-1.5 mb-4">
          {[0.9, 1, 1.1].map((f) => (
            <button key={f} onClick={() => update({ fontScale: f })}
              className="px-4 py-1.5 rounded-full text-[12px]"
              style={{ background: settings.fontScale === f ? 'var(--primary)' : 'var(--elevated)', color: settings.fontScale === f ? '#fff' : 'var(--text-2)' }}>
              {f === 0.9 ? 'Compact' : f === 1 ? 'Default' : 'Large'}
            </button>
          ))}
        </div>

        <Switch label="Compact mode" description="Tighter spacing and smaller type throughout."
          checked={settings.compact} onChange={(v) => update({ compact: v })} />
        <Switch label="Reduce motion" description="Cross-fades under 150ms instead of spring animations. Also honors your OS setting."
          checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        <Switch label="OS widgets" description="Show small status widgets in ResearchEngineOS."
          checked={settings.osWidgets} onChange={(v) => update({ osWidgets: v })} />
      </div>
    </div>
  )
}

export function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Switch label={label} description={desc} checked={value} onChange={onChange} />
}
