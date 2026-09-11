import React from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TopBar } from '@/components/topbar/TopBar'
import { TitleBar } from '@/components/os/TitleBar'
import { DynamicIsland } from '@/components/os/DynamicIsland'
import { OSDock } from '@/components/os/OSDock'
import { PrivacyPanel } from '@/components/sidebar/PrivacyPanel'

export function Shell({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.settings.theme)
  const osMinimized = useUI((s) => s.osMinimized)
  const isOS = theme === 're-os'

  if (isOS) {
    return (
      <div className="h-full w-full os-wallpaper relative overflow-hidden flex flex-col">
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
            <motion.main
              layout
              className="flex-1 min-w-0 m-3 ml-20 surface-elevated overflow-hidden flex flex-col"
              style={{ borderRadius: 18, boxShadow: '0 24px 80px -24px rgba(0,0,0,0.6)' }}
            >
              <TopBar />
              <div className="flex-1 min-h-0 flex">
                <Sidebar floating />
                <div className="flex-1 min-w-0 min-h-0 relative">{children}</div>
              </div>
            </motion.main>
          </div>
        )}
        <PrivacyPanel />
      </div>
    )
  }

  return (
    <div className="h-full w-full flex overflow-hidden relative" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 min-h-0 relative">{children}</main>
      </div>
      <PrivacyPanel />
    </div>
  )
}
