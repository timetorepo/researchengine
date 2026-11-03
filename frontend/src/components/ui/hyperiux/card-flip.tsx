// Card flip: a card that turns over in 3D to show its back, on click, Enter or hover.
// Inspired by Hyperiux Vault's "Gsap Card Flip" on 21st.dev
// (https://21st.dev/@hyperiux/components/gsap-card-flip). Rebuilt here with CSS 3D
// transforms (no GSAP dependency); it is not a copy of the upstream source.
import { useState, type ReactNode } from 'react'

export function CardFlip({ front, back, className }: { front: ReactNode; back: ReactNode; className?: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) } }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      className={className}
      style={{ perspective: 1200, cursor: 'pointer', minHeight: 160 }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 160, transformStyle: 'preserve-3d', transition: 'transform 0.7s cubic-bezier(.2,.7,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        <div className="rounded-[16px] p-5" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>{front}</div>
        <div className="rounded-[16px] p-5" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', border: '1px solid var(--surface-border)' }}>{back}</div>
      </div>
    </div>
  )
}
