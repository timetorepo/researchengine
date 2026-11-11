import React, { useEffect, useRef, useState } from 'react'

/** ReactBits-style animated counter — eases from the previous value. */
export function AnimatedCounter({
  value, duration = 700, format = fmtNum, className = '',
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      const cur = from + (to - from) * eased
      setDisplay(cur)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span className={`tabular-nums ${className}`}>{format(Math.round(display))}</span>
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k'
  return String(n)
}
