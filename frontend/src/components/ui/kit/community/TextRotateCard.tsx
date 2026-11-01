/**
 * A quote card whose lines rotate in one at a time, each sliding up from below
 * and out above. Still under reduced motion: it shows the first line.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export function TextRotateCard({ quotes, author, intervalMs = 6000, className = '' }: { quotes: string[]; author?: string; intervalMs?: number; className?: string }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce || quotes.length < 2) return
    const id = window.setInterval(() => setI((n) => (n + 1) % quotes.length), intervalMs)
    return () => window.clearInterval(id)
  }, [reduce, quotes.length, intervalMs])
  const line = quotes[i % Math.max(1, quotes.length)] ?? ''
  return (
    <figure className={`rounded-[14px] p-4 ${className}`} style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
      <div className="relative h-[3.2em] overflow-hidden" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          <motion.blockquote
            key={i}
            initial={reduce ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: -18, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="text-[14px] leading-snug italic m-0"
            style={{ color: 'var(--text)' }}
          >
            “{line}”
          </motion.blockquote>
        </AnimatePresence>
      </div>
      {author && <figcaption className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>{author}</figcaption>}
    </figure>
  )
}
