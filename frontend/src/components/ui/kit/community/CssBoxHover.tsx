/**
 * A card whose box lifts on hover: a soft edge light follows the pointer and
 * a shadow deepens. Plain CSS, no motion library. It is inert under reduced motion.
 */
import { useRef, type ReactNode } from 'react'

export function CssBoxHover({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={`css-box-hover relative rounded-[14px] p-4 transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 ${className}`}
      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[14px] opacity-0 transition-opacity duration-300 group-hover:opacity-100 css-box-light" />
      <div className="relative">{children}</div>
      <style>{`
        .css-box-hover:hover { box-shadow: 0 10px 30px -12px rgba(0,0,0,.35); }
        .css-box-light { background: radial-gradient(180px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--text) 9%, transparent), transparent 70%); }
        .css-box-hover:hover .css-box-light { opacity: 1; }
      `}</style>
    </div>
  )
}
