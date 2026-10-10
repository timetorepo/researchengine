// React Bits — Comet Dial (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/comet-dial: a circular dial you drag to pick a
// value. The upstream source is not reachable from this environment, so this is
// a reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useRef } from 'react'

export interface CometDialProps {
  value: number
  onChange: (v: number) => void
  /** 0..1 spread of the arc; default a 270-degree dial. */
  sweep?: number
  size?: number
  label?: string
  format?: (v: number) => string
  disabled?: boolean
}

const START = -135 // degrees, top-left
const SWEEP = 270

export function CometDial({
  value, onChange, size = 84, label = 'Value', format, disabled,
}: CometDialProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const clamp = (v: number) => Math.max(0, Math.min(100, v))

  const fromEvent = useCallback((clientX: number, clientY: number, cur: number) => {
    const el = ref.current
    if (!el) return cur
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const ang = Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI
    // angle measured from +x axis; rotate so the gap sits at the bottom.
    let a = ang + 90
    if (a < -180) a += 360
    if (a > 180) a -= 360
    // map START..START+SWEEP onto 0..100
    const norm = (a - START) / SWEEP
    return clamp(Math.round(norm * 100))
  }, [])

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    onChange(fromEvent(e.clientX, e.clientY, value))
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    onChange(fromEvent(e.clientX, e.clientY, value))
  }
  const onUp = () => { dragging.current = false }
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange(clamp(value + 5)); e.preventDefault() }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange(clamp(value - 5)); e.preventDefault() }
  }

  const angle = START + (value / 100) * SWEEP
  const r = size / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const rad = (angle - 90) * Math.PI / 180
  const px = cx + r * Math.cos(rad)
  const py = cy + r * Math.sin(rad)

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onKeyDown={onKey}
      className="relative inline-flex items-center justify-center select-none touch-none"
      style={{ width: size, height: size, cursor: disabled ? 'default' : 'grab', outline: 'none' }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--elevated)" strokeWidth={6}
          strokeDasharray={`${(SWEEP / 360) * 2 * Math.PI * r} ${(2 * Math.PI * r)}`}
          strokeDashoffset={(2 * Math.PI * r) * (-(90 + START) / 360)}
          transform={`rotate(${START + 90} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--primary)" strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * (SWEEP / 360) * 2 * Math.PI * r} ${(2 * Math.PI * r)}`}
          transform={`rotate(${START + 90} ${cx} ${cy})`} />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" />
        <circle cx={px} cy={py} r={5} fill="var(--primary)" />
      </svg>
      <span className="absolute text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
        {format ? format(value) : value}
      </span>
    </div>
  )
}

export default CometDial
