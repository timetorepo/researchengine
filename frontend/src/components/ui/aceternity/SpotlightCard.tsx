import React, { useRef, useState } from 'react'
import { clsx } from 'clsx'

/** Aceternity-style spotlight card — a soft radial light follows the cursor. */
export function SpotlightCard({
  children, className = '', spotlightColor = 'color-mix(in srgb, var(--primary) 14%, transparent)', onClick,
}: {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
  onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)

  /* The spotlight position travels through CSS variables on the element
     itself instead of component state: a mousemove repaints one gradient,
     never the React tree. That is the difference between a card that tracks
     the cursor at 120 fps and a home screen that drops frames. */
  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--spot-x', `${Math.round(e.clientX - r.left)}px`)
        el.style.setProperty('--spot-y', `${Math.round(e.clientY - r.top)}px`)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ '--spot-x': '-400px', '--spot-y': '-400px' } as React.CSSProperties}
      className={clsx('relative overflow-hidden transition-transform duration-200', onClick && 'cursor-pointer', className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(320px circle at var(--spot-x, -400px) var(--spot-y, -400px), ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  )
}
