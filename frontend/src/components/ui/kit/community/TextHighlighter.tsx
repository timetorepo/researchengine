/**
 * Text highlighter: a marker stroke that draws behind a word. It runs when the
 * word scrolls into view (`trigger="scroll"`) or when the pointer rests on it
 * (`trigger="hover"`). Under reduced motion the mark is shown at once.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

export function TextHighlighter({ children, trigger = 'scroll', color = 'color-mix(in srgb, var(--primary) 34%, transparent)' }: { children: ReactNode; trigger?: 'scroll' | 'hover'; color?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (trigger !== 'scroll' || !ref.current) return
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setOn(true); io.disconnect() }
    }, { threshold: 0.6 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [trigger])
  const shown = reduce || on
  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => trigger === 'hover' && setOn(true)}
      onMouseLeave={() => trigger === 'hover' && setOn(false)}
    >
      <span
        aria-hidden
        className="absolute left-[-2px] right-[-2px] bottom-[0.08em] h-[0.55em] -z-0 rounded-[3px] origin-left transition-transform duration-700 ease-out"
        style={{ background: color, transform: shown ? 'scaleX(1)' : 'scaleX(0)' }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}
