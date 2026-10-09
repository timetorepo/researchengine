import React, { useEffect, useMemo, useRef, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { useReducedMotion } from 'motion/react'
import { clsx } from 'clsx'

/**
 * Animated numbers — reimplemented from Skiper UI's "Animated number"
 * (skiper37), which is built on Number Flow.
 *
 * Why the timer that used one of these used to stutter: a countdown that
 * recomputes "seconds left" from `Math.round((endsAt - now) / 1000)` on a
 * 500 ms interval drifts across the second boundary. Every tick lands a little
 * early or a little late, the displayed second sometimes counts twice, and the
 * digit animation restarts mid-flight — the "not smooth and sometimes bugs"
 * report.
 *
 * `useSteadyCountdown` removes the drift instead of hiding it: the timer is
 * re-anchored to the *next* wall-clock second and scheduled with `setTimeout`,
 * and the value is always derived from the anchor (`endsAt`), never
 * accumulated. So the digits change exactly once per second, on the second.
 */

/**
 * Milliseconds until the displayed second next changes.
 *
 * The countdown shows `ceil(remaining)`, so the moment to wake up is when the
 * remaining milliseconds cross the next lower whole second — that is the
 * *fraction* of the current second that is left, not the complement of it. The
 * complement is what this used to compute, and with a negative modulo it
 * regularly scheduled the next tick a full second late: a timer that skips a
 * number every other tick, which is exactly the "it only changes every two
 * seconds" report.
 */
export function msToNextSecond(endsAt: number, now = Date.now()): number {
  const remaining = Math.max(0, endsAt - now)
  const frac = remaining % 1000
  return frac === 0 ? 1000 : frac
}

/** Seconds remaining, recomputed from `endsAt` — never counted down locally. */
export function useSteadyCountdown(endsAt: number | null, running: boolean, fallback = 0): number {
  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : fallback)

  useEffect(() => {
    if (!endsAt) {
      setRemaining(fallback)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      const left = Math.max(0, (endsAt - Date.now()) / 1000)
      const shown = Math.ceil(left)
      setRemaining((prev) => (prev === shown ? prev : shown))
      if (left <= 0) return
      // Re-anchor to the next second boundary each time, so a tab that was
      // throttled, a slow frame or a GC pause cannot accumulate drift.
      timer = setTimeout(tick, msToNextSecond(endsAt) + 12)
    }

    tick()
    // Paused timers still show the truth after a tab switch.
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt, running, fallback])

  return remaining
}

export interface AnimatedNumberProps {
  value: number
  /** Zero-pad each integer to this many digits (e.g. → "05"). */
  minIntegerDigits?: number
  className?: string
  /** Tone for the digits; defaults to inheriting the surrounding colour. */
  style?: React.CSSProperties
  /** Animate on mount (a short count-up), like the reference component. */
  countUp?: boolean
  duration?: number
  ariaLabel?: string
}

/**
 * The digits themselves. Number Flow owns the per-digit transitions, which is
 * what makes a change of value *roll* instead of blinking — and it keeps the
 * width stable, so a countdown never nudges its neighbours.
 */
export function AnimatedNumber({
  value, minIntegerDigits = 0, className, style, countUp = false, duration = 0.6, ariaLabel,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(countUp ? 0 : value)
  const mounted = useRef(false)

  useEffect(() => {
    if (!countUp || mounted.current) return
    mounted.current = true
    // One settle-in animation, then the real value takes over.
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(value * eased))
      if (p < 1) raf = requestAnimationFrame(step)
      else setShown(value)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [countUp, value, duration])

  useEffect(() => {
    if (!countUp) setShown(value)
  }, [value, countUp])

  return (
    <NumberFlow
      value={reduce ? value : shown}
      // Number Flow 0.6 takes formatting via `format` (Intl.NumberFormat opts).
      format={minIntegerDigits ? { minimumIntegerDigits: minIntegerDigits, useGrouping: false } : { useGrouping: false }}
      className={clsx('re-number-flow', className)}
      style={style}
      aria-label={ariaLabel}
      // Number Flow writes its own aria-live; a countdown announcing every
      // second would be unusable, so the label is static and the digits quiet.
      aria-hidden={ariaLabel ? undefined : true}
      transformTiming={{ duration: reduce ? 0 : 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      spinTiming={{ duration: reduce ? 0 : 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
    />
  )
}

/** "12:05" — minutes:seconds for a countdown, with the seconds padded. */
export function useClockParts(totalSeconds: number): { text: string; seconds: number } {
  return useMemo(() => {
    const s = Math.max(0, Math.floor(totalSeconds))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return { text: `${mm}:${String(ss).padStart(2, '0')}`, seconds: ss }
  }, [totalSeconds])
}
