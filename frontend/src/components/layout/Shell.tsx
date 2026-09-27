import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TopBar } from '@/components/topbar/TopBar'
import { TitleBar } from '@/components/os/TitleBar'
import { DynamicIsland } from '@/components/os/DynamicIsland'
import { OSDock } from '@/components/os/OSDock'
import { PrivacyPanel } from '@/components/sidebar/PrivacyPanel'
import { BackgroundLayer } from './BackgroundLayer'

export function Shell({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.settings.theme)
  const osMinimized = useUI((s) => s.osMinimized)
  const location = useLocation()
  const isOS = theme === 're-os'
  const dynamicIsland = useStore((s) => s.settings.dynamicIsland)
  const themeGradients = useStore((s) => s.settings.themeGradients)
  const glassMode = useStore((s) => s.settings.glassMode)

  // Gradient style lives on <html> so every gradient surface follows.
  useEffect(() => {
    document.documentElement.dataset.grad = themeGradients ? 'theme' : 'vibrant'
  }, [themeGradients])

  // Glass theme (chatbox + Dynamic Island) also lives on <html>.
  useEffect(() => {
    document.documentElement.dataset.glass = glassMode ?? 'off'
  }, [glassMode])

  // Route enter transition only — no exit animation and no mode="wait".
  // An exit-gated AnimatePresence can strand the incoming page if the exit
  // ever fails to complete (rapid navs, heavy frames), which manifests as a
  // blank/frozen screen that only a refresh fixes. A keyed fade-in cannot jam.
  const content = (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="h-full min-h-0"
    >
      {children}
    </motion.div>
  )

  if (isOS) {
    return (
      <div className="h-full w-full os-wallpaper relative overflow-hidden flex flex-col">
        <BackgroundLayer />
        <div className="relative z-10 flex flex-col h-full min-h-0">
          <TitleBar />
          <DynamicIsland />
          {osMinimized ? (
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={() => useUI.setState({ osMinimized: false })}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full glass flex items-center justify-center"
              style={{ border: '1px solid var(--surface-border)', boxShadow: '0 16px 48px -12px rgba(0,0,0,0.6)' }}
              aria-label="Restore Research Engine"
            >
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
                <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
                <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
              </svg>
            </motion.button>
          ) : (
            <div className="flex-1 flex min-h-0 relative">
              <OSDock />
              {/* OS mode: the Dock is the navigation — no sidebar. */}
              <motion.main
                layout
                className="flex-1 min-w-0 m-3 ml-20 surface-elevated overflow-hidden flex flex-col"
                style={{ borderRadius: 18, boxShadow: '0 24px 80px -24px rgba(0,0,0,0.6)', background: 'var(--glass)', backdropFilter: 'blur(20px)' }}
              >
                <TopBar />
                <div className="flex-1 min-h-0 relative">{content}</div>
              </motion.main>
            </div>
          )}
        </div>
        <PrivacyPanel />
      </div>
    )
  }

  return (
    <div className="h-full w-full relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <BackgroundLayer />
      <div className="relative z-10 h-full flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 min-h-0 relative">{content}</main>
        </div>
      </div>
      {/* Optional everywhere: the island floats over any theme when enabled. */}
      {dynamicIsland && <DynamicIsland />}
      <PrivacyPanel />
    </div>
  )
}
