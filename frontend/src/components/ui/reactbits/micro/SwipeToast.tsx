// React Bits — Swipe Toast (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/swipe-toast: a toast you can throw away. The
// upstream source is not reachable from this environment, so this is a
// reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useCallback, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react'
import { X } from 'lucide-react'

export type SwipeToastTone = 'info' | 'success' | 'warning' | 'danger'

export interface SwipeToastProps {
  title: string
  detail?: string
  tone?: SwipeToastTone
  /** Called when the toast is thrown past the threshold or closed. */
  onDismiss: () => void
  /** Pixels of horizontal travel that count as a throw. */
  threshold?: number
  index?: number
}

/** The surface, kept out of the motion style so `style` is written once. */
const SURFACE = {
  background: 'var(--glass, var(--surface))',
  border: '1px solid var(--surface-border)',
  backdropFilter: 'blur(12px)',
  touchAction: 'pan-y' as const,
}

const TONE: Record<SwipeToastTone, string> = {
  info: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

/**
 * A toast that goes when you swipe it. Vertical swipes do nothing, on purpose:
 * the app scrolls vertically and a toast that leaves on a scroll gesture would
 * be a toast you cannot read while scrolling.
 */
export function SwipeToast({ title, detail, tone = 'info', onDismiss, threshold = 96 }: SwipeToastProps) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-threshold, 0, threshold], [0.4, 1, 0.4])
  const [gone, setGone] = useState(false)
  const start = useRef(0)

  const onDragStart = useCallback(() => { start.current = x.get() }, [x])

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    // The throw has to be deliberate: past the threshold, and travelling away
    // rather than settling back. A flick counts, a slow drift past the line does
    // not, because that is what a mis-aimed tap looks like.
    const thrown = Math.abs(info.offset.x) > threshold && Math.abs(info.velocity.x) > 220
    if (thrown || Math.abs(x.get()) > threshold * 1.5) {
      setGone(true)
      x.set(info.offset.x > 0 ? 400 : -400)
      window.setTimeout(onDismiss, 160)
    } else {
      x.set(0)
    }
  }, [onDismiss, threshold, x])

  if (gone) return null
  const color = TONE[tone]

  return (
    <motion.div
      drag="x"
      style={{ x, opacity, ...SURFACE }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      role="status"
      data-tone={tone}
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium" style={{ color: 'var(--text-1)' }}>{title}</div>
        {detail && <div className="text-[11.5px] leading-snug mt-0.5" style={{ color: 'var(--text-2)' }}>{detail}</div>}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="shrink-0 p-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
        <X size={12} />
      </button>
    </motion.div>
  )
}

export default SwipeToast
