import React from 'react'

export function ThinkingOrb() {
  return (
    <span className="relative inline-flex items-center justify-center" aria-hidden>
      <span className="orb" />
      <span className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, transparent 55%, var(--bg) 100%)' }} />
    </span>
  )
}
