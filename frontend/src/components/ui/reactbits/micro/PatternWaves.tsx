// React Bits — Pattern Waves (Background)
// Written here against the documented behaviour of
// https://reactbits.dev/backgrounds/pattern-waves: layered sine waves drifting
// behind content. The upstream source is not reachable from this environment, so
// this is a reimplementation of the behaviour, not a vendored copy, and it says
// so. License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface PatternWavesProps {
  className?: string
  /** 0..1 strength; lower is subtler. */
  strength?: number
  color?: string
}

/**
 * A drifting wave field, meant to sit behind a panel.
 *
 * It is pure SVG with two slow-translating layers, so it never paints a canvas
 * per frame and never needs JS once mounted. Reduced motion is honoured by the
 * keyframe definition, so the field holds still when the user asked for that.
 */
export function PatternWaves({ className, strength = 0.5, color = 'var(--primary)' }: PatternWavesProps) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`} style={{ opacity: strength }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pw-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g style={{ animation: 'pw-drift 16s ease-in-out infinite' }}>
          <path d="M0,300 C200,240 400,360 600,300 C800,240 1000,360 1200,300 L1200,600 L0,600 Z" fill="url(#pw-a)" />
        </g>
        <g style={{ animation: 'pw-drift 22s ease-in-out infinite reverse' }}>
          <path d="M0,360 C220,300 420,420 620,360 C820,300 1020,420 1200,360 L1200,600 L0,600 Z" fill="url(#pw-a)" opacity="0.7" />
        </g>
      </svg>
    </div>
  )
}

export default PatternWaves
