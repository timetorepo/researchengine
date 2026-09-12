import React, { useRef } from 'react'
import { Check, Upload, RotateCcw } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, THEME_CAPTIONS } from '@/lib/themes/meta'
import { Switch } from '@/components/ui/heroui/Switch'
import { Button } from '@/components/ui/heroui/Button'
import { SpotlightCard } from '@/components/ui/aceternity/SpotlightCard'
import { fileToBackgroundUrl, SOLID_PRESETS } from '@/lib/backgrounds'
import { getPropsForTheme, mixVec3, ANIMATED_BG_META } from '@/lib/backgrounds/themeProps'
import type { AnimatedBgKind, BackgroundConfig } from '@/types'

const rgb = (v: [number, number, number]) => `rgb(${v.map((c) => Math.round(c * 255)).join(',')})`

/** Static preview swatch approximating each animated background in the
 *  active theme's palette (the real one runs full-screen on selection). */
function BgPreview({ kind }: { kind: AnimatedBgKind }) {
  const themeId = useStore((s) => s.settings.theme)
  const t = getPropsForTheme(themeId)
  const bg = rgb(t.bg)
  const prim = rgb(mixVec3(t.bg, t.primary, 0.55))
  const sec = rgb(mixVec3(t.bg, t.secondary, 0.45))
  const style: React.CSSProperties =
    kind === 'shape-grid'
      ? {
          background: bg,
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(128,128,128,0.5) 0 2px, transparent 3px), radial-gradient(circle at 65% 60%, rgba(128,128,128,0.4) 0 2.5px, transparent 3.5px), linear-gradient(rgba(128,128,128,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.16) 1px, transparent 1px)',
          backgroundSize: 'auto, auto, 14px 14px, 14px 14px',
        }
      : kind === 'dark-veil'
        ? { background: `radial-gradient(130% 100% at 25% 0%, ${prim} 0%, ${bg} 62%), radial-gradient(120% 100% at 80% 100%, ${sec} 0%, ${bg} 58%)` }
        : kind === 'floating-lines'
          ? {
              background: bg,
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${prim} 18%, transparent 40%, ${sec} 62%, transparent 85%)`,
              backgroundSize: '100% 2px',
              backgroundRepeat: 'repeat-y',
              backgroundPosition: '0 6px',
            }
          : {
              background: bg,
              backgroundImage: `repeating-conic-gradient(${prim} 0% 25%, transparent 0% 50%)`,
              backgroundSize: '4px 4px',
              opacity: 0.9,
            }
  return <div className="h-12 w-full rounded-[9px] mb-2 border" style={{ ...style, borderColor: 'var(--surface-border)' }} aria-hidden="true" />
}

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

      {/* ---- Animated backgrounds ---- */}
      <h3 className="text-[14px] font-semibold mb-1">Animated backgrounds</h3>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
        Shape Grid stays neutral and crisp under any theme; the others adapt their colors to the active theme.
        Paused while the tab is hidden, and replaced by a static version under the Eco profile or Reduce motion.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {(Object.keys(ANIMATED_BG_META) as AnimatedBgKind[]).map((kind) => {
          const meta = ANIMATED_BG_META[kind]
          const active = bg.kind === kind
          return (
            <button key={kind} onClick={() => setBg({ kind, intensity: meta.defaultIntensity } as BackgroundConfig)}
              className="p-2 rounded-[12px] text-left transition-all"
              style={{
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
                background: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)',
              }}>
              <BgPreview kind={kind} />
              <div className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: active ? 'var(--primary)' : 'var(--text)' }}>
                {meta.label} {active && <Check size={11} />}
              </div>
              <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{meta.desc}</div>
            </button>
          )
        })}
      </div>

      {(bg.kind === 'shape-grid' || bg.kind === 'dark-veil' || bg.kind === 'floating-lines' || bg.kind === 'dither') && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium">Background intensity</span>
            <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>
              {Math.round((bg.intensity ?? ANIMATED_BG_META[bg.kind].defaultIntensity) * 100)}%
            </span>
          </div>
          <input type="range" min={0.2} max={1} step={0.05} value={bg.intensity ?? ANIMATED_BG_META[bg.kind].defaultIntensity}
            onChange={(e) => setBg({ ...bg, intensity: Number(e.target.value) } as BackgroundConfig)}
            className="w-full accent-[var(--primary)]" aria-label="Background intensity" />
          <button onClick={() => setBg({ kind: 'default' })}
            className="mt-2 text-[11.5px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--text-3)' }}>
            <RotateCcw size={11} /> Reset to default background
          </button>
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
        <Switch label="Dynamic Island" description="Float the status island over every theme, not only ResearchEngineOS."
          checked={settings.dynamicIsland} onChange={(v) => update({ dynamicIsland: v })} />
        <Switch label="Theme-matched gradients" description="Derive card gradients from the active theme's palette instead of the fixed vibrant hues."
          checked={settings.themeGradients} onChange={(v) => update({ themeGradients: v })} />
      </div>
    </div>
  )
}

export function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Switch label={label} description={desc} checked={value} onChange={onChange} />
}
