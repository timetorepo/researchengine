// React Bits — Wake Slider (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/wake-slider: a slider that stays quiet until you
// touch it, then shows its value and its track. The upstream source is not
// reachable from this environment, so this is a reimplementation of the behaviour
// and it says so. License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useId, useRef, useState } from 'react'

export interface WakeSliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  label?: string
  /** Formats the value in the bubble. */
  format?: (v: number) => string
  className?: string
}

/**
 * A slider that wakes on contact.
 *
 * The native input is still there, invisible, on top: keyboard, screen reader
 * and touch all work exactly as they would on a plain range input. Everything
 * this adds is visual, which is the only honest way to build a custom slider —
 * one that replaces the input with a div is a control nobody can operate.
 */
export function WakeSlider({
  value, min = 0, max = 100, step = 1, onChange, label, format, className,
}: WakeSliderProps) {
  const [awake, setAwake] = useState(false)
  const id = useId()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const pct = ((value - min) / (max - min)) * 100
  const shown = format ? format(value) : String(value)

  const wake = useCallback(() => setAwake(true), [])
  const sleep = useCallback(() => setAwake(false), [])

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`} onPointerEnter={wake} onPointerLeave={sleep}>
      {label && (
        <label htmlFor={id} className="text-[11.5px] shrink-0" style={{ color: awake ? 'var(--text-2)' : 'var(--text-3)' }}>
          {label}
        </label>
      )}
      <div ref={trackRef} className="relative flex-1 h-6 flex items-center" style={{ minWidth: 80 }}>
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: 'var(--elevated)' }} />
        <div className="absolute left-0 h-1 rounded-full" style={{
          width: `${pct}%`,
          background: awake ? 'var(--primary)' : 'var(--text-3)',
          transition: 'background 160ms ease',
        }} />
        <div className="absolute w-3.5 h-3.5 rounded-full" style={{
          left: `calc(${pct}% - 7px)`,
          background: 'var(--surface)',
          border: `2px solid ${awake ? 'var(--primary)' : 'var(--text-3)'}`,
          transform: awake ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 160ms ease, border-color 160ms ease',
        }} />
        <input id={id} type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={wake} onBlur={sleep}
          aria-label={label}
          aria-valuetext={shown}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-[11px] tabular-nums shrink-0 transition-opacity"
        style={{ color: 'var(--text-2)', opacity: awake ? 1 : 0.45, minWidth: 34, textAlign: 'right' }}>
        {shown}
      </span>
    </div>
  )
}

export default WakeSlider
