import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Timer, Play, Pause, RotateCcw, SkipForward, GraduationCap, Code2, BookOpen, Sparkles, Flame } from 'lucide-react'
import { useUI, type ActivityKind } from '@/stores/useUI'
import { AnimatedNumber, useSteadyCountdown, msToNextSecond } from '@/components/shared/AnimatedNumber'

/**
 * The focus timer, as a pill that morphs into a rounded block.
 *
 * Anatomy follows Cult UI's Timer (compound parts — icon, display, progress,
 * controls — with a tabular clock so the digits never jitter). The morph is one
 * surface at two sizes: the pill widens and its corners open up while the
 * block's body springs down out of it, anchored at the top so the header bar is
 * never pushed around.
 *
 * While it is running it says *what* it is timing. Quiz → "Quiz", a project
 * open → "Coding", read mode → "Reading". A bare 24:31 does not tell you
 * whether the clock is counting your revision or your scrolling.
 */

const WORK = 25 * 60
const BREAK = 5 * 60

const ACTIVITY: Record<ActivityKind, { label: string; icon: React.ElementType; tone: string }> = {
  idle: { label: 'Focus', icon: Timer, tone: 'var(--primary)' },
  quiz: { label: 'Quiz', icon: GraduationCap, tone: 'var(--secondary)' },
  coding: { label: 'Coding', icon: Code2, tone: 'var(--success)' },
  reading: { label: 'Reading', icon: BookOpen, tone: 'var(--warning)' },
  chat: { label: 'Research', icon: Sparkles, tone: 'var(--primary)' },
  flood: { label: 'Agent Flood', icon: Flame, tone: 'var(--danger)' },
  articles: { label: 'Writing', icon: Sparkles, tone: 'var(--primary)' },
  workflows: { label: 'Workflow', icon: Sparkles, tone: 'var(--primary)' },
}

