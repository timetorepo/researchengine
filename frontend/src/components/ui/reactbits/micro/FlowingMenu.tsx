// React Bits — Flowing Menu (Component)
// Written here against the documented behaviour of
// https://reactbits.dev/components/flowing-menu: a menu whose hover background
// flows to the active item. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour, not a vendored
// copy, and it says so. License of the upstream design: MIT + Commons Clause.
import React, { useState } from 'react'

export interface FlowingMenuItem {
  id: string
  label: string
  onClick?: () => void
}

export interface FlowingMenuProps {
  items: FlowingMenuItem[]
  className?: string
}

/**
 * A vertical menu where the highlight slides to the hovered item.
 *
 * The moving highlight is one absolutely-positioned element translated to the
 * active row, so the transition is a single transform rather than N border
 * toggles. Keyboard focus drives the same highlight, so the visual works without
 * a pointer.
 */
export function FlowingMenu({ items, className }: FlowingMenuProps) {
  const [active, setActive] = useState<number>(-1)
  const ref = React.useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} role="menu" className={`relative rounded-xl p-1 ${className ?? ''}`} style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
      <div aria-hidden
        className="absolute left-1 right-1 rounded-lg pointer-events-none"
        style={{
          top: 4 + active * 38, height: 30,
          background: 'color-mix(in srgb, var(--primary) 16%, transparent)',
          transform: active < 0 ? 'scaleY(0)' : 'scaleY(1)',
          opacity: active < 0 ? 0 : 1,
          transition: 'transform 220ms cubic-bezier(.34,1.56,.64,1), opacity 160ms, top 220ms',
        }} />
      {items.map((it, i) => (
        <button key={it.id} role="menuitem" type="button"
          onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}
          onFocus={() => setActive(i)} onBlur={() => setActive(-1)}
          onClick={it.onClick}
          className="relative z-10 w-full text-left px-3 h-[30px] rounded-lg text-[12.5px] font-medium flex items-center transition-colors"
          style={{ color: active === i ? 'var(--primary)' : 'var(--text-2)' }}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

export default FlowingMenu
