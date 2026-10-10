// React Bits — Spotlight Card
// Written here against the documented behaviour of
// https://reactbits.dev/c/components/spotlight-card: a card that catches a
// spotlight where the pointer is. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

export interface SpotlightCardProps {
  children: ReactNode
  /** Spotlight colour. Defaults to the theme primary. */
  color?: string
  /** Spotlight radius in pixels. */
  size?: number
  /** Spotlight strength, 0 to 1. */
  strength?: number
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

/**
 * A card with a spotlight under the pointer.
 *
 * One pointermove handler writing two CSS variables — no state, no re-render,
 * no React work per frame. A list of twenty of these costs nothing.
 */
export function SpotlightCard({
  children, color = 'var(--primary)', size = 320, strength = 0.14,
  className, style, onClick,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - r.top}px`)
  }, [])

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onClick={onClick}
      className={`spotlight-card ${className ?? ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid var(--surface-border)',
        background: 'var(--surface)',
        ['--spot-x' as any]: '-999px',
        ['--spot-y' as any]: '-999px',
        ['--spot-color' as any]: color,
        ['--spot-size' as any]: `${size}px`,
        ['--spot-alpha' as any]: String(strength),
        ...style,
      }}>
      <div aria-hidden className="spotlight-card__glow" />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default SpotlightCard
