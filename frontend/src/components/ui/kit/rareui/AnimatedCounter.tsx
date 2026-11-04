// RareUI · Animated counter — eases a number to its new value.
import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'

export function AnimatedCounter({ value, duration = 0.9, locale = undefined, className = '' }: {
  value: number; duration?: number; locale?: string; className?: string
}) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => { from.current = value },
    })
    return () => controls.stop()
  }, [value, duration])
  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString(locale)}</span>
}
