import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useUI } from '@/stores/useUI'

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle }
const COLORS = { info: 'var(--primary)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' }

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  const theme = useUI((s) => s.island) // subscribe so OS banner position works

  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass flex items-start gap-2.5 p-3 rounded-[14px]"
              style={{ border: '1px solid var(--surface-border)', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.45)' }}
            >
              <Icon size={16} strokeWidth={1.8} style={{ color: COLORS[t.tone] }} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium leading-tight">{t.title}</div>
                {t.body && <div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="p-0.5 rounded" style={{ color: 'var(--text-3)' }}>
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
