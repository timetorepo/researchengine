// dqnamo-style iridescent foil: a card with a rainbow sheen that follows the
// pointer. Purely decorative; content stays fully readable on top.
import { useRef, type ReactNode } from 'react'

export function IridescentFoil({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !ref.current) return
    ref.current.style.setProperty('--foil-x', `${((e.clientX - r.left) / r.width) * 100}%`)
    ref.current.style.setProperty('--foil-y', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div ref={ref} onPointerMove={move} className={`relative overflow-hidden rounded-[16px] ${className}`}
      style={{ '--foil-x': '50%', '--foil-y': '50%', border: '1px solid var(--surface-border)', background: 'var(--surface)' } as React.CSSProperties}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{ background: 'conic-gradient(from 0deg at var(--foil-x) var(--foil-y), #ff7ab6, #ffd27a, #7af5d2, #7ab8ff, #c59bff, #ff7ab6)', mixBlendMode: 'screen', transition: 'background 120ms linear' }} />
      <div className="relative">{children}</div>
    </div>
  )
}
