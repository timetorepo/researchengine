import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { TABS, renderTab } from './settingsTabs'
import { closeSettings } from '@/lib/ui/settingsExit'
import { DUR, EASE } from '@/lib/ui/handoff'
import { SettingsNotices } from '@/components/settings/SettingsNotices'

export function SettingsView() {
  const ui = useUI()
  const tab = ui.settingsTab
  const closing = ui.settingsClosing
  const navigate = useNavigate()

  useEffect(() => { ui.set({ settingsOpen: true, settingsClosing: false }) }, [])

  // Back, Escape and the palette all take the same door: the page lets go
  // first, then the route changes. See lib/ui/settingsExit.ts.
  const close = () => closeSettings(() => {
    useUI.setState({ settingsOpen: false })
    navigate('/')
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="h-full flex overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={closing
        ? { opacity: 0, y: 14, filter: 'blur(10px)', scale: 0.992 }
        : { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: closing ? DUR.slow : DUR.base, ease: EASE }}
      style={{ transformOrigin: 'top center' }}
    >
      {/* Tab rail — independent scroll container */}
      <aside className="w-[200px] shrink-0 hidden md:flex flex-col p-3 gap-0.5 overflow-y-auto min-h-0 pane-scroll" style={{ borderRight: '1px solid var(--surface-border)' }}>
        <button onClick={close} className="flex items-center gap-2 px-3 py-2 mb-2 text-[12.5px] rounded-[10px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={14} /> Back
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => ui.set({ settingsTab: t.id })}
            className="relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-left transition-colors"
            style={{ color: tab === t.id ? 'var(--text)' : 'var(--text-2)' }}
          >
            {tab === t.id && (
              <motion.span
                layoutId="settings-tab-pill"
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'var(--elevated)' }}
                transition={{ type: 'spring', damping: 28, stiffness: 400 }}
              />
            )}
            <t.icon size={15} strokeWidth={1.5} className="relative" style={{ color: tab === t.id ? 'var(--primary)' : 'var(--text-3)' }} />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </aside>

      {/* Content pane — independent scroll container (mobile collapses to pill tabs) */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex gap-1 overflow-x-auto no-scrollbar p-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => ui.set({ settingsTab: t.id })}
              className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap"
              style={{ background: tab === t.id ? 'var(--elevated)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 pane-scroll">
          <div className="max-w-[680px] mx-auto px-5 pt-6 pb-24">
            <SettingsNotices />
            {renderTab(tab)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
