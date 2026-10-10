// React Bits — Swipe Row (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/swipe-row: a list row you swipe to reveal
// actions, including a "Send to AI" action. The upstream source is not reachable
// from this environment, so this is a reimplementation of the behaviour, not a
// vendored copy, and it says so. License of the upstream design: MIT + Commons
// Clause.
import React, { useCallback, useRef, useState } from 'react'

export interface SwipeAction {
  id: string
  label: string
  onClick: () => void
  /** 'ai' renders the primary highlighted action. */
  kind?: 'ai' | 'default' | 'danger'
}

export interface SwipeRowProps {
  children: React.ReactNode
  actions: SwipeAction[]
  className?: string
}

/**
 * A row with swipe-to-reveal actions.
 *
 * Horizontal drag reveals the actions behind it; the first is the AI action and
 * is highlighted, because the whole point of the component is "send this to the
 * AI." It only reacts to horizontal motion (touchAction is pan-x), so the list
 * still scrolls vertically — a row that captures vertical swipes is a list you
 * cannot scroll.
 */
export function SwipeRow({ children, actions, className }: SwipeRowProps) {
  const [x, setX] = useState(0)
  const dragging = useRef(false)
  const max = -(actions.length * 64)

  const onDown = (e: React.PointerEvent) => { dragging.current = true; ;(e.target as Element).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    // horizontal only
    setX((prev) => Math.max(max, Math.min(0, prev + e.movementX)))
  }
  const onUp = () => { dragging.current = false; setX(x < max / 2 ? max : 0) }

  const color = (k?: string) => k === 'ai' ? 'var(--primary)' : k === 'danger' ? 'var(--danger)' : 'var(--text-3)'

  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? ''}`} style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-y-0 right-0 flex" style={{ transform: `translateX(${Math.min(0, x + 64)}px)` }}>
        {actions.map((a) => (
          <button key={a.id} type="button" onClick={() => { a.onClick(); setX(0) }}
            className="w-16 grid place-items-center text-[10px] font-medium text-white"
            style={{ background: color(a.kind) }}>
            {a.label}
          </button>
        ))}
      </div>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="relative"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging.current ? undefined : 'transform 220ms',
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          touchAction: 'pan-y',
        }}>
        {children}
      </div>
    </div>
  )
}

export default SwipeRow
