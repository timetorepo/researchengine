// Interior-style hide on scroll: the bar slides away while you scroll down and
// returns the moment you scroll up, so it never covers what you are reading.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { findScroller, scrollTopOf } from './scroller'

export function HideOnScroll({ children, threshold = 8, className = '' }: { children: ReactNode; threshold?: number; className?: string }) {
  const [hidden, setHidden] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = findScroller(ref.current)
    let lastY = scrollTopOf(scroller)
    const read = () => {
      const y = scrollTopOf(scroller)
      const delta = y - lastY
      if (Math.abs(delta) < threshold && y > 0) return
      setHidden(delta > 0 && y > 64)
      lastY = y
    }
    scroller.addEventListener('scroll', read, { passive: true })
    return () => scroller.removeEventListener('scroll', read)
  }, [threshold])
  return (
    <motion.div ref={ref} animate={{ y: hidden ? '-100%' : '0%' }} transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`sticky top-0 z-20 ${className}`}>
      {children}
    </motion.div>
  )
}
