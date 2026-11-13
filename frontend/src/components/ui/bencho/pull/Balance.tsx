/* Bencho — Copyright (c) 2026 Lorenzo Cabra. MIT; see ../LICENSE.
 * Adapted from the pull/Balance block: pull threshold and spring return now wrap
 * live application content. Removed the sample portfolio and fabricated balances.
 */
import { useBenchoReducedMotion } from '../useBenchoReducedMotion'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import { ArrowDown, RefreshCw } from 'lucide-react'
import './Balance.css'

export function Balance({ children, busy, onRefresh }: { children: ReactNode; busy: boolean; onRefresh: () => void | Promise<void> }) {
  const y = useMotionValue(0)
  const lock = useRef(false)
  const reduced = useBenchoReducedMotion()
  const refresh = async () => {
    if (busy || lock.current) return
    lock.current = true
    try { await onRefresh() } finally { lock.current = false }
  }
  return <div className="re-bencho re-crm-pull">
    <motion.div drag={busy ? false : 'y'} dragConstraints={{ top: 0, bottom: 80 }} dragElastic={0.05}
      style={{ y }} onDragEnd={() => { if (y.get() >= 60) void refresh(); animate(y, 0, reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }) }}
      className="re-pull-handle">
      <button type="button" disabled={busy} onClick={() => void refresh()} className="flex items-center justify-center gap-2 text-xs px-3 py-2 w-full" aria-label="Pull or press to refresh CRM">
        {busy ? <RefreshCw size={14} /> : <ArrowDown size={14} />} {busy ? 'Refreshing CRM…' : 'Pull down or press to refresh CRM'}
      </button>
    </motion.div>
    {children}
  </div>
}
