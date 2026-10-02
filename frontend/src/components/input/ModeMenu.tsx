import React, { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { clsx } from 'clsx'

export interface ModeOption {
  id: string
  label: string
  desc: string
  /** Tailwind/lucide-renderable icon component. */
  icon: React.ComponentType<{ size?: string | number; strokeWidth?: string | number }>
  active: boolean
  /** Accent for the active row — Math is amber in this app, everything else primary. */
  tone?: 'primary' | 'warning'
  toggle: () => void
  title?: string
}

/**
 * The composer's mode picker.
 *
 * It is a *popover*, not a dropdown that hopes: it closes on the row you press
 * (pointerdown, before the action, so a re-render can never keep it on screen),
 * on Escape, on the backdrop, on scroll and on resize. No exit animation is
 * involved in the close path — a menu that waits for an animation to finish is
 * a menu that can be left on screen, which is exactly what used to happen.
 */
export function ModeMenu({
  pills, anchor, onClose,
}: {
  pills: ModeOption[]
  /** Trigger element: the panel anchors above it and clamps to the viewport. */
  anchor: HTMLElement | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null)

  useEffect(() => {
    const place = () => {
      const r = anchor?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(268, window.innerWidth - 24)
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12))
      const bottom = Math.max(12, window.innerHeight - r.top + 8)
      setPos({ left, bottom, width })
    }
    place()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [anchor, onClose])

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} aria-hidden />
      <div
        ref={ref}
        role="menu"
        aria-label="Choose mode"
        data-mode-menu=""
        data-ui="mode-menu"
        onPointerDown={(e) => e.stopPropagation()}
        className="re-mode-menu fixed z-[80] max-h-[min(70vh,420px)] overflow-y-auto rounded-[16px] p-1.5"
        style={{
          left: pos?.left ?? -9999,
          bottom: pos?.bottom ?? -9999,
          width: pos?.width ?? 268,
          background: 'var(--elevated)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 22px 50px -18px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.02) inset',
        }}
      >
        <div className="px-2.5 pt-1.5 pb-2 text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--text-3)' }}>
          Answer mode
        </div>
        {pills.map((p) => {
          const tone = p.tone === 'warning' ? 'var(--warning)' : 'var(--primary)'
          return (
            <button
              key={p.id}
              role="menuitemcheckbox"
              aria-checked={p.active}
              aria-label={p.label}
              // Close on press-down: the action happens either way, and the
              // menu is gone before any re-render can resurrect it.
              onPointerDown={() => { p.toggle(); onClose() }}
              onClick={(e) => { e.preventDefault(); onClose() }}
              title={p.title}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[11px] text-left transition-colors hover:bg-[var(--surface)]"
              style={{ background: p.active ? `color-mix(in srgb, ${tone} 10%, transparent)` : undefined }}
            >
              <span className="mt-[1px] shrink-0 grid place-items-center w-6 h-6 rounded-[8px]"
                style={{
                  background: p.active ? `color-mix(in srgb, ${tone} 16%, transparent)` : 'var(--surface)',
                  color: p.active ? tone : 'var(--text-2)',
                  border: '1px solid var(--surface-border)',
                }}>
                <p.icon size={13} strokeWidth={1.8} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-medium" style={{ color: p.active ? tone : 'var(--text)' }}>{p.label}</span>
                  {p.active && <Check size={12} strokeWidth={2.4} style={{ color: tone }} />}
                </span>
                <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-3)' }}>{p.desc}</span>
              </span>
            </button>
          )
        })}
        <div className="px-2.5 pt-2 pb-1 text-[10.5px] border-t mt-1" style={{ color: 'var(--text-3)', borderColor: 'var(--surface-border)' }}>
          Modes stack — Quality includes search, Math forces step-by-step.
        </div>
      </div>
    </>
  )
}

export const modeButtonClass = (open: boolean, anyActive: boolean) =>
  clsx(
    'flex items-center justify-center w-9 h-8 rounded-full transition-colors',
    open ? 'bg-[var(--elevated)]' : 'hover:bg-[var(--elevated)]',
  ) + (anyActive ? '' : '')
