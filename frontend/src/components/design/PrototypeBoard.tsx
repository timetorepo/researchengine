/**
 * The prototype check, as one screen.
 *
 * Directive four says the agent must test responsiveness and every
 * microinteraction before calling anything done — so this is the surface that
 * makes it possible to do it honestly: the running preview in a phone, a
 * tablet, a laptop and a TV at once, all pointed at the same URL. Reload is one
 * button for all four, because the point of checking them together is catching
 * the size where the thing breaks, not admiring four screenshots.
 *
 * The frames keep real CSS pixels and are scaled with a transform, so what is
 * inside them sees the breakpoints it would see on the device. The checklist is
 * deliberately the things that silently do not fire: hover, press, focus,
 * enter/exit motion, and the reduced-motion path.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { RefreshCw, Copy, Check, Smartphone, Tablet, Monitor, Tv, ExternalLink } from 'lucide-react'
import { DEVICES, type DevicePreset } from './DevicePreview'

const CHECKS = [
  ['hover', 'Every hover state fires and does not shift layout'],
  ['press', 'Press and active states land on the same pixel as hover'],
  ['focus', 'Keyboard focus is visible on every control, in order'],
  ['enter', 'Entrances animate once, from the right direction, and finish'],
  ['exit', 'Exits are faster than entrances and never block input'],
  ['reduced', 'prefers-reduced-motion keeps the meaning and drops the movement'],
  ['scroll', 'Scroll-linked and sticky elements stay in sync at every size'],
  ['text', 'No text overflows, truncates badly or wraps under an icon'],
] as const

/** The four the user asked for: one of each family, at a size that matters. */
const FRAME_IDS = ['phone', 'tablet', 'laptop', 'tv']

export function PrototypeBoard({ url, onCopyReport }: { url: string; onCopyReport?: (report: string) => void }) {
  const [nonce, setNonce] = useState(0)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  // Ticking a box is the signal the prototype stage has been worked through. The
  // Full Throttle panel needs to know, and it should not have to reach into this
  // component's state to find out.
  const tick = (id: string) => {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] }
      if (next[id]) window.dispatchEvent(new Event('re:prototype-checked'))
      return next
    })
  }
  const [copied, setCopied] = useState(false)
  const frames = useRef<Record<string, HTMLIFrameElement | null>>({})

  const presets = useMemo(
    () => FRAME_IDS.map((id) => DEVICES.find((d) => d.id === id)).filter(Boolean) as DevicePreset[],
    [],
  )

  const reloadAll = useCallback(() => setNonce((n) => n + 1), [])

  const report = useMemo(() => {
    const lines = [
      'Prototype check',
      `URL: ${url || '(no preview running)'}`,
      '',
      'Sizes checked:',
      ...presets.map((p) => `- ${p.label} — ${p.w}×${p.h} @${p.dpr}x`),
      '',
      'Microinteractions:',
      ...CHECKS.map(([id, label]) => `${checked[id] ? '[x]' : '[ ]'} ${label}`),
      '',
      `Unchecked: ${CHECKS.filter(([id]) => !checked[id]).map(([, l]) => l).join('; ') || 'none'}`,
    ]
    return lines.join('\n')
  }, [url, presets, checked])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
      onCopyReport?.(report)
    } catch { /* clipboard blocked; the textarea below still holds it */ }
  }

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3" data-prototype-board>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Prototype check</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          {url ? 'the running preview, in four devices at once' : 'start the preview to fill these frames'}
        </span>
        <button onClick={reloadAll} className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11.5px]"
          style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
          <RefreshCw size={11} /> Reload all four
        </button>
        <button onClick={() => void copy()} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11.5px]"
          style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />} Copy the report
        </button>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {presets.map((p) => (
          <Frame key={p.id} device={p} url={url} nonce={nonce}
            register={(el) => { frames.current[p.id] = el }} />
        ))}
      </div>

      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          Microinteractions — tick what you actually saw
        </span>
        {CHECKS.map(([id, label]) => (
          <label key={id} className="flex items-start gap-2 text-[11.5px] cursor-pointer" style={{ color: 'var(--ide-dim, var(--text-2))' }}>
            <input type="checkbox" checked={!!checked[id]} onChange={() => tick(id)}
              className="mt-[3px]" data-prototype-check={id} />
            <span>{label}</span>
          </label>
        ))}
        <pre className="mt-1 p-2 rounded-[9px] text-[10.5px] whitespace-pre-wrap"
          style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-faint, var(--text-3))' }}>{report}</pre>
      </section>
    </div>
  )
}

function Frame({ device, url, nonce, register }: { device: DevicePreset; url: string; nonce: number; register: (el: HTMLIFrameElement | null) => void }) {
  const Icon = device.family === 'phone' ? Smartphone : device.family === 'tablet' ? Tablet : device.family === 'tv' ? Tv : Monitor
  // 320 px of cell width is the floor; the frame itself keeps its real size.
  const cell = 320
  const scale = Math.min(1, cell / device.w)
  return (
    <div className="rounded-[10px] p-2 flex flex-col gap-1.5" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
      <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
        <Icon size={11} />
        <span style={{ color: 'var(--ide-dim, var(--text-2))' }}>{device.label}</span>
        <span className="ml-auto font-mono">{device.w}×{device.h}</span>
      </div>
      <div style={{ height: Math.min(260, device.h * scale), overflow: 'hidden', position: 'relative' }}>
        {url ? (
          <div style={{ width: device.w * scale, height: device.h * scale }}>
            <iframe
              key={`${device.id}-${nonce}`}
              ref={register}
              src={url}
              title={`${device.label} preview`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              style={{
                width: device.w, height: device.h, border: 0, background: '#fff',
                transform: `scale(${scale})`, transformOrigin: 'top left', borderRadius: 6,
              }}
            />
          </div>
        ) : (
          <div className="h-full grid place-items-center text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            no preview yet
          </div>
        )}
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--ide-accent, var(--primary))' }}>
          open alone <ExternalLink size={9} />
        </a>
      )}
    </div>
  )
}
