// React Bits — Bell Toggle (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/bell-toggle: a bell that rings when you turn it
// on. The upstream source is not reachable from this environment, so this is a
// reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useEffect, useRef, useState } from 'react'

export interface BellToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  /** Number of unread items, shown on the bell. */
  count?: number
  label?: string
  className?: string
}

/**
 * A bell that swings when it switches on.
 *
 * The swing is one short keyframe on the whole bell rather than an animated
 * transform driven by state, so it fires on the click and then stops. A bell that
 * keeps ringing is a bell you stop looking at.
 */
export function BellToggle({ on, onChange, count = 0, label = 'Notifications', className }: BellToggleProps) {
  const [ringing, setRinging] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const toggle = useCallback(() => {
    const next = !on
    onChange(next)
    if (next) {
      setRinging(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setRinging(false), 620)
    }
  }, [on, onChange])

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative inline-flex items-center justify-center rounded-full transition-colors ${className ?? ''}`}
      style={{
        width: 30, height: 30,
        background: on ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
        color: on ? 'var(--primary)' : 'var(--text-3)',
      }}>
      <span
        className="inline-flex"
        style={{
          transformOrigin: '50% 12%',
          animation: ringing ? 'bell-swing 620ms ease-in-out' : undefined,
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-semibold flex items-center justify-center tabular-nums"
          style={{ background: 'var(--danger)', color: '#fff' }}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

export default BellToggle
