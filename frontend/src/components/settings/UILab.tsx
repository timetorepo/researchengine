/**
 * Developer Mode → UI lab.
 *
 * The request was to be able to *see* the interface this app builds, not just
 * the project-creation path: new-update UI, thinking UI, anything inside the
 * app, accessible and previewable. This is that bench.
 *
 * Scope, stated plainly because it is a rule and not a preference: **only
 * interface built for this app**. Aceternity, SmoothUI, ReactBits, Skiper,
 * HeroUI, Watermelon, Border Beam and the rest are vendored third-party
 * components with their own upstream — a bug in one of those is fixed by
 * patching the vendored copy and re-verifying its digest
 * (`scripts/aceternity-vendor.mjs --verify`, `scripts/smoothui-registry.mjs`),
 * not by a slider in here. So the registry below contains only components
 * written in this repository, and `render-check` asserts that every entry
 * points at a file under `@/components` that is not one of the vendor folders.
 *
 * Each entry previews the *real* component — the same import the app uses, not
 * a copy — inside a frame whose width, theme and motion the user controls, and
 * can jump to where that component lives in the running app and flash it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Crosshair, Eye, Layers, MousePointerClick, RefreshCw, RotateCcw, Ruler, Search, Sun, Wand2,
} from 'lucide-react'
import { InputBar } from '@/components/input/InputBar'
import { ModeMenu, type ModeOption } from '@/components/input/ModeMenu'
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator'
import { RouteSkeleton } from '@/components/shared/RouteSkeleton'
import { RevolvingText } from '@/components/home/RevolvingText'
import { Button } from '@/components/ui/heroui/Button'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, applyTheme } from '@/lib/themes/meta'
import { navigateNow } from '@/lib/routes/registry'
import { scrollChildIntoView } from '@/lib/dom/scroll'
import type { FlowStage } from '@/lib/flow/engine'
import { clsx } from 'clsx'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'

/* ------------------------------------------------------------------ types */

export interface LabKnob {
  id: string
  label: string
  type: 'toggle' | 'select' | 'range'
  initial: string | number | boolean
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
}

export interface LabEntry {
  id: string
  name: string
  /** Where the component lives — shown on the card, checked by render-check. */
  component: string
  /** What it is for, in one line. */
  note: string
  /** Where in the app it normally appears. */
  host: string
  /** `data-ui` value in the running app, for the flash jump. */
  ui: string
  /** Route to open first, when the component is not on the settings screen. */
  route?: string
  /** What to do when the flash does not find it. */
  hint: string
  knobs?: LabKnob[]
  render: (v: Record<string, string | number | boolean>, api: { log: (line: string) => void }) => React.ReactNode
}

/* --------------------------------------------------------------- the list */

/** The stage-cycling knob the thinking indicator gets. */
const STAGES: FlowStage[] = ['understand', 'search', 'read-sources', 'retrieve', 'think', 'compose']

/** Sample pills for the standalone mode-menu preview, toggling only locally. */
function samplePills(state: Record<string, boolean>, set: (id: string, on: boolean) => void): ModeOption[] {
  const rows: { id: string; label: string; desc: string; tone?: 'primary' | 'warning' }[] = [
    { id: 'flow', label: 'Flow', desc: 'AIFlowEngine keeps the context tight — cheaper, faster long chats.' },
    { id: 'search', label: 'Search', desc: 'Live web results with citations (Cmd/Ctrl+Enter).' },
    { id: 'quality', label: 'Quality', desc: 'Longer, structured, thoroughly cited answers. Turns search on.' },
    { id: 'math', label: 'Math', desc: 'Shows the working, step by step.', tone: 'warning' },
  ]
  return rows.map((r) => ({
    ...r,
    icon: Layers,
    active: !!state[r.id],
    toggle: () => set(r.id, !state[r.id]),
  }))
}

