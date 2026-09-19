import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface RevolvingItem {
  word: string
  /** Any icon component (lucide icons take a size + strokeWidth). */
  icon?: React.ComponentType<any>
  color?: string
}

/**
 * A word that cycles in place — the hero's "What do you want to <verb> today?".
 *
 * The old implementation used a fixed-width, `overflow-hidden` box, so long
 * words were clipped and, once a word plus its neighbours no longer fit, the
 * whole heading wrapped and pushed the composer down the page.
 *
 * This version:
 *   · never wraps (the row is `whitespace-nowrap`),
 *   · measures the incoming word and springs the slot's width towards it, so
 *     the neighbouring text slides over to meet it instead of jumping,
 *   · scales the whole line down (uniformly, from the centre) when the sentence
 *     would overflow its column, instead of wrapping or cropping,
 *   · keeps a fixed row height, so the composer below never moves.
 */
export function RevolvingText({
  items,
  prefix = 'What do you want to',
  suffix = 'Today?',
  intervalMs = 2200,
  className = '',
  maxFontPx,
  minFontPx = 20,
}: {
  items: RevolvingItem[]
  prefix?: string
  suffix?: string
  intervalMs?: number
  className?: string
  /** Font size to start from (fits down automatically). */
  maxFontPx: number
  minFontPx?: number
}) {
  const [index, setIndex] = useState(0)
  const [slotWidth, setSlotWidth] = useState<number | undefined>(undefined)
  const [scale, setScale] = useState(1)

  const outerRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  /** Hidden copy at the natural size — the width the slot animates towards. */
  const probeRef = useRef<HTMLSpanElement>(null)
  /** The visible, spring-animated slot. */
  const slotRef = useRef<HTMLSpanElement>(null)
  const scaleRef = useRef(1)

  const current = items[index] ?? items[0]

  useEffect(() => {
    if (items.length < 2) return
    const iv = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs)
    return () => clearInterval(iv)
  }, [items.length, intervalMs])

  /**
   * Shrink the whole line rather than letting it wrap.
   *
   * `offsetWidth` ignores CSS transforms, so this is idempotent: the row's
   * layout width is the sentence at scale 1. We add back the difference between
   * the animated slot and its target width so the scale is computed for where
   * the animation is *going*, not for a mid-spring frame (which would make the
   * line pulse while the slot grows).
   */
  const fit = useCallback(() => {
    const outer = outerRef.current
    const row = rowRef.current
    if (!outer || !row) return
    const available = outer.clientWidth
    if (!available) return
    const rowW = row.offsetWidth
    const naturalSlot = probeRef.current?.offsetWidth ?? 0
    const animSlot = slotRef.current?.offsetWidth ?? naturalSlot
    const natural = rowW + Math.max(0, naturalSlot - animSlot)
    const next = natural > available && natural > 0 ? Math.max(0.5, available / natural) : 1
    if (Math.abs(next - scaleRef.current) > 0.004) {
      scaleRef.current = next
      setScale(next)
    }
  }, [])

  // Measure the rendered word and spring the slot to exactly that width.
  useLayoutEffect(() => {
    const el = probeRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setSlotWidth(w)
      fit()
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    const roOuter = typeof ResizeObserver !== 'undefined' && outerRef.current ? new ResizeObserver(measure) : null
    if (outerRef.current) roOuter?.observe(outerRef.current)
    window.addEventListener('resize', measure)
    const t = setTimeout(measure, 260) // after webfonts settle
    return () => { ro?.disconnect(); roOuter?.disconnect(); window.removeEventListener('resize', measure); clearTimeout(t) }
  }, [current?.word, prefix, suffix, maxFontPx, minFontPx, fit])

  useEffect(() => { fit() }, [current?.word, slotWidth, fit])

  const Icon = current?.icon

  return (
    <div ref={outerRef} data-fit-scale={scale.toFixed(2)} className={`w-full flex justify-center overflow-visible ${className}`}>
      <div
        ref={rowRef}
        className="inline-flex items-center justify-center gap-x-2 whitespace-nowrap will-change-transform"
        style={{
          fontSize: `clamp(${minFontPx}px, 4.6vw, ${maxFontPx}px)`,
          letterSpacing: '-0.035em',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 260ms var(--ease-ios)',
        }}
        aria-live="polite"
      >
        <span>{prefix}</span>

        {/* The slot only animates its width — the word itself is never clipped. */}
        <motion.span
          ref={slotRef}
          className="relative inline-flex items-center justify-center"
          initial={false}
          animate={{ width: slotWidth ?? 'auto' }}
          transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.7 }}
          style={{ minWidth: 0 }}
        >
          {/* invisible probe at the natural size */}
          <span ref={probeRef} aria-hidden className="absolute inline-flex items-center gap-1.5 font-medium invisible">
            {Icon && <Icon size={24} strokeWidth={1.7} aria-hidden />}
            {current?.word}
          </span>

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={current?.word}
              initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
              transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
              className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap"
              style={{ color: current?.color }}
            >
              {Icon && <Icon size={24} strokeWidth={1.7} aria-hidden />}
              {current?.word}
            </motion.span>
          </AnimatePresence>
        </motion.span>

        <span>{suffix}</span>
      </div>
      {/* Screen-reader friendly full sentence */}
      <span className="sr-only">{`${prefix} ${current?.word ?? ''} ${suffix}`}</span>
    </div>
  )
}
