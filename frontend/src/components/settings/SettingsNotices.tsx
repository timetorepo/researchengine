/** The notices stack at the top of Settings: saved settings and new updates. */
import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { useNotices } from '@/stores/useNotices'

export function SettingsNotices() {
  const notices = useNotices((s) => s.notices)
  const dismiss = useNotices((s) => s.dismiss)
  if (notices.length === 0) return null
  return (
    <div className="flex flex-col gap-2 mb-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {notices.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <InlineAlert status={n.status} title={n.title} onClose={() => dismiss(n.id)}>
              {n.description}
            </InlineAlert>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
