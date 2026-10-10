// React Bits — Slide Commit (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/slide-commit: a slide-to-confirm control. The
// upstream source is not reachable from this environment, so this is a
// reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useRef, useState } from 'react'

export interface SlideCommitProps {
  onCommit: () => void
  label?: string
  confirmLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Slide to confirm.
 *
 * The handle must reach the end under a deliberate drag; a click that does not
 * travel does nothing, so an accidental tap cannot commit something important.
 * Keyboard users get Space/Enter on the handle as a deliberate confirm.
 */
export function SlideCommit({
  onCommit, label = 'Slide to commit', confirmLabel = 'Done', disabled, className,
}: SlideCommitProps) {
  const [x, setX] = useState(0)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const width = ref.current?.getBoundingClientRect().width ?? 240
  const travel = Math.max(0, width - 44)
  const end = travel - 6

  const onDown = (e: React.PointerEvent) => {
    if (disabled || done) return
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setX(Math.max(0, Math.min(travel, x + e.movementX)))
  }
  const onUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (x >= end) { setDone(true); onCommit() }
    else setX(0)
  }

  return (
    <div
      ref={ref}
      className={`relative h-11 rounded-full overflow-hidden select-none ${className ?? ''}`}
      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', opacity: disabled ? 0.5 : 1 }}>
      <div
        aria-hidden
        className="absolute inset-y-0 left-0"
        style={{ width: 44 + x, background: done ? 'var(--success)' : 'var(--primary)', transition: dragging.current ? undefined : 'width 200ms' }} />
      <div className="absolute inset-0 flex items-center justify-center text-[12.5px] font-medium pointer-events-none"
        style={{ color: done ? '#fff' : 'var(--text-3)' }}>
        {done ? confirmLabel : label}
      </div>
      <button
        type="button"
        disabled={disabled || done}
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !done) { setDone(true); onCommit() } }}
        className="absolute top-1 bottom-1 left-1 w-9 rounded-full grid place-items-center cursor-grab active:cursor-grabbing disabled:cursor-default"
        style={{
          background: '#fff',
          transform: `translateX(${x}px)`,
          left: 4,
          transition: dragging.current ? undefined : 'transform 200ms',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}>
        {done ? <Check size={16} color="var(--success)" /> : <ChevronRight size={16} color="#222" />}
      </button>
    </div>
  )
}

import { Check, ChevronRight } from 'lucide-react'

export default SlideCommit
