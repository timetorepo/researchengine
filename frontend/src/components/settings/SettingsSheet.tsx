import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { TABS, renderTab } from './settingsTabs'

/**
 * Settings as a slide-in overlay from the right — opened by the sidebar gear or
 * Cmd/Ctrl+,. Preserves the current page/chat context underneath.
 */
export function SettingsSheet() {
  const open = useUI((s) => s.settingsSheet)
  const tab = useUI((s) => s.settingsTab)
  const set = useUI((s) => s.set)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set({ settingsSheet: false }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, set])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[64]"
            style={{ background: 'var(--scrim)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => set({ settingsSheet: false })}
          />
          <motion.div
            role="dialog" aria-label="Settings"
            className="fixed right-0 top-0 bottom-0 z-[65] w-full sm:w-[640px] flex flex-col"
            style={{ background: 'var(--bg)', borderLeft: '1px solid var(--surface-border)', boxShadow: '-24px 0 80px -24px rgba(0,0,0,0.5)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="h-12 shrink-0 flex items-center gap-1 px-3 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set({ settingsTab: t.id })}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-colors"
                  style={{ color: tab === t.id ? 'var(--text)' : 'var(--text-3)', background: tab === t.id ? 'var(--elevated)' : 'transparent' }}
                >
                  <t.icon size={13} strokeWidth={1.5} /> {t.label}
                </button>
              ))}
              <button
                onClick={() => set({ settingsSheet: false })}
                aria-label="Close settings"
                className="ml-auto p-2 rounded-full hover:bg-[var(--elevated)] shrink-0"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 pane-scroll">
              <div className="max-w-[640px] mx-auto px-5 pt-6 pb-24">
                {renderTab(tab)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
