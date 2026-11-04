// RareUI · AI status — a small live pill that says what the AI is doing right
// now. Shown wherever the AI is working; it hides itself when idle.
import { AnimatePresence, motion } from 'motion/react'

export function AiStatus({ active, label, detail }: { active: boolean; label: string; detail?: string }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div role="status" aria-live="polite"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11.5px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <span className="relative flex w-2 h-2" aria-hidden>
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--primary)', opacity: 0.45 }} />
            <span className="relative w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
          </span>
          <span style={{ color: 'var(--text)' }}>{label}</span>
          {detail && <span className="truncate max-w-[220px]" style={{ color: 'var(--text-3)' }}>{detail}</span>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
