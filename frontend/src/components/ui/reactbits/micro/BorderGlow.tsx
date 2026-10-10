// React Bits — Border Glow
// Written here against the documented behaviour of
// https://reactbits.dev/c/animated/border-glow: a card whose border picks up
// light where the pointer is. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

export interface BorderGlowProps {
  children: ReactNode
  /** Glow colour. Defaults to the theme primary. */
  color?: string
  /** How far the glow reaches, in pixels. */
  size?: number
  /** Border width in pixels. */
  border?: number
  radius?: number
  className?: string
  style?: CSSProperties
  as?: 'div' | 'button' | 'li'
  onClick?: () => void
}

/**
 * The glow follows the pointer along the border.
 *
 * It is one pointermove listener that writes two CSS variables, not a state
 * update, so it costs nothing per frame and never re-renders the card. That is
 * the whole difference between a glow you can have on a list of twenty and one
 * you can have on one.
 */
export function BorderGlow({
  children, color = 'var(--primary)', size = 180, border = 1, radius = 16,
  className, style, as = 'div', onClick,
}: BorderGlowProps) {
  const ref = useRef<HTMLElement | null>(null)

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--glow-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--glow-y', `${e.clientY - r.top}px`)
  }, [])

  const Tag = as as any
  return (
    <Tag
      ref={ref as any}
      onPointerMove={onMove}
      onClick={onClick}
      className={`border-glow ${className ?? ''}`}
      style={{
        position: 'relative',
        borderRadius: radius,
        border: `${border}px solid var(--surface-border)`,
        // The two gradients are the trick: a mask that only shows the border,
        // and a radial light positioned at the pointer. Moving the pointer
        // moves the variables; the browser does the rest.
        ['--glow-x' as any]: '-999px',
        ['--glow-y' as any]: '-999px',
        ['--glow-color' as any]: color,
        ['--glow-size' as any]: `${size}px`,
        ...style,
      }}>
      {children}
    </Tag>
  )
}

export default BorderGlow
