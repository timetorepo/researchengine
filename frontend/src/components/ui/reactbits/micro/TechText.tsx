// React Bits — Tech Text
// Written here against the documented behaviour of
// https://reactbits.dev/c/text-animations/tech-text: a heading that assembles
// itself, character by character, the way a terminal prints. The upstream source
// is not reachable from this environment, so this is a reimplementation of the
// behaviour and it says so. License of the upstream design: MIT + Commons Clause.
import React, { useEffect, useMemo, useRef, useState } from 'react'

export interface TechTextProps {
  text: string
  /** Milliseconds per character. */
  speed?: number
  /** Delay before the first character. */
  delay?: number
  className?: string
  /** Render as this tag. */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  /** Start only once the element scrolls into view. */
  once?: boolean
}

/**
 * A heading that types itself in.
 *
 * It respects reduced motion by rendering the whole string at once: an animation
 * that cannot be turned off is an animation somebody cannot read.
 *
 * The caret is a CSS animation rather than a state toggle, so it does not
 * re-render the component 60 times a second.
 */
export function TechText({
  text, speed = 34, delay = 0, className, as = 'h2', once = true,
}: TechTextProps) {
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(!once)
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (!once || reduce) { setStarted(true); setShown(text.length); return }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setStarted(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [once, reduce, text.length])

  useEffect(() => {
    if (!started || reduce) return
    if (shown >= text.length) return
    const t = window.setTimeout(() => setShown((n) => Math.min(text.length, n + 1)), shown === 0 ? delay + speed : speed)
    return () => window.clearTimeout(t)
  }, [started, shown, text.length, speed, delay, reduce])

  const Tag = as as any
  return (
    <Tag ref={ref as any} className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, shown)}</span>
      {!reduce && shown < text.length && (
        <span aria-hidden className="tech-text__caret" style={{
          display: 'inline-block', width: '0.06em', height: '1em', marginLeft: '0.06em',
          background: 'currentColor', verticalAlign: '-0.12em', animation: 'tech-text-blink 1s steps(2) infinite',
        }} />
      )}
    </Tag>
  )
}

export default TechText
