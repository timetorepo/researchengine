/* Bencho — Copyright (c) 2026 Lorenzo Cabra. MIT; see ../LICENSE.
 * Adapted from Island: original morphing shell; demo activities replaced by controlled slots.
 * Separate trigger and body avoid nesting actionable controls inside a button.
 */
import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import './Island.css'

export function Island({ open, onOpenChange, summary, children, reduced = false }: {
  open: boolean; onOpenChange: (open: boolean) => void; summary: ReactNode; children: ReactNode; reduced?: boolean
}) {
  const systemReduced = useReducedMotion()
  const id = useId()
  const still = reduced || systemReduced
  return <motion.div className="dyn-pill re-activity-island" initial={false}
    style={{ width: open ? 320 : 220, maxWidth: 'calc(100vw - 32px)', borderRadius: open ? 16 : 24 }}
    animate={{ opacity: 1 }}
    transition={still ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30, mass: .9 }}>
    <button type="button" className="re-island-trigger" aria-label={open ? 'Collapse activity island' : 'Expand activity island'} aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>{summary}</button>
    {open && <div id={id} className="px-4 pb-4 pt-1">{children}</div>}
  </motion.div>
}
