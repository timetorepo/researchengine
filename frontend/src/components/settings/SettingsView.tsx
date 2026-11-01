import React, { useEffect } from 'react'
import { LetterSwap } from '@/components/ui/kit/community/LetterSwap'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { TABS, TAB_GROUPS, renderTab } from './settingsTabs'
import { closeSettings } from '@/lib/ui/settingsExit'
import { DUR, EASE } from '@/lib/ui/handoff'
import { SettingsNotices } from '@/components/settings/SettingsNotices'
import { StickyHeader } from '@/components/ui/kit/interior/StickyHeader'

export function SettingsView() {
  const ui = useUI()
  const tab = ui.settingsTab
  const closing = ui.settingsClosing
  const navigate = useNavigate()
  const [showAdvanced, setShowAdvanced] = useState(false)
  // The advanced group opens by itself when a link lands on one of its tabs.
  const advancedIds = new Set(TAB_GROUPS.filter((g) => g.advanced).flatMap((g) => g.tabs))
  const advancedOpen = showAdvanced || advancedIds.has(tab)
  const shownTabs = TABS.filter((t) => !advancedIds.has(t.id) || advancedOpen)
  const tabById = new Map(TABS.map((t) => [t.id, t]))

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

  const renderRailItem = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      onClick={() => ui.set({ settingsTab: t.id })}
      className="relative flex w-full items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-left transition-colors"
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
  )

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
        {TAB_GROUPS.map((group) => {
          const items = group.tabs.map((id) => tabById.get(id)).filter((t): t is (typeof TABS)[number] => !!t)
            .filter((t) => !group.advanced || advancedOpen)
          if (group.advanced) {
            return (
              <div key={group.label} className="mt-2">
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={advancedOpen}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wide rounded-[8px] hover:bg-[var(--elevated)]"
                  style={{ color: 'var(--text-3)' }}
                >
                  <span>Advanced ({group.tabs.length})</span>
                  <span aria-hidden>{advancedOpen ? '−' : '+'}</span>
                </button>
                {items.map((t) => renderRailItem(t))}
              </div>
            )
          }
          return (
            <div key={group.label} className="mt-2 first:mt-0">
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{group.label}</div>
              {items.map((t) => renderRailItem(t))}
            </div>
          )
        })}
      </aside>

      {/* Content pane — independent scroll container (mobile collapses to pill tabs) */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex gap-1 overflow-x-auto no-scrollbar p-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          {shownTabs.map((t) => (
            <button key={t.id} onClick={() => ui.set({ settingsTab: t.id })}
              className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap"
              style={{ background: tab === t.id ? 'var(--elevated)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 pane-scroll">
          {/* The tab's name stays in view while you scroll its long page. */}
          <StickyHeader className="px-5">
            <div className="max-w-[680px] mx-auto py-2.5 text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>
              <LetterSwap text={TABS.find((t) => t.id === tab)?.label ?? 'Settings'} />
            </div>
          </StickyHeader>
          <div className="max-w-[680px] mx-auto px-5 pt-2 pb-24">
            <SettingsNotices />
            {renderTab(tab)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
