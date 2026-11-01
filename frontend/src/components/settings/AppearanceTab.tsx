import React, { useRef, useState } from 'react'
import { Check, Upload, RotateCcw, Pipette } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, THEME_CAPTIONS } from '@/lib/themes/meta'
import { Switch } from '@/components/ui/heroui/Switch'
import WakeSlider from '@/components/ui/reactbits/micro/WakeSlider'
import CometDial from '@/components/ui/reactbits/micro/CometDial'
import JellyRadio from '@/components/ui/reactbits/micro/JellyRadio'
import { Button } from '@/components/ui/heroui/Button'
import { SpotlightCard } from '@/components/ui/aceternity/SpotlightCard'
import { DEFAULT_BUBBLES, FILL_SWATCHES, bubbleShape, type BubblePrefs } from '@/lib/chat/bubbles'
import { fileToBackgroundUrl, SOLID_PRESETS } from '@/lib/backgrounds'
import { WALLPAPERS, WALLPAPER_SOURCE } from '@/lib/wallpapers'
import { getPropsForTheme, mixVec3, ANIMATED_BG_META } from '@/lib/backgrounds/themeProps'
import type { AnimatedBgKind, BackgroundConfig } from '@/types'
import { saveNotice } from '@/stores/useNotices'
import { TYPEFACES } from '@/lib/themes/typeface'
import { ArcPicker } from '@/components/ui/kit/beui/ArcPicker'
import { usePrefFlag } from '@/components/ui/kit/prefs'
import { KEYBOARD_PREF, KEYBOARD_PERSPECTIVE, KEYBOARD_EVENT } from '@/components/ui/kit/serenity/MechanicalKeyboardDock'

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
        : kind === 'animated-gradient'
          ? { background: `radial-gradient(120% 90% at 50% 110%, ${prim} 0%, ${bg} 65%)` }
          : kind === 'etched-accretion'
            ? { background: `radial-gradient(60% 60% at 50% 50%, ${sec} 0%, ${bg} 70%)` }
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
      saveNotice('Background updated', 'Stored locally, downscaled to stay light.')
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

      {(bg.kind === 'shape-grid' || bg.kind === 'dark-veil' || bg.kind === 'floating-lines' || bg.kind === 'dither' || bg.kind === 'animated-gradient' || bg.kind === 'etched-accretion' || bg.kind === 'cubes-grid') && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium">Background intensity</span>
            <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>
              {Math.round((bg.intensity ?? ANIMATED_BG_META[bg.kind].defaultIntensity) * 100)}%
            </span>
          </div>
          <WakeSlider
            ariaLabel="Background intensity"
            min={0.2} max={1} step={0.05}
            value={bg.intensity ?? ANIMATED_BG_META[bg.kind].defaultIntensity}
            onChange={(v: number) => setBg({ ...bg, intensity: v } as BackgroundConfig)}
            formatValue={(v: number) => `${Math.round(v * 100)}%`}
          />
          <button onClick={() => setBg({ kind: 'default' })}
            className="mt-2 text-[11.5px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--text-3)' }}>
            <RotateCcw size={11} /> Reset to default background
          </button>
        </div>
      )}

      <div className="space-y-1 mt-6">
        <div className="text-[12.5px] font-medium mb-1">Typeface</div>
        <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-3)' }}>Applies to the whole interface. Each option is shown in its own font.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {TYPEFACES.map((t) => {
            const active = (settings.typeface ?? 'default') === t.id
            return (
              <button key={t.id} onClick={() => update({ typeface: t.id })} aria-pressed={active}
                className="text-left rounded-[12px] px-3 py-2.5 transition-colors"
                style={{ background: active ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)', border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}` }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text)', fontFamily: t.stack }}>{t.label}</span>
                  <span className="text-[17px]" style={{ color: 'var(--text-2)', fontFamily: t.stack }}>Aa</span>
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)', fontFamily: t.stack }}>{t.feel}</div>
                {t.note && <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>{t.note}</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1 mt-6">
        <div className="text-[12.5px] font-medium mb-1">Font size</div>
        <div className="flex gap-1.5 mb-3">
          {[0.9, 1, 1.1].map((f) => (
            <button key={f} onClick={() => update({ fontScale: f })}
              className="px-4 py-1.5 rounded-full text-[12px]"
              style={{ background: settings.fontScale === f ? 'var(--primary)' : 'var(--elevated)', color: settings.fontScale === f ? '#fff' : 'var(--text-2)' }}>
              {f === 0.9 ? 'Compact' : f === 1 ? 'Default' : 'Large'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 mb-2">
          <CometDial
            size={78}
            min={80} max={140} step={1}
            value={Math.round(settings.fontScale * 100)}
            onChange={(v: number) => update({ fontScale: Math.max(0.8, Math.min(1.4, v / 100)) })}
            label="Text size"
            unit="%"
          />
          <div className="flex-1">
            <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Fine text size</div>
            <div className="text-[11px] leading-snug" style={{ color: 'var(--text-3)' }}>
              The presets above snap to three sizes; the dial between them, 80 to 140 percent.
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Density</div>
          <JellyRadio
            value={settings.compact ? 'compact' : 'cozy'}
            onChange={(v: string) => update({ compact: v === 'compact' })}
            items={[
              { value: 'cozy', label: 'Cozy' },
              { value: 'compact', label: 'Compact' },
            ]}
            ariaLabel="Layout density"
          />
        </div>

        {/* ---- Home screen ---- */}
        <div className="surface p-4 mt-4 mb-2" data-home-settings>
          <div className="text-[13px] font-medium mb-0.5">Home screen</div>
          <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-2)' }}>
            Research starts with a question, so the landing view is the hero line, the composer and
            suggestions drawn from your own recent work. Everything else here is optional — and off
            until you ask for it.
          </div>
          <div className="space-y-1">
            <Switch label="Widget cards" description="The grid of recent research, AIFlowEngine savings, articles and spaces under the composer."
              checked={settings.homeWidgets === true} onChange={(v) => update({ homeWidgets: v })} />
            <Switch label="Offline demo button" description="A “try the offline demo” pill under the composer — Learn with no key and no network."
              checked={settings.homeDemo === true} onChange={(v) => update({ homeDemo: v })} />
            <Switch label="Wallpaper on every page" description="Off: the wallpaper stays on the home screen, where there is no dense text over it."
              checked={settings.wallpaperEverywhere === true} onChange={(v) => update({ wallpaperEverywhere: v })} />
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 mb-2">
            <div>
              <div className="text-[12.5px] font-medium">Wallpaper</div>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                Raycast's collection, cropped to 1280×720 WebP (10–20 kB each).{' '}
                <a href={WALLPAPER_SOURCE} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Full-size originals</a>
              </div>
            </div>
            {(settings.homeWallpaper || undefined) && (
              <button onClick={() => update({ homeWallpaper: undefined })}
                className="text-[11.5px] px-2.5 py-1 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WALLPAPERS.map((w) => {
              const active = settings.homeWallpaper === w.id
              return (
                <button key={w.id} onClick={() => update({ homeWallpaper: active ? undefined : w.id })}
                  aria-pressed={active}
                  className="group text-left rounded-[12px] overflow-hidden transition-transform hover:scale-[1.02] press-tap"
                  style={{ border: `1.5px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}` }}
                  title={`${w.name} — ${w.note}`}
                >
                  <span className="block h-[68px] bg-cover bg-center" style={{ backgroundImage: `url(${w.file})` }} />
                  <span className="flex items-center gap-1 px-2 py-1.5 text-[11px]"
                    style={{ background: 'var(--surface)', color: active ? 'var(--primary)' : 'var(--text-2)' }}>
                    <span className="truncate">{w.name}</span>
                    {active && <Check size={11} className="ml-auto shrink-0" />}
                  </span>
                </button>
              )
            })}
          </div>
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
        <Switch label="Welcome for AI themes" description="Show a welcome on the home screen when Claude, ChatGPT, Gemini or Perplexity is the theme. Off hides it everywhere."
          checked={settings.aiThemeWelcome !== false} onChange={(v) => update({ aiThemeWelcome: v })} />
        <Switch label="Composer border beam" description="Ring the home-screen chatbox with Border Beam by Jakubantalik. Brightens while you type."
          checked={settings.composerBeam !== false} onChange={(v) => update({ composerBeam: v })} />
        <Switch label="Dock animation" description="Model rows grow toward the pointer and lift their neighbours, like a dock. Off: the list stays perfectly still."
          checked={settings.dockAnimation !== false} onChange={(v) => update({ dockAnimation: v })} />
        <Switch label="Smooth caret" description="Text fields hide the native caret and spring an animated one to the cursor instead (Skiper UI's smooth caret input). On by default."
          checked={settings.smoothCaret !== false} onChange={(v) => update({ smoothCaret: v })} />
        <Switch label="Scroll progress" description="A thin indicator on the edge of every scrolling surface (Skiper UI's scroll progress). Right-click it to unlock and drag it anywhere; this switch is how you bring it back if you hide it."
          checked={settings.scrollProgress?.enabled !== false}
          onChange={(v) => update({ scrollProgress: { ...(settings.scrollProgress ?? {}), enabled: v } })} />

        {/* Border Beam palette — same component, four built-in variants. */}
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-[13px] font-medium mb-0.5">Beam colour</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                {settings.composerBeam === false ? 'The beam is off — turn it on above to see it.' : 'Shown around the composer on the home screen.'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['ocean', 'colorful', 'sunset', 'mono'] as const).map((v) => (
              <button key={v} onClick={() => update({ composerBeamVariant: v })}
                className="py-2 rounded-[10px] text-[12px] capitalize"
                style={{
                  background: (settings.composerBeamVariant ?? 'ocean') === v ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)',
                  border: `1px solid ${(settings.composerBeamVariant ?? 'ocean') === v ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                  color: (settings.composerBeamVariant ?? 'ocean') === v ? 'var(--primary)' : 'var(--text-2)',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Live swatches. They use the very same .grad-* classes as the cards, so
            flipping the switch (or the theme) makes the mesh travel into place
            here too — you see the colour settle before you leave Settings. */}
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-[13px] font-medium mb-0.5">Gradient preview</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                {settings.themeGradients
                  ? 'Pulled from the active palette — switch theme to watch it re-settle.'
                  : 'Vibrant house hues — independent of the theme.'}
              </div>
            </div>
            <button onClick={() => update({ themeGradients: !settings.themeGradients })} className="humanize-mini shrink-0">
              {settings.themeGradients ? 'Use vibrant' : 'Match theme'}
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {(['research', 'math', 'quiz', 'article', 'flood'] as const).map((k, i) => (
              <div key={k} className={`grad-${k} h-14 rounded-[12px] relative overflow-hidden`}
                style={{ border: '1px solid var(--surface-border)', animationDelay: `${i * 60}ms` }}>
                <span className="absolute left-2 bottom-1.5 text-[9.5px] capitalize"
                  style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{k}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Glass surface theme (chatbox + Dynamic Island) */}
        <div className="surface p-4">
          <div className="text-[13px] font-medium mb-0.5">Glass surface</div>
          <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-2)' }}>
            How the chatbox and Dynamic Island sit over your content.
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'off', name: 'Solid', desc: 'Opaque surface — the classic look.' },
              { id: 'liquid', name: 'Liquid Glass', desc: 'Bends what is behind the chatbox, the island and toasts at their edges.' },
              { id: 'blur', name: 'Blur', desc: 'Frosted blur only, no refraction or gloss.' },
            ] as const).map((g) => (
              <button key={g.id} onClick={() => update({ glassMode: g.id })}
                className="text-left p-3 rounded-[12px] transition-colors"
                style={{
                  background: settings.glassMode === g.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
                  border: `1px solid ${settings.glassMode === g.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                }}>
                <div className="text-[12.5px] font-medium" style={{ color: settings.glassMode === g.id ? 'var(--primary)' : 'var(--text)' }}>{g.name}</div>
                <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {settings.glassMode === 'liquid' && (
          <p className="text-[11.5px] -mt-4 mb-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
            {document.documentElement.dataset.refract === 'on'
              ? 'Bending is on in this window. It runs only on those three small surfaces, so scrolling the chat stays smooth. Turn it off if a slow laptop struggles.'
              : 'This window cannot bend the backdrop (the engine has no SVG backdrop filters), so Liquid Glass shows a frosted blur here. The Chromium-based app and browsers bend it.'}
          </p>
        )}

        {/* The Chats kind switch: gooey by default, plain tabs when turned off. */}
        <div className="surface p-4">
          <Switch label="Gooey tab switch in Chats"
            description="On: the All / Research / Coding switch stretches like liquid between tabs. Off: plain tabs, which read better with a screen reader and cost nothing extra."
            checked={settings.chatsGooey !== false} onChange={(v) => update({ chatsGooey: v })} />
        </div>

        <BubbleSection />
      </div>
    </div>
  )
}

/**
 * Chat bubbles. Taste here is genuinely personal, so this is a real section
 * rather than a theme slot: the same theme should be able to carry an iMessage
 * thread and the app's own card without one of them being wrong.
 */
function BubbleSection() {
  const [kbOn, setKbOn] = usePrefFlag(KEYBOARD_PREF, false)
  const [kbPersp, setKbPersp] = useState<'fixed' | 'custom'>(() => {
    try { return (localStorage.getItem(KEYBOARD_PERSPECTIVE) as 'fixed' | 'custom') || 'fixed' } catch { return 'fixed' }
  })
  const settings = useStore((s) => s.settings)
  const prefs = settings.bubbles ?? DEFAULT_BUBBLES
  const update = (patch: Partial<BubblePrefs>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, bubbles: { ...(s.settings.bubbles ?? DEFAULT_BUBBLES), ...patch } } }))

  const styles: { id: BubblePrefs['style']; name: string; desc: string }[] = [
    { id: 'classic', name: 'Classic', desc: 'The app card. Wide, soft, reversed text for you.' },
    { id: 'imessage', name: 'iMessage', desc: 'Grouped runs, a tail on the last bubble, your fill on the right.' },
    { id: 'square', name: 'Square', desc: 'Flat corners, no rounding at all.' },
    { id: 'pill', name: 'Pill', desc: 'Fully rounded ends.' },
  ]

  const fills: Exclude<BubblePrefs['senderFill'], 'custom'>[] = ['theme', 'blue', 'green', 'purple', 'orange', 'gray']
  const swatch = (f: string) => (f === 'theme' ? 'var(--text)' : f === 'custom' ? prefs.senderColor ?? 'var(--text)' : FILL_SWATCHES[f as keyof typeof FILL_SWATCHES])

  return (
    <div className="surface p-4">
      <div className="text-[13px] font-medium mb-0.5">Chat bubbles</div>
      <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-2)' }}>
        How your messages and the model's read in a chat.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {styles.map((st) => (
          <button key={st.id} onClick={() => update({ style: st.id })}
            className="text-left p-3 rounded-[12px] transition-colors"
            style={{
              background: prefs.style === st.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
              border: `1px solid ${prefs.style === st.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
            }}>
            <div className="text-[12.5px] font-medium" style={{ color: prefs.style === st.id ? 'var(--primary)' : 'var(--text)' }}>{st.name}</div>
            <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{st.desc}</div>
          </button>
        ))}
      </div>

      {/* A live pair, so the choice is seen rather than described. */}
      <div className="rounded-[12px] p-3 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <BubblePreview prefs={prefs} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[11.5px] font-medium mb-1.5">Your fill</div>
          <div className="flex flex-wrap gap-1.5">
            {fills.map((f) => (
              <button key={f} onClick={() => update({ senderFill: f })}
                title={f}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  background: swatch(f),
                  border: `2px solid ${prefs.senderFill === f ? 'var(--primary)' : 'var(--surface-border)'}`,
                  transform: prefs.senderFill === f ? 'scale(1.08)' : 'none',
                }} />
            ))}
            <label className="w-7 h-7 rounded-full grid place-items-center cursor-pointer" title="Custom colour"
              style={{ background: 'var(--elevated)', border: `2px solid ${prefs.senderFill === 'custom' ? 'var(--primary)' : 'var(--surface-border)'}` }}>
              <Pipette size={12} style={{ color: 'var(--text-3)' }} />
              <input type="color" className="sr-only" value={prefs.senderColor ?? '#0B84FF'}
                onChange={(e) => update({ senderFill: 'custom', senderColor: e.target.value })} />
            </label>
          </div>
        </div>
        <div>
          <div className="text-[11.5px] font-medium mb-1.5">Their fill</div>
          <div className="flex flex-wrap gap-1.5">
            {fills.map((f) => (
              <button key={f} onClick={() => update({ aiFill: f })}
                title={f}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  background: f === 'theme' ? 'var(--elevated)' : FILL_SWATCHES[f],
                  border: `2px solid ${prefs.aiFill === f ? 'var(--primary)' : 'var(--surface-border)'}`,
                  transform: prefs.aiFill === f ? 'scale(1.08)' : 'none',
                }} />
            ))}
            <label className="w-7 h-7 rounded-full grid place-items-center cursor-pointer" title="Custom colour"
              style={{ background: 'var(--elevated)', border: `2px solid ${prefs.aiFill === 'custom' ? 'var(--primary)' : 'var(--surface-border)'}` }}>
              <Pipette size={12} style={{ color: 'var(--text-3)' }} />
              <input type="color" className="sr-only" value={prefs.aiColor ?? '#E9E9EB'}
                onChange={(e) => update({ aiFill: 'custom', aiColor: e.target.value })} />
            </label>
          </div>
        </div>
      </div>

      {/* The 3D keyboard: a floating Serenity-style keyboard. Off by default. */}
      <section className="surface p-4 mt-4" aria-label="3D keyboard" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Switch label="3D keyboard" description="A mechanical keyboard that presses down as you type, with a click. Shown in the corner; off by default."
              checked={kbOn} onChange={(v: boolean) => { setKbOn(v); try { localStorage.setItem(KEYBOARD_PREF, v ? '1' : '0'); window.dispatchEvent(new Event(KEYBOARD_EVENT)) } catch { /* private mode */ } }} />
          </div>
          {kbOn && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>Perspective</span>
              <ArcPicker<'fixed' | 'custom'> label="Keyboard perspective" value={kbPersp}
                options={[{ value: 'fixed', label: 'Fixed (top)' }, { value: 'custom', label: 'Custom' }]}
                onChange={(v) => { setKbPersp(v); try { localStorage.setItem(KEYBOARD_PERSPECTIVE, v); window.dispatchEvent(new Event(KEYBOARD_EVENT)) } catch { /* ignore */ } }} />
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <ToggleRow label="Tails" desc="The pointed corner on the last bubble of a run" value={prefs.tails} onChange={(v) => update({ tails: v })} />
        <ToggleRow label="Avatars" desc="Show the mark beside each message" value={prefs.avatars} onChange={(v) => update({ avatars: v })} />
        <ToggleRow label="Group runs" desc="Tighter spacing inside a run from one author" value={prefs.groupRuns} onChange={(v) => update({ groupRuns: v })} />
      </div>

      <div className="mt-3">
        <div className="text-[11.5px] font-medium mb-1.5">Width</div>
        <div className="flex gap-1.5">
          {(['narrow', 'normal', 'wide'] as const).map((w) => (
            <button key={w} onClick={() => update({ width: w })}
              className="px-3 py-1.5 rounded-full text-[11.5px] capitalize"
              style={{
                background: prefs.width === w ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
                color: prefs.width === w ? 'var(--primary)' : 'var(--text-3)',
              }}>
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The same shape the chat draws, at preview size, so the choice is visible. */
function BubblePreview({ prefs }: { prefs: BubblePrefs }) {
  const rows: { from: 'user' | 'assistant'; text: string; position: 'first' | 'last' }[] = [
    { from: 'user', text: 'How does prompt caching save tokens?', position: 'first' },
    { from: 'assistant', text: 'It reuses the prefix you already paid for.', position: 'first' },
    { from: 'assistant', text: 'So a long system prompt costs once, not every turn.', position: 'last' },
  ]
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => {
        const { style, rowStyle, light } = bubbleShape({
          prefs,
          from: r.from,
          position: r.position,
          themeFill: r.from === 'user' ? 'var(--text)' : 'var(--elevated)',
        })
        return (
          <div key={i} className="flex" style={rowStyle}>
            <div style={{ ...style, fontSize: 12, padding: style.padding, maxWidth: '80%' }}>{r.text}</div>
          </div>
        )
      })}
      <div className="sr-only">preview of {prefs.style} bubbles</div>
    </div>
  )
}

export function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Switch label={label} description={desc} checked={value} onChange={onChange} />
}
