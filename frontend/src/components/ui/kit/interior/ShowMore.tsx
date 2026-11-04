// Interior-style show more: long content is clamped to a height with a fade,
// and a button expands it in place.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'

export function ShowMore({ children, collapsedHeight = 120, className = '' }: { children: ReactNode; collapsedHeight?: number; className?: string }) {
  const [open, setOpen] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (el) setOverflowing(el.scrollHeight > collapsedHeight + 8)
  }, [children, collapsedHeight])
  return (
    <div className={className}>
      <motion.div initial={false} animate={{ height: open || !overflowing ? 'auto' : collapsedHeight }} transition={{ duration: 0.24, ease: 'easeOut' }}
        className="relative overflow-hidden">
        <div ref={inner}>{children}</div>
        {!open && overflowing && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(transparent, var(--bg))' }} />
        )}
      </motion.div>
      {overflowing && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="mt-1 text-[12px] font-medium" style={{ color: 'var(--primary)' }}>{open ? 'Show less' : 'Show more'}</button>
      )}
    </div>
  )
}
