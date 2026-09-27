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
  const [pos, setPos] = useState({ x: -400, y: -400 })
  const [hover, setHover] = useState(false)

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={clsx('relative overflow-hidden transition-transform duration-200', onClick && 'cursor-pointer', className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  )
}
