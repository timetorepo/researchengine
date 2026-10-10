import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { SessionSwitcher } from '@/components/sessions/SessionSwitcher'
import { TopBar } from '@/components/topbar/TopBar'
import { TitleBar } from '@/components/os/TitleBar'
import { DynamicIsland } from '@/components/os/DynamicIsland'
import { OSDock } from '@/components/os/OSDock'
import { PrivacyPanel } from '@/components/sidebar/PrivacyPanel'
import { BackgroundLayer } from './BackgroundLayer'
import { readLockSession, clearLockSession } from '@/lib/security/lock'

/**
 * A guest session has to say so, or it is a trap: the person using it would
 * reasonably assume their work is going where the owner's goes, and the owner
 * would reasonably assume a guest's chats are theirs to lose. One strip, always
 * visible, that names which of the two is happening.
 */
function GuestStrip() {
  const guest = readLockSession()?.role === 'guest'
  if (!guest) return null
  return (
    <div
      className="relative z-20 flex items-center justify-center gap-2 px-3 py-1 text-[11px]"
      style={{ background: 'var(--elevated)', color: 'var(--text-2)', borderBottom: '1px solid var(--surface-border)' }}
      role="status"
    >
      <span>Guest session. Nothing here is the owner's data, and nothing you make here is visible to anyone else.</span>
      <button
        className="underline underline-offset-2"
        onClick={() => { clearLockSession(); window.location.reload() }}
      >
        Leave
      </button>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  // AI-driven navigation: message chips dispatch this event, the shell routes.
  const nav = useNavigate()
  useEffect(() => {
    const h = (e: Event) => nav(String((e as CustomEvent).detail))
    window.addEventListener('re-navigate', h)
    return () => window.removeEventListener('re-navigate', h)
  }, [nav])
  const theme = useStore((s) => s.settings.theme)
  const osMinimized = useUI((s) => s.osMinimized)
  const location = useLocation()
  const isOS = theme === 're-os'
  const dynamicIsland = useStore((s) => s.settings.dynamicIsland)
  const themeGradients = useStore((s) => s.settings.themeGradients)
  const glassMode = useStore((s) => s.settings.glassMode)

  // Gradient style lives on <html> so every gradient surface follows.
  //
  // Swapping gradient *values* is instant and reads as a jump-cut, so while the
  // new palette takes over we run `re-grad-settle`: the mesh pans across each
  // gradient card and eases back to centre, the way the colour "finds" its
  // place. Runs on the toggle AND on a theme change (theme-matched gradients are
  // derived from the palette, so a theme switch recolours them too).
  const gradSettleRan = React.useRef(false)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.grad = themeGradients ? 'theme' : 'vibrant'
    if (!gradSettleRan.current) { gradSettleRan.current = true; return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear = 0
    const timer = window.setTimeout(() => {
      root.classList.add('re-grad-settle')
      window.dispatchEvent(new CustomEvent('re:gradient-settle'))
      // The pan ends at the *new* palette — drop the class so the oversized
      // background and the will-change hint don't linger.
      clear = window.setTimeout(() => root.classList.remove('re-grad-settle'), 1250)
    }, 30)
    return () => { window.clearTimeout(timer); window.clearTimeout(clear) }
  }, [themeGradients, theme])

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
        <GuestStrip />
        <BackgroundLayer />
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
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
        <SessionSwitcher />
      </div>
    )
  }

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col" style={{ background: 'var(--bg)' }}>
      <GuestStrip />
      <BackgroundLayer />
      <div className="relative z-10 flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 min-h-0 relative">{content}</main>
        </div>
      </div>
      {/* Optional everywhere: the island floats over any theme when enabled. */}
      {dynamicIsland && <DynamicIsland />}
      <PrivacyPanel />
      <SessionSwitcher />
    </div>
  )
}
