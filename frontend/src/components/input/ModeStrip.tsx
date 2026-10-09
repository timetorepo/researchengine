import React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ModeOption } from './ModeMenu'

/**
 * The composer's modes, expanded sideways.
 *
 * The round's ask, taken literally: the three-lines button no longer opens a
 * menu — it unfolds this strip next to itself, one pill per mode, and each
 * pill carries its own tooltip on hover so a mode explains itself before it
 * is switched. Pills stay put while open (modes combine — Search inside
 * Quality is a real state), and pressing the button again folds the strip.
 *
 * The motion is the strip's own: pills walk in from the button, one after
 * another, springy and short; the tooltip is a plain fade-and-settle. Neither
 * repeats a movement another composer interaction uses.
 */
export function ModeStrip({ pills }: { pills: ModeOption[] }) {
  const reduce = useReducedMotion()
  return (
    <div className="mode-strip" data-ui="mode-strip" role="group" aria-label="Modes">
      {pills.map((p, i) => {
        const tone = p.tone === 'warning' ? 'var(--warning)' : 'var(--primary)'
        return (
          <motion.button
            key={p.id}
            type="button"
            data-mode={p.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.9 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32, delay: i * 0.03 }}
            onClick={p.toggle}
            aria-pressed={p.active}
            className="mode-pill"
            style={{
              color: p.active ? tone : 'var(--text-3)',
              background: p.active ? `color-mix(in srgb, ${tone} 14%, transparent)` : 'var(--surface)',
              border: `1px solid ${p.active ? `color-mix(in srgb, ${tone} 40%, transparent)` : 'var(--surface-border)'}`,
            }}>
            <p.icon size={12.5} strokeWidth={1.8} />
            <span>{p.label}</span>
            <span className="mode-tip" role="tooltip">
              <b>{p.title ?? p.label}</b>
              {p.desc}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
