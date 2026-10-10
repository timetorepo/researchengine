// React Bits — Refine Frame (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/refine-frame: a frame shown while an image is
// being generated, with a refining shimmer. The upstream source is not reachable
// from this environment, so this is a reimplementation of the behaviour, not a
// vendored copy, and it says so. License of the upstream design: MIT + Commons
// Clause.
import React from 'react'

export interface RefineFrameProps {
  /** 0..1 progress through the generation. */
  progress?: number
  label?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * A placeholder frame for in-progress image generation.
 *
 * It is a frame with a corner-to-corner sweep, not a spinner, because the point
 * is "an image is forming here" rather than "the app is busy." When progress is
 * known, a thin bar tracks it; when it is not, the sweep just keeps moving.
 */
export function RefineFrame({ progress, label = 'Generating', className, style }: RefineFrameProps) {
  const known = typeof progress === 'number'
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className ?? ''}`}
      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', aspectRatio: '1 / 1', ...style }}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--primary) 18%, transparent) 50%, transparent 70%)',
          backgroundSize: '250% 250%',
          animation: 'refine-sweep 1.6s ease-in-out infinite',
        }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{label}</div>
        {known && (
          <div className="w-2/3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
            <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--primary)', transition: 'width 200ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default RefineFrame