/** A real anchor element for the menu, because the menu positions off one. */
function ModeMenuStage({ log }: { log: (line: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  // Starts closed on purpose: the panel is positioned off its anchor in
  // viewport coordinates, so it should be opened after the settings sheet has
  // finished sliding in rather than mid-transition.
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<Record<string, boolean>>({ flow: true })
  const pills = samplePills(state, (id, on) => {
    setState((s) => ({ ...s, [id]: on }))
    log(`mode ${id} → ${on ? 'on' : 'off'}`)
  })
  return (
    <div className="relative min-h-[260px] p-4">
      <button
        ref={ref}
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-full text-[12px]"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
        {open ? 'Close the mode menu' : 'Open the mode menu'}
      </button>
      {open && <ModeMenu pills={pills} anchor={ref.current} onClose={() => setOpen(false)} />}
    </div>
  )
}

export const AGENT_UI: LabEntry[] = [
  {
    id: 'composer',
    name: 'The composer',
    component: '@/components/input/InputBar',
    note: 'Everything a prompt needs: modes, attachments, dictation, the send control and the voice glow.',
    host: 'Home screen and every chat',
    ui: 'composer',
    hint: 'It is on the home screen and under every chat.',
    knobs: [
      { id: 'big', label: 'Big (home) size', type: 'toggle', initial: false },
      { id: 'streaming', label: 'Mid-answer (Stop showing)', type: 'toggle', initial: false },
      { id: 'emptyHistory', label: 'No history yet', type: 'toggle', initial: true },
    ],
    render: (v, api) => (
      <InputBar
        autoFocus={false}
        big={!!v.big}
        chatId=""
        emptyHistory={!!v.emptyHistory}
        mathMode={false}
        onSend={(prompt, opts) => api.log(`send “${prompt}”${opts ? ` ${JSON.stringify(opts)}` : ''}`)}
        onStop={() => api.log('stop pressed')}
        setMathMode={(on) => api.log(`math → ${on}`)}
        streaming={!!v.streaming}
      />
    ),
  },
  {
    id: 'thinking',
    name: 'Thinking indicator',
    component: '@/components/chat/ThinkingIndicator',
    note: 'The breathing orb and the pipeline label that cross-fades through the real stages of a request.',
    host: 'Under a question while the answer is being built',
    ui: 'thinking',
    route: '#/',
    hint: 'Open a chat and ask something to see it live.',
    knobs: [
      { id: 'stage', label: 'Stage', type: 'select', initial: 'think', options: STAGES.map((s) => ({ value: s, label: s })) },
      { id: 'inline', label: 'Inline (inside a message)', type: 'toggle', initial: false },
      { id: 'cycling', label: 'Let it cycle by itself', type: 'toggle', initial: false },
    ],
    render: (v, api) => <ThinkingStage stage={String(v.stage) as FlowStage} inline={!!v.inline} cycling={!!v.cycling} log={api.log} />,
  },
  {
    id: 'mode-menu',
    name: 'Mode menu',
    component: '@/components/input/ModeMenu',
    note: 'The popover behind the composer’s sliders button — anchored, clamped to the viewport, closes on the row you press.',
    host: 'The composer, via the sliders icon',
    ui: 'mode-menu',
    hint: 'Open the composer and press the sliders button.',
    render: (_v, api) => <ModeMenuStage log={api.log} />,
  },
  {
    id: 'revolving',
    name: 'Revolving hero line',
    component: '@/components/home/RevolvingText',
    note: 'The home headline that revolves one item at a time and narrows the type to fit, never cropping.',
    host: 'Home screen, above the composer',
    ui: 'revolving-hero',
    route: '#/',
    hint: 'It is the headline on the home screen.',
    knobs: [
      { id: 'ms', label: 'Interval (ms)', type: 'range', initial: 2400, min: 800, max: 6000, step: 200 },
      { id: 'font', label: 'Max font (px)', type: 'range', initial: 34, min: 20, max: 52, step: 2 },
    ],
    render: (v) => (
      <div className="p-6">
        <RevolvingText
          intervalMs={Number(v.ms)}
          items={[
            { word: 'a paper' },
            { word: 'a dataset' },
            { word: 'an exam' },
            { word: 'a codebase' },
          ]}
          maxFontPx={Number(v.font)}
        />
      </div>
    ),
  },
  {
    id: 'skeleton',
    name: 'Route skeleton',
    component: '@/components/shared/RouteSkeleton',
    note: 'What a page shows while its chunk streams in — bars in the page’s own rhythm, never a spinner.',
    host: 'Any cold page, for a moment',
    ui: 'route-skeleton',
    hint: 'Open a page you have not opened this session; it appears for a frame or two.',
    render: () => <div className="min-h-[280px]"><RouteSkeleton /></div>,
  },
]

/* ------------------------------------------------------------- the pieces */

/** The thinking indicator, wrapped so the "cycle" knob can advance the stage. */
function ThinkingStage({ stage, inline, cycling, log }: { stage: FlowStage; inline: boolean; cycling: boolean; log: (l: string) => void }) {
  const [now, setNow] = useState(stage)
  useEffect(() => setNow(stage), [stage])
  useEffect(() => {
    if (!cycling) return
    const iv = setInterval(() => {
      setNow((s) => {
        const next = STAGES[(STAGES.indexOf(s) + 1) % STAGES.length]
        log(`stage → ${next}`)
        return next
      })
    }, 1400)
    return () => clearInterval(iv)
  }, [cycling, log])
  return (
    <div className="p-6">
      <ThinkingIndicator inline={inline} stage={now} />
    </div>
  )
}

/**
 * The nearest box that can actually scroll this element.
 *
 * Deliberately not the browser's own "scroll this element into view" call:
 * that walks *every* scrollable ancestor, including the ones with
 * `overflow: hidden` that the user cannot scroll back — the bug this app spent
 * a round fixing (lib/dom/scroll). So the container is named, and only its
 * `scrollTop` moves.
 */
function scrollBoxOf(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node
    node = node.parentElement
  }
  return null
}

/** Scroll to an element in the app and ring it for a moment. */
function flash(el: HTMLElement) {
  const box = scrollBoxOf(el)
  if (box) scrollChildIntoView(box, el, { block: 'center', smooth: true })
  el.classList.add('re-ui-flash')
  window.setTimeout(() => el.classList.remove('re-ui-flash'), 2800)
}

const WIDTHS = [
  { id: 'phone', label: '390', w: 390 },
  { id: 'compact', label: '640', w: 640 },
  { id: 'full', label: 'Full', w: 0 },
] as const

/* ------------------------------------------------------------------- lab */

export function UILab() {
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const [selected, setSelected] = useState(AGENT_UI[0].id)
  const [width, setWidth] = useState<(typeof WIDTHS)[number]['id']>('full')
  const [themePreview, setThemePreview] = useState<string>('')
  const [grid, setGrid] = useState(false)
  const [remount, setRemount] = useState(0)
  const [query, setQuery] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, Record<string, string | number | boolean>>>(() =>
    Object.fromEntries(AGENT_UI.map((e) => [e.id, Object.fromEntries((e.knobs ?? []).map((k) => [k.id, k.initial]))])),
  )
  const original = useRef<{ theme: string; fontScale: number; compact: boolean; reduceMotion: boolean } | null>(null)

  const push = useCallback((line: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 40))
  }, [])

  /**
   * The theme knob is a preview, not a settings change: it swaps the CSS
   * variables and puts the user's own theme back the moment this unmounts,
   * so opening the lab can never quietly repaint the app.
   */
  useEffect(() => {
    if (!original.current) {
      original.current = { theme: settings.theme, fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion }
    }
    applyTheme((themePreview || settings.theme) as any, settings)
  }, [themePreview, settings])

  useEffect(() => () => {
    const o = original.current
    if (o) applyTheme(o.theme as any, { fontScale: o.fontScale, compact: o.compact, reduceMotion: o.reduceMotion })
  }, [])

  const entry = AGENT_UI.find((e) => e.id === selected) ?? AGENT_UI[0]
  const v = values[entry.id]

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return AGENT_UI
    return AGENT_UI.filter((e) => `${e.name} ${e.note} ${e.host} ${e.component}`.toLowerCase().includes(q))
  }, [query])

  const goto = () => {
    const find = () => document.querySelector(`[data-ui="${entry.ui}"]`) as HTMLElement | null
    const here = find()
    if (here) { flash(here); return }
    if (entry.route) navigateNow({ href: entry.route, push: (href) => navigate(href.replace(/^#/, '')) })
    let tries = 0
    const iv = setInterval(() => {
      tries += 1
      const el = find()
      if (el) { clearInterval(iv); flash(el) }
      else if (tries > 45) {
        clearInterval(iv)
        useUI.getState().toast(`${entry.name} is not on this screen`, entry.hint, 'info')
      }
    }, 100)
  }

  const setKnob = (id: string, value: string | number | boolean) =>
    setValues((s) => ({ ...s, [entry.id]: { ...s[entry.id], [id]: value } }))

  const frameWidth = WIDTHS.find((w) => w.id === width)?.w ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Wand2 size={16} strokeWidth={1.6} className="mt-0.5" style={{ color: 'var(--primary)' }} />
        <div>
          <h3 className="text-[14px] font-semibold">UI lab</h3>
          <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
            Preview the interface this repository builds, at any width and theme, and jump to where it
            actually lives. Vendored components are out of scope here — they have their own upstream.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[236px_1fr]">
        {/* the list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Search size={13} style={{ color: 'var(--text-3)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter the interface"
              className="bg-transparent outline-none text-[12px] w-full"
            />
          </div>
          {shown.map((e) => (
            <button
              key={e.id}
              onClick={() => { setSelected(e.id); push(`previewing ${e.name}`) }}
              className={clsx('w-full text-left p-2.5 rounded-[11px] transition-colors')}
              style={{
                background: e.id === entry.id ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--surface)',
                border: `1px solid ${e.id === entry.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
              }}>
              <div className="text-[12.5px] font-medium">{e.name}</div>
              <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{e.host}</div>
            </button>
          ))}
          {shown.length === 0 && <p className="text-[11.5px] px-1" style={{ color: 'var(--text-3)' }}>Nothing matches.</p>}
        </div>

        {/* the frame */}
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider mr-1" style={{ color: 'var(--text-3)' }}>
              <Ruler size={11} /> Width
            </span>
            {WIDTHS.map((w) => (
              <button key={w.id} onClick={() => setWidth(w.id)}
                className="px-2 py-1 rounded-full text-[11px]"
                style={{
                  background: width === w.id ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))' : 'var(--surface)',
                  border: `1px solid ${width === w.id ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--surface-border)'}`,
                  color: width === w.id ? 'var(--text)' : 'var(--text-3)',
                }}>
                {w.label}
              </button>
            ))}

            <span className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider ml-2 mr-1" style={{ color: 'var(--text-3)' }}>
              <Sun size={11} /> Theme
            </span>
            <ModernSelect
              value={themePreview}
              onChange={(e) => setThemePreview(e.target.value)}
              className="px-2 py-1 rounded-[8px] text-[11px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              <option value="">{`In use — ${THEMES.find((t) => t.id === settings.theme)?.name ?? settings.theme}`}</option>
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </ModernSelect>

            <button onClick={() => setGrid((g) => !g)} title="Grid"
              className="p-1.5 rounded-full"
              style={{ background: grid ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))' : 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
              <Eye size={12} />
            </button>
            <button onClick={() => { setRemount((n) => n + 1); push(`${entry.name} remounted`) }} title="Remount"
              className="p-1.5 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
              <RefreshCw size={12} />
            </button>
            {themePreview && (
              <button onClick={() => setThemePreview('')} className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                <RotateCcw size={11} /> Restore my theme
              </button>
            )}
            <button onClick={goto}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px]"
              style={{ background: 'color-mix(in srgb, var(--primary) 14%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 38%, transparent)', color: 'var(--text)' }}>
              <Crosshair size={12} /> Show me in the app
            </button>
          </div>

          <div
            className={clsx('rounded-[14px] overflow-hidden transition-[max-width] duration-300', grid && 're-ui-grid')}
            style={{
              maxWidth: frameWidth ? `${frameWidth}px` : '100%',
              background: 'var(--bg)',
              border: '1px solid var(--surface-border)',
            }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${entry.id}-${remount}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="min-h-[300px] flex items-center justify-center">
                {entry.render(v, { log: push })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* knobs */}
          {(entry.knobs?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-3 py-2.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {entry.knobs!.map((k) => (
                <label key={k.id} className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                  <span>{k.label}</span>
                  {k.type === 'toggle' && (
                    <input type="checkbox" checked={!!v[k.id]} onChange={(e) => setKnob(k.id, e.target.checked)} />
                  )}
                  {k.type === 'select' && (
                    <ModernSelect value={String(v[k.id])} onChange={(e) => setKnob(k.id, e.target.value)}
                      className="px-2 py-1 rounded-[8px] text-[11px] outline-none"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                      {k.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </ModernSelect>
                  )}
                  {k.type === 'range' && (
                    <>
                      <input type="range" min={k.min} max={k.max} step={k.step} value={Number(v[k.id])}
                        onChange={(e) => setKnob(k.id, Number(e.target.value))} />
                      <span className="font-mono w-[46px]">{String(v[k.id])}</span>
                    </>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono px-1" style={{ color: 'var(--text-3)' }}>
            <span className="flex items-center gap-1"><MousePointerClick size={11} /> {entry.component}</span>
            <span>·</span>
            <span>{entry.note}</span>
          </div>

          {/* event log: what the previewed component actually did */}
          <div className="rounded-[12px] p-2.5 max-h-[132px] overflow-y-auto" style={{ background: 'var(--elevated)' }}>
            {log.length === 0
              ? <p className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>Interact with the preview — what it emits lands here. Nothing is sent.</p>
              : log.map((l, i) => (
                <div key={i} className="text-[11px] font-mono" style={{ color: i === 0 ? 'var(--text-2)' : 'var(--text-3)' }}>{l}</div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Exported for the render-check guard: the vendor folders the lab must not point into. */
export const UI_LAB_EXCLUDES = ['aceternity', 'smoothui', 'skiper', 'watermelon', 'heroui']
