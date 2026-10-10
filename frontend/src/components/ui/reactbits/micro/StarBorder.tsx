// React Bits — Star Border (Animation)
// Written here against the documented behaviour of
// https://reactbits.dev/c/animations/star-border: a border traced by travelling
// stars. The upstream source is not reachable from this environment, so this is
// a reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface StarBorderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

/**
 * A button whose border is travelled by little stars.
 *
 * The stars are two dashed masks offset and rotated, so the border reads as
 * moving sparkles rather than a static outline. It is a button, so it keeps
 * focus and keyboard behaviour — a decorative border must not cost you the
 * control underneath.
 */
export function StarBorder({ children, className, ...rest }: StarBorderProps) {
  return (
    <button
      {...rest}
      className={`relative inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium overflow-hidden ${className ?? ''}`}
      style={{ background: 'var(--primary)', color: '#fff', ...rest.style }}>
      <span aria-hidden className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 'inherit',
          background: 'repeating-linear-gradient(90deg, transparent 0 14px, color-mix(in srgb, #fff 70%, transparent) 14px 16px)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: 1.5,
          animation: 'star-border-move 3s linear infinite',
        }} />
      <span className="relative z-10">{children}</span>
    </button>
  )
}

export default StarBorder