export function fmtTime(s: number) {
  const mm = Math.floor(Math.max(0, s) / 60)
  const ss = Math.floor(Math.max(0, s) % 60)
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export function FocusPill() {
  const focus = useUI((s) => s.focus)
  const activity = useUI((s) => s.activity)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // The countdown. The displayed seconds come from `useSteadyCountdown`, which
  // re-anchors to the next wall-clock second instead of sampling on an interval
  // — that is what removes the double-count and the stutter on the digit roll.
  // The store is written only when the second actually changes, so nothing
  // re-renders 500 times a minute.
  useEffect(() => {
    if (!focus.running || !focus.endsAt) return
    const endsAt = focus.endsAt
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const f = useUI.getState().focus
      if (!f.endsAt) return
      const left = Math.max(0, (f.endsAt - Date.now()) / 1000)
      const remaining = Math.ceil(left)
      if (remaining !== f.remaining) {
        useUI.setState({ focus: { ...f, remaining } })
        useUI.setState((s) => ({ island: s.island.kind === 'focus' || s.island.kind === 'idle' ? { kind: 'focus', remaining, total: f.total } : s.island }))
      }
      if (left <= 0) {
        const next = f.mode === 'work' ? 'break' : 'work'
        const total = next === 'work' ? WORK : BREAK
        useUI.getState().toast(
          f.mode === 'work' ? 'Focus complete' : 'Break over',
          f.mode === 'work' ? '5 minute break — you can leave the desk.' : 'Back to it.',
          'success',
        )
        useUI.setState({ focus: { running: true, endsAt: Date.now() + total * 1000, remaining: total, total, mode: next } })
        return
      }
      timer = setTimeout(tick, msToNextSecond(f.endsAt) + 12)
    }
    tick()
    // A throttled background tab must not leave a stale clock on return.
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [focus.running, focus.endsAt])

  // The number the pill shows, animated (Skiper 37 / Number Flow).
  const steady = useSteadyCountdown(focus.endsAt, focus.running, focus.remaining)

  // Click-away closes the block, the way a menu does.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const start = () => {
    const total = focus.mode === 'work' ? WORK : BREAK
    useUI.setState({ focus: { running: true, endsAt: Date.now() + focus.remaining * 1000, remaining: focus.remaining, total: focus.total || total, mode: focus.mode } })
  }
  const pause = () => useUI.setState({ focus: { ...focus, running: false, endsAt: null } })
  const reset = () => useUI.setState({ focus: { running: false, endsAt: null, remaining: WORK, total: WORK, mode: 'work' } })
  const skip = () => {
    const next = focus.mode === 'work' ? 'break' : 'work'
    const total = next === 'work' ? WORK : BREAK
    useUI.setState({ focus: { running: true, endsAt: Date.now() + total * 1000, remaining: total, total, mode: next } })
  }
  const toggle = () => setOpen((o) => !o)

  const pct = focus.total > 0 ? Math.max(0, Math.min(1, focus.remaining / focus.total)) : 1
  const act = ACTIVITY[activity.kind] ?? ACTIVITY.idle
  const ActIcon = act.icon
  const label = activity.label ?? act.label
  const running = focus.running
  const clock = fmtTime(focus.remaining)

  return (
    /**
     * Top-anchored, and that is a fix rather than a preference: the pill lives
     * in a 48px bar at the very top of the window, so a block that grew around
     * its centre pushed its own title row — and the top of the clock — off the
     * screen. It grows *down* from where the pill already sits.
     */
    <div
      ref={wrapRef}
      className="relative self-start transition-[margin] duration-200"
      style={{ marginTop: open ? 6 : 9 }}
      data-focus-timer
    >
      <motion.div
        layout
        data-focus-pill
        data-open={open ? 'true' : 'false'}
        data-running={running ? 'true' : 'false'}
        // The morph: the pill opens up into the block. Width springs, the
        // corners round off, and it stays top-anchored so the bar never reflows.
        animate={{ width: open ? 264 : 'auto', borderRadius: open ? 20 : 999 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="glass relative z-10 flex flex-col items-stretch overflow-hidden"
        style={{
          border: `1px solid ${running ? `color-mix(in srgb, ${act.tone} 45%, transparent)` : 'var(--surface-border)'}`,
          boxShadow: running ? `0 0 0 3px color-mix(in srgb, ${act.tone} 12%, transparent)` : 'none',
        }}
      >
        {/* Header row — a pill when closed, the block's title bar when open. */}
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={running ? `${label} timer running, ${clock} left. Open the timer.` : 'Open the focus timer'}
          className={`flex items-center gap-2 text-left ${open ? 'px-3.5 pt-3 pb-2.5' : 'px-3 py-1.5'}`}
        >
          <Timer size={14} strokeWidth={1.6} style={{ color: running ? act.tone : 'var(--text-2)' }} />
          <span className="text-[12px] font-mono flex items-center" style={{ color: running ? 'var(--text)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }} data-focus-clock>
            <AnimatedNumber value={Math.floor(steady / 60)} minIntegerDigits={1} ariaLabel={undefined} />
            <span aria-hidden>:</span>
            <AnimatedNumber value={steady % 60} minIntegerDigits={2} ariaLabel={undefined} />
          </span>
          {/* What the clock belongs to — the point of the label. */}
          {(running || open) && (
            <span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: act.tone }} data-focus-context>
              <ActIcon size={11} strokeWidth={2} /> {label}
            </span>
          )}
          {running && !open && <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: act.tone, color: act.tone }} />}
          {open && <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-3)' }}>{focus.mode === 'work' ? 'Focus' : 'Break'}</span>}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5">
                {/* How much time is left, in the two forms you actually read:
                    the exact clock and a bar you can feel at a glance. */}
                <div className="flex items-end justify-center mb-2.5">
                  <span className="text-[42px] leading-none font-semibold flex items-center" style={{ letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }} data-focus-clock-large>
                    <AnimatedNumber value={Math.floor(steady / 60)} minIntegerDigits={1} />
                    <span aria-hidden>:</span>
                    <AnimatedNumber value={steady % 60} minIntegerDigits={2} />
                  </span>
                  <span className="ml-2 mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>left</span>
                </div>

                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--elevated)' }} role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Time left">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${act.tone}, color-mix(in srgb, ${act.tone} 55%, var(--secondary)))` }}
                    initial={false}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.5, ease: 'linear' }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={running ? pause : start}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[12px] text-[13px] font-medium"
                    style={{ background: 'var(--primary)', color: '#fff' }}
                    aria-label={running ? 'Pause' : 'Start'}
                  >
                    {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause' : 'Start'}
                  </button>
                  <button onClick={skip} className="p-2 rounded-[12px]" style={{ background: 'var(--elevated)' }} aria-label="Skip to next interval" title="Skip">
                    <SkipForward size={15} />
                  </button>
                  <button onClick={reset} className="p-2 rounded-[12px]" style={{ background: 'var(--elevated)' }} aria-label="Reset timer" title="Reset">
                    <RotateCcw size={15} />
                  </button>
                </div>

                <p className="text-[10.5px] mt-2.5 text-center" style={{ color: 'var(--text-3)' }}>
                  {running ? `Counting down while you are in ${label.toLowerCase()}.` : 'Pairs with Read & Quiz study sessions.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
