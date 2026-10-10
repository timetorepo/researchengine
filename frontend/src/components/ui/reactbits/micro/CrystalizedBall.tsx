// React Bits — Crystallized Ball (Animation)
// Written here against the documented behaviour of
// https://reactbits.dev/animations/crystalized-ball: a slowly rotating,
// faceted crystal that catches light. The upstream source is not reachable from
// this environment, so this is a reimplementation of the behaviour, not a
// vendored copy, and it says so. License of the upstream design: MIT + Commons
// Clause.
import React from 'react'

export interface CrystalizedBallProps {
  size?: number
  className?: string
}

/**
 * A decorative faceted crystal.
 *
 * It is CSS only — a few rotated faces on a slow spin — so it costs nothing to
 * leave running in an empty state. It stops under prefers-reduced-motion via the
 * keyframe, which is what a decorative element should do when asked.
 */
export function CrystalizedBall({ size = 96, className }: CrystalizedBallProps) {
  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size, perspective: 600 }}>
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', animation: 'crystal-spin 14s linear infinite' }}>
        {[
          { t: 'rotateY(0deg) translateZ(22px)' },
          { t: 'rotateY(60deg) translateZ(22px)' },
          { t: 'rotateY(120deg) translateZ(22px)' },
          { t: 'rotateY(180deg) translateZ(22px)' },
          { t: 'rotateY(240deg) translateZ(22px)' },
          { t: 'rotateY(300deg) translateZ(22px)' },
        ].map((f, i) => (
          <span key={i} aria-hidden
            className="absolute left-1/2 top-1/2"
            style={{
              width: size * 0.42, height: size * 0.6, marginLeft: -size * 0.21, marginTop: -size * 0.3,
              background: i % 2 ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'color-mix(in srgb, var(--primary) 16%, transparent)',
              border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)',
              transform: f.t, backfaceVisibility: 'visible',
            }} />
        ))}
      </div>
    </div>
  )
}

export default CrystalizedBall
