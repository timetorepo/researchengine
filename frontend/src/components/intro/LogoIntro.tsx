/**
 * The launch intro: the Research Engine mark melts into glass and settles on the
 * wordmark. It plays on the first launch, and on every launch when Settings turns
 * that on. Any key, click or the Skip button closes it, and it never blocks the app
 * for longer than its run time. It is lazy-loaded, so the WebGL code stays out of
 * the startup bundle.
 */
import { useEffect, useRef, useState } from 'react'
import { LiquidGlassLogo, type LiquidGlassLogoHandle } from '@/components/ui/reactdrops/liquid-glass-logo'
import { INTRO_PLAY_EVENT, introDue, markIntroSeen } from './introPrefs'

/** Seconds the wordmark is held after the animation (the registry's run is 3.3 s). */
const HOLD_MS = 2200

export function LogoIntro() {
  const [open, setOpen] = useState(() => introDue())
  const [run, setRun] = useState(0)
  const logo = useRef<LiquidGlassLogoHandle>(null)
  const [caption, setCaption] = useState(false)
  // The name fades in once the glass has cleared, so the mark is seen first.
  useEffect(() => {
    if (!open) return
    setCaption(false)
    const t = window.setTimeout(() => setCaption(true), 1800)
    return () => window.clearTimeout(t)
  }, [open, run])

  // Mark it seen as soon as it is shown, so a reload mid-intro does not replay it.
  useEffect(() => { if (open) markIntroSeen() }, [open, run])

  // Replay from Settings without a reload.
  useEffect(() => {
    const play = () => { setRun((n) => n + 1); setOpen(true) }
    window.addEventListener(INTRO_PLAY_EVENT, play)
    return () => window.removeEventListener(INTRO_PLAY_EVENT, play)
  }, [])

  // Close on its own after the run, and on any key.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 3300 + HOLD_MS)
    const key = () => setOpen(false)
    window.addEventListener('keydown', key)
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', key) }
  }, [open, run])

  // A replay restarts the sequence from zero.
  useEffect(() => { if (open && run > 0) logo.current?.replay() }, [open, run])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Research Engine intro"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center cursor-pointer"
      style={{ background: '#000' }}
    >
      <div className="w-[min(78vw,560px)] h-[min(36vh,240px)]">
        <LiquidGlassLogo
          key={run}
          ref={logo}
          logo="/icon.svg"
          text="Research Engine"
          ending="logo"
          logoColor="original"
          tile={false}
          aria-label="Research Engine"
          height="100%"
        />
      </div>
      <p
        className="mt-2 text-[15px] font-semibold tracking-tight"
        style={{ color: '#e2e6ee', opacity: caption ? 1 : 0, transition: 'opacity 600ms ease' }}
        aria-hidden="true"
      >
        Research Engine
      </p>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(false) }}
        className="mt-6 text-[12px] px-3 py-1 rounded-full"
        style={{ color: '#9aa3b2', border: '1px solid #2a3140' }}
      >
        Skip
      </button>
    </div>
  )
}
