// Interior-style reading progress: a hairline stuck to the top of the surface
// that fills as you read it. It follows the scroll pane it sits in.
import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { findScroller, isPage, scrollTopOf } from './scroller'

export function ReadingProgress() {
  const anchor = useRef<HTMLDivElement>(null)
  const raw = useMotionValue(0)
  const scaleX = useSpring(raw, { stiffness: 140, damping: 26, restDelta: 0.001 })

  useEffect(() => {
    const scroller = findScroller(anchor.current)
    const read = () => {
      const el = isPage(scroller) ? document.documentElement : scroller
      const max = el.scrollHeight - el.clientHeight
      raw.set(max > 0 ? Math.min(1, Math.max(0, scrollTopOf(scroller) / max)) : 0)
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    return () => scroller.removeEventListener('scroll', read)
  }, [raw])

  return (
    <div ref={anchor} className="sticky top-0 z-20 h-[2px] -mb-[2px] pointer-events-none">
      <motion.div aria-hidden className="h-full origin-left" style={{ scaleX, background: 'var(--primary)' }} />
    </div>
  )
}
