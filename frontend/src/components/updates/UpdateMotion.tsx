/**
 * The two pictures the update card shows while it is busy and when it is done.
 *
 * Both are plain SVG driven by `motion`, with no images and no libraries beyond
 * the one the app already loads. They respect reduced motion: the ring still
 * fills, but nothing pulses or bounces.
 */
import React from 'react'
import { motion, useReducedMotion } from 'motion/react'

const R = 54
const C = 2 * Math.PI * R

/** A progress ring with the percentage in the middle. `pct` is 0–100. */
export function UpdateRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion()
  const value = Math.max(0, Math.min(100, Math.round(pct)))
  const offset = C * (1 - value / 100)
  return (
    <div className="relative grid place-items-center" style={{ width: 132, height: 132 }}>
      {/* A soft halo, so the ring reads as alive even at 0%. */}
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 22%, transparent), transparent)' }}
          animate={{ scale: [0.92, 1.04, 0.92], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <svg width="132" height="132" viewBox="0 0 132 132" className="relative" aria-hidden>
        <circle cx="66" cy="66" r={R} fill="none" stroke="var(--elevated)" strokeWidth="8" />
        <motion.circle
          cx="66" cy="66" r={R} fill="none"
          stroke="var(--primary)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C}
          transform="rotate(-90 66 66)"
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute font-semibold tabular-nums text-[22px]" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {`${value}%`}
      </span>
    </div>
  )
}

/**
 * The done mark: a filled disc that springs in, then a check that draws itself,
 * in the same spirit as the payment confirmation people already know.
 */
export function SuccessMark({ tone = 'success' }: { tone?: 'success' | 'primary' }) {
  const reduce = useReducedMotion()
  const color = `var(--${tone})`
  return (
    <motion.div
      className="grid place-items-center rounded-full"
      style={{ width: 96, height: 96, background: color, boxShadow: `0 16px 40px -12px color-mix(in srgb, ${color} 70%, transparent)` }}
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      role="img"
      aria-label="Done"
    >
      <svg width="46" height="46" viewBox="0 0 48 48" fill="none" aria-hidden>
        <motion.path
          d="M13 25.5 L21 33 L35 16"
          stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </motion.div>
  )
}
