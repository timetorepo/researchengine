// React Bits — Infinite Spiral (Component)
// Written here against the documented behaviour of
// https://reactbits.dev/components/infinite-spiral: an endlessly drawing
// spiral. The upstream source is not reachable from this environment, so this is
// a reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface InfiniteSpiralProps {
  size?: number
  className?: string
  stroke?: string
}

/**
 * An endless spiral, drawn as one stroked path that rotates.
 *
 * It is a single SVG path on a slow rotation — no canvas, no JS per frame — so it
 * can live in an onboarding screen without costing battery. It holds still under
 * reduced motion.
 */
export function InfiniteSpiral({ size = 120, className, stroke = 'var(--primary)' }: InfiniteSpiralProps) {
  const turns = 4
  const pts: string[] = []
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 4
  for (let i = 0; i <= 240; i++) {
    const t = i / 240
    const ang = t * turns * 2 * Math.PI
    const r = t * maxR
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`)
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden
      style={{ animation: 'spiral-rotate 12s linear infinite' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  )
}

export default InfiniteSpiral
