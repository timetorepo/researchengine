// AIFlowEngine thinking indicator — a breathing orb with a rotating
// violet→blue→teal gradient, beside a pipeline-aware label that cross-fades
// through the actual stages of the request. No ellipsis animation.
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { STAGE_LABELS, type FlowStage } from '@/lib/flow/engine'
import { useStore } from '@/stores/useStore'

const ORDER: FlowStage[] = ['understand', 'search', 'read-sources', 'retrieve', 'think', 'compose']

export function ThinkingIndicator({ stage, inline = false }: { stage: FlowStage; inline?: boolean }) {
  const style = useStore((s) => s.settings.thinkingStyle ?? 'standard')
  const [shown, setShown] = useState(stage)
  const [visible, setVisible] = useState(true)

  // Stability window: a stage that completes almost immediately still gets a
  // graceful cross-fade rather than a hard swap.
  useEffect(() => {
    if (stage === shown) return
    const t = setTimeout(() => setShown(stage), 160)
    return () => clearTimeout(t)
  }, [stage, shown])

  // "Composing response" fades out — the response itself takes over.
  useEffect(() => {
    if (stage === 'compose') {
      const t = setTimeout(() => setVisible(false), 700)
      return () => clearTimeout(t)
    }
    setVisible(true)
  }, [stage])

  if (!visible || style === 'minimal') return null
  const label = STAGE_LABELS[shown] || 'Thinking'

  return (
    <div className={`flex items-center gap-2.5 ${inline ? '' : 'py-1'}`}>
      <motion.div layoutId="re-flow-orb" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}>
        <span className="re-orb" aria-hidden="true" />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="text-[12px] select-none"
          style={{ color: 'var(--text-3)', letterSpacing: '0.01em' }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
      {style === 'verbose' && (
        <span className="flex items-center gap-1 ml-1">
          {ORDER.map((s) => (
            <span key={s} title={STAGE_LABELS[s]}
              className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{
                background: ORDER.indexOf(s) < ORDER.indexOf(shown)
                  ? 'var(--primary)'
                  : s === shown ? 'var(--secondary)' : 'var(--surface-border)',
              }} />
          ))}
        </span>
      )}
    </div>
  )
}
