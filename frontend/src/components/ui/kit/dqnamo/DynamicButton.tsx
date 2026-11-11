// dqnamo-style dynamic button: idle → working → done/failed. The label morphs
// and the button's width eases between states; the async action drives it.
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, X, Loader2 } from 'lucide-react'

type Phase = 'idle' | 'working' | 'done' | 'failed'

export function DynamicButton({ onAction, idleLabel, workingLabel = 'Working', doneLabel = 'Done', className = '', disabled = false }: {
  onAction: () => Promise<unknown> | unknown; idleLabel: string; workingLabel?: string; doneLabel?: string; className?: string; disabled?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const run = async () => {
    setPhase('working')
    try {
      await onAction()
      setPhase('done')
    } catch {
      setPhase('failed')
    }
    setTimeout(() => setPhase('idle'), 1600)
  }
  const label = phase === 'working' ? workingLabel : phase === 'done' ? doneLabel : phase === 'failed' ? 'Try again' : idleLabel
  const Icon = phase === 'working' ? Loader2 : phase === 'done' ? Check : phase === 'failed' ? X : null
  return (
    <motion.button type="button" onClick={run} disabled={disabled || phase === 'working'}
      animate={{ scale: phase === 'failed' ? [1, 0.97, 1.02, 1] : 1, backgroundColor: phase === 'done' ? 'var(--success, #16a34a)' : phase === 'failed' ? 'var(--danger, #dc2626)' : 'var(--primary)' }}
      transition={{ duration: 0.25 }}
      className={`inline-flex items-center justify-center gap-2 min-w-[120px] h-9 px-4 rounded-[10px] text-[12.5px] font-medium disabled:opacity-60 ${className}`}
      style={{ color: '#fff' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }} className="inline-flex items-center gap-1.5">
          {Icon && <Icon size={13} aria-hidden className={phase === 'working' ? 'animate-spin' : ''} />}
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
