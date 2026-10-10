// AIFlowEngine thinking indicator — a breathing orb with a rotating
// violet→blue→teal gradient, beside a pipeline-aware label that cross-fades
// through the actual stages of the request. No ellipsis animation.
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ThinkingOrb } from 'thinking-orbs'
import { STAGE_LABELS, type FlowStage } from '@/lib/flow/engine'
import { useStore } from '@/stores/useStore'
import { themeKind } from '@/lib/themes/meta'

const ORDER: FlowStage[] = ['understand', 'search', 'read-sources', 'retrieve', 'think', 'compose']

/** Each stage gets the orb motion that matches what is actually happening. */
const ORB_STATE: Partial<Record<FlowStage, React.ComponentProps<typeof ThinkingOrb>['state']>> = {
  understand: 'listening',
  search: 'searching',
  'read-sources': 'connecting',
  retrieve: 'weaving',
  think: 'solving',
  compose: 'composing',
  done: 'breathing',
}

export function ThinkingIndicator({ stage, inline = false }: { stage: FlowStage; inline?: boolean }) {
  const style = useStore((s) => s.settings.thinkingStyle ?? 'standard')
  const theme = useStore((s) => s.settings.theme)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
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
    <div data-ui="thinking" className={`flex items-center gap-2.5 ${inline ? '' : 'py-1'}`}>
      <motion.div layoutId="re-flow-orb" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}>
        {/* ThinkingOrb by Jakubantalik — the live state of the engine, drawn. */}
        <ThinkingOrb state={ORB_STATE[shown] ?? 'working'} size={20} theme={themeKind(theme)} paused={reduceMotion} />
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
