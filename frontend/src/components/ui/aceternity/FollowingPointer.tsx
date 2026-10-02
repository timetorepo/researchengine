/**
 * Following Pointer — Aceternity UI, vendored (R17).
 *
 * Canonical install: `npx shadcn@latest add @aceternity/following-pointer-demo`.
 * Registry unreachable from the build machine; this carries the component from
 * the `multi-ui-bundle` npm package (a published copy of the Aceternity set):
 * the card hides the system cursor, tracks the pointer inside its own box, and
 * draws a small arrow plus a name badge that follows it.
 *
 * Differences from upstream:
 *   • `motion/react` instead of `framer-motion`.
 *   • The badge is themed rather than a random colour from a hardcoded list,
 *     and takes a `ReactNode` so it can carry the real user's avatar and name
 *     (that is what the design-mode "point at it" flow feeds it).
 *   • `pointerEvents: 'none'` on the whole follower, so it can never eat a
 *     click meant for the element under it.
 */
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, type MotionValue } from 'motion/react'
import { cn } from '@/lib/utils'

export function FollowerPointerCard({
  children,
  className,
  title,
  enabled = true,
}: {
  children: React.ReactNode
  className?: string
  title?: React.ReactNode
  enabled?: boolean
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const ref = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [inside, setInside] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const measure = () => setRect(ref.current?.getBoundingClientRect() ?? null)
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setInside(true)}
      onMouseLeave={() => { setInside(false); setRect(ref.current?.getBoundingClientRect() ?? null) }}
      onMouseMove={(e) => {
        if (!rect) return
        x.set(e.clientX - rect.left)
        y.set(e.clientY - rect.top)
      }}
      className={cn('relative', className)}
      data-ui="following-pointer"
      style={enabled ? { cursor: 'none' } : undefined}>
      <AnimatePresence>{inside && enabled && <FollowPointer x={x} y={y} title={title} />}</AnimatePresence>
      {children}
    </div>
  )
}

export function FollowPointer({ x, y, title }: { x: MotionValue<number>; y: MotionValue<number>; title?: React.ReactNode }) {
  const spring = { stiffness: 380, damping: 28 }
  const sx = useSpring(x, spring)
  const sy = useSpring(y, spring)
  return (
    <motion.div
      className="h-4 w-4 absolute z-50 pointer-events-none"
      style={{ top: sy, left: sx, position: 'absolute', pointerEvents: 'none' }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}>
      <svg
        stroke="currentColor" fill="currentColor" strokeWidth="1" viewBox="0 0 16 16"
        className="h-6 w-6 transform -rotate-[70deg] -translate-x-[12px] -translate-y-[10px]"
        style={{ color: 'var(--primary)' }}
        height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z" />
      </svg>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="px-2 py-1 whitespace-nowrap min-w-max text-[11.5px] rounded-full flex items-center gap-1.5"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}>
        {title ?? 'You'}
      </motion.div>
    </motion.div>
  )
}
