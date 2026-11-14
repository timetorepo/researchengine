import { BoardProgress } from '@/components/ui/boardui/Progress'
import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'

/**
 * The install film: a short looping animation shown while Research Engine sets
 * itself up on first run. It is an animation, not a recorded video file, and
 * it only ever shows real progress. The bar moves when a real check finishes,
 * and the stage label follows that bar, so the film cannot claim work that has
 * not happened.
 *
 * Three stages play in order:
 *   1 Unpacking   — the cards of your settings fan out and settle
 *   2 Connecting  — a signal runs from the logo to the local server
 *   3 Checking    — the ring closes and the tick appears when everything is done
 */

const STAGES = [
  { id: 'unpack', label: 'Unpacking your settings', sub: 'Theme, motion and layout' },
  { id: 'connect', label: 'Connecting to the local server', sub: 'Nothing leaves this device' },
  { id: 'check', label: 'Checking everything', sub: 'Each check reports when it finishes' },
] as const

export function InstallFilm({ progress, done, lastNote }: { progress: number; done: boolean; lastNote?: string }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamped = Math.max(0, Math.min(1, progress))
  const stage = done ? 2 : Math.min(2, Math.floor(clamped * 3))
  const current = STAGES[stage]
  const pct = Math.round((done ? 1 : clamped) * 100)

  return (
    <div
      role="progressbar"
      aria-label={`Setting up: ${current.label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-ui="install-film"
      className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[24px] p-5"
      style={{ background: 'color-mix(in srgb, var(--elevated) 70%, transparent)', border: '1px solid var(--surface-border)' }}
    >
      {/* Stage */}
      <div className="relative mx-auto h-[150px] w-full">
        {/* Stage 1: three cards fan out from the centre and settle */}
        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
          {[0, 1, 2].map((i) => {
            const spread = (i - 1) * 46
            const visible = stage >= 0
            return (
              <motion.span
                key={i}
                className="absolute h-[92px] w-[64px] rounded-[14px]"
                style={{ background: i === 1 ? 'var(--primary)' : 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 10px 24px -12px rgba(0,0,0,0.35)' }}
                initial={false}
                animate={{
                  x: reduce ? spread : stage === 0 && !reduce ? [0, spread, spread * 0.6, spread] : spread,
                  rotate: reduce ? 0 : (i - 1) * 9,
                  opacity: visible ? (stage >= 0 ? 0.95 : 0) : 0,
                  scale: stage === 2 ? 0.92 : 1,
                }}
                transition={{ duration: reduce ? 0 : 1.6, repeat: stage === 0 && !reduce ? Infinity : 0, ease: 'easeInOut' }}
              />
            )
          })}
        </div>

        {/* Stage 2: a signal runs from the logo to the server */}
        <motion.div className="absolute left-[12%] right-[12%] top-1/2 h-px" aria-hidden="true"
          style={{ background: 'var(--surface-border)' }} animate={{ opacity: stage >= 1 ? 1 : 0.25 }} />
        {!reduce && stage === 1 ? (
          <motion.span
            aria-hidden="true"
            className="absolute top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full"
            style={{ background: 'var(--primary)', boxShadow: '0 0 12px var(--primary)' }}
            initial={{ left: '12%', opacity: 0 }}
            animate={{ left: ['12%', '88%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}

        {/* Stage 3: the ring closes and the tick appears */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="50" fill="none" stroke="var(--surface-border)" strokeWidth="3" />
            <motion.circle
              cx="56" cy="56" r="50" fill="none" strokeWidth="3" strokeLinecap="round"
              stroke="var(--primary)"
              transform="rotate(-90 56 56)"
              initial={false}
              animate={{ pathLength: stage === 2 ? 1 : stage === 1 ? 0.55 : 0.2 }}
              transition={{ duration: reduce ? 0 : 0.6, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.span key="tick" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
                  <Check size={34} strokeWidth={2.4} style={{ color: 'var(--success)' }} />
                </motion.span>
              ) : (
                <motion.img key="logo" src="/icon.svg" alt="" width={46} height={46}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Caption: the stage the bar is in, then the last real check */}
      <div className="mt-3 text-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <div className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>{done ? 'All set' : current.label}</div>
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{lastNote ?? current.sub}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bar: moves only when a real check finishes */}
      <BoardProgress className="mt-4" label="Setup checks" value={pct} />
      <div className="mt-2 flex justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
        <span>{done ? 'Finished' : 'Working'}</span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}

export default InstallFilm
