import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { AI_WELCOMES } from '@/lib/themes/aiWelcome'

/**
 * A welcome card for the AI-product themes. It turns off in two places: the
 * “Turn off” link here, and Settings → Appearance. Turning it off is a setting,
 * so it stays off across sessions.
 */
export function AIThemeWelcome({ onFocusInput }: { onFocusInput?: () => void }) {
  const theme = useStore((s) => s.settings.theme)
  const enabled = useStore((s) => s.settings.aiThemeWelcome !== false)
  const turnOff = () => useStore.setState((s) => ({ settings: { ...s.settings, aiThemeWelcome: false } }))
  const welcome = AI_WELCOMES[theme]

  return (
    <AnimatePresence>
      {enabled && welcome && (
        <motion.section
          key={theme}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          aria-label={`Welcome to ${theme}`}
          className="relative mx-auto mb-8 max-w-[640px] rounded-[18px] px-6 py-5 text-left"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
        >
          <div className="text-[18px] font-semibold" style={{ letterSpacing: '-0.01em', color: 'var(--text-1)' }}>{welcome.headline}</div>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{welcome.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onFocusInput}
              className="rounded-full px-4 py-2 text-[12.5px] font-medium transition-transform duration-150 active:scale-[0.97]"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              {welcome.cta}
            </button>
            <button
              type="button"
              onClick={turnOff}
              className="text-[12px] underline underline-offset-4"
              style={{ color: 'var(--text-3)' }}
            >
              Turn off this welcome
            </button>
          </div>
          <button
            type="button"
            aria-label="Hide this welcome"
            onClick={turnOff}
            className="absolute top-3 right-3 grid size-7 place-items-center rounded-full"
            style={{ color: 'var(--text-3)' }}
          >
            <X size={14} />
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
