import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react'
import { useUI } from '@/stores/useUI'

const WORK = 25 * 60
const BREAK = 5 * 60

export function FocusPill() {
  const focus = useUI((s) => s.focus)
  const [open, setOpen] = React.useState(false)
  const tickRef = useRef<any>(null)

  useEffect(() => {
    if (focus.running && focus.endsAt) {
      tickRef.current = setInterval(() => {
        const f = useUI.getState().focus
        if (!f.endsAt) return
        const remaining = Math.max(0, Math.round((f.endsAt - Date.now()) / 1000))
        useUI.setState({ focus: { ...f, remaining } })
        useUI.setState((s) => ({ island: s.island.kind === 'focus' || s.island.kind === 'idle' ? { kind: 'focus', remaining, total: f.total } : s.island }))
        if (remaining <= 0) {
          const next = f.mode === 'work' ? 'break' : 'work'
          const total = next === 'work' ? WORK : BREAK
          useUI.getState().toast(f.mode === 'work' ? 'Focus complete' : 'Break over', f.mode === 'work' ? 'Time for a 5 minute break.' : 'Back to it — 25 minutes of focus.')
          useUI.setState({ focus: { running: true, endsAt: Date.now() + total * 1000, remaining: total, total, mode: next } })
        }
      }, 500)
      return () => clearInterval(tickRef.current)
    }
  }, [focus.running])

  const start = () => {
    const total = focus.mode === 'work' ? WORK : BREAK
    useUI.setState({ focus: { running: true, endsAt: Date.now() + focus.remaining * 1000, remaining: focus.remaining, total: focus.total || total, mode: focus.mode } })
  }
  const pause = () => useUI.setState({ focus: { ...focus, running: false, endsAt: null } })
  const reset = () => useUI.setState({ focus: { running: false, endsAt: null, remaining: WORK, total: WORK, mode: 'work' } })

  const mm = Math.floor(focus.remaining / 60)
  const ss = focus.remaining % 60

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-14 right-0 glass p-4 rounded-[18px] w-56"
            style={{ border: '1px solid var(--surface-border)', boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
          >
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
              Focus timer · {focus.mode === 'work' ? 'Pomodoro' : 'Break'}
            </div>
            <div className="text-3xl font-semibold text-center tabular-nums my-3" style={{ letterSpacing: '-0.02em' }}>
              {mm}:{String(ss).padStart(2, '0')}
            </div>
            <div className="flex justify-center gap-2">
              {focus.running ? (
                <button onClick={pause} className="p-2 rounded-full" style={{ background: 'var(--elevated)' }} aria-label="Pause"><Pause size={15} /></button>
              ) : (
                <button onClick={start} className="p-2 rounded-full" style={{ background: 'var(--primary)', color: '#fff' }} aria-label="Start"><Play size={15} /></button>
              )}
              <button onClick={reset} className="p-2 rounded-full" style={{ background: 'var(--elevated)' }} aria-label="Reset"><RotateCcw size={15} /></button>
            </div>
            <p className="text-[10.5px] mt-3 text-center" style={{ color: 'var(--text-3)' }}>Pairs with Read &amp; Quiz study sessions.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        className="glass flex items-center gap-2 px-3.5 py-2 rounded-full"
        style={{ border: '1px solid var(--surface-border)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}
        aria-label="Focus timer"
      >
        <Timer size={14} strokeWidth={1.5} style={{ color: focus.running ? 'var(--warning)' : 'var(--text-2)' }} />
        <span className="text-[12px] tabular-nums font-mono" style={{ color: focus.running ? 'var(--text)' : 'var(--text-3)' }}>
          {mm}:{String(ss).padStart(2, '0')}
        </span>
        {focus.running && <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--warning)', color: 'var(--warning)' }} />}
      </button>
    </div>
  )
}
