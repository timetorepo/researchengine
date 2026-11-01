import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, EyeOff, FastForward, Music, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import * as engine from '@/lib/music/engine'
import { useMusic, useMusicSync } from '@/stores/useMusic'
import { useStore } from '@/stores/useStore'

/**
 * Music control for the top bar. A pill with play/pause and the track name; press
 * it and the same surface grows into a card with the transport: previous, play,
 * next, fast-forward 10 seconds, repeat, plus volume and hide.
 *
 * The morph uses the same spring as the Dynamic Island, so the two read as one
 * family. The width is fixed, so the header never reflows while it opens.
 */
const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const
const PILL_W = 176
const CARD_W = 300
const PILL_H = 36
const CARD_H = 168

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function MusicControl() {
  useMusicSync()
  const { playing, index, repeat, volume, duration, expanded, setExpanded } = useMusic()
  const reduced = useStore((s) => s.settings.reduceMotion) ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const rootRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(0)
  const track = engine.TRACKS[index]

  // Poll the position only while something is moving; nothing runs when paused and collapsed.
  useEffect(() => {
    const read = () => setPos(engine.position())
    read()
    if (!playing && !expanded) return
    const id = window.setInterval(read, 250)
    return () => window.clearInterval(id)
  }, [playing, expanded, index])

  // Collapse on an outside press, as the Dynamic Island does.
  useEffect(() => {
    if (!expanded) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setExpanded(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [expanded, setExpanded])

  const w = expanded ? CARD_W : PILL_W
  const h = expanded ? CARD_H : PILL_H
  const radius = expanded ? 22 : 999
  const transition = reduced ? { duration: 0.12 } : spring
  const repeatLabel = repeat === 'one' ? 'Repeat this track' : repeat === 'all' ? 'Repeat all' : 'Repeat off'
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  const btn = 'p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors'
  const PlayIcon = playing ? Pause : Play

  return (
    <div ref={rootRef} className="relative shrink-0" style={{ width: PILL_W, height: PILL_H }} data-ui="music-control">
      <motion.div
        animate={{ width: w, height: h, borderRadius: radius }}
        transition={transition}
        className="glass absolute right-0 top-0 overflow-hidden"
        style={{ border: '1px solid var(--surface-border)', boxShadow: '0 10px 36px -12px rgba(0,0,0,0.55)', width: w, height: h, borderRadius: radius, zIndex: 40 }}
        role="region"
        aria-label="Music player"
      >
        <AnimatePresence mode="wait" initial={false}>
          {!expanded ? (
            <motion.div
              key="pill"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduced ? { duration: 0.12 } : spring}
              className="flex items-center gap-1.5 pl-1 pr-1.5 h-full"
            >
              <button
                onClick={() => void engine.toggle()}
                aria-label={playing ? 'Pause music' : 'Play music'}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                <PlayIcon size={13} fill="currentColor" strokeWidth={0} />
              </button>
              <span className="flex-1 min-w-0 text-[11.5px] truncate" style={{ color: 'var(--text-2)' }} title={track.mood}>
                {track.title}
              </span>
              <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={playing && !reduced ? 'wave-bar h-full' : 'w-[2.5px] rounded-sm'}
                    style={{ height: playing ? undefined : '35%', animationDelay: `${i * 150}ms`, background: 'var(--primary)' }} />
                ))}
              </span>
              <button onClick={() => setExpanded(true)} aria-label="Open music controls" aria-expanded={false} className={btn} style={{ color: 'var(--text-3)' }}>
                <ChevronDown size={14} className="rotate-180" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduced ? { duration: 0.12 } : spring}
              className="flex flex-col gap-2.5 p-3 h-full"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary, var(--primary)))' }}>
                  <Music size={16} color="#fff" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate" style={{ letterSpacing: '-0.01em' }}>{track.title}</div>
                  <div className="text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{track.mood}</div>
                </div>
                <button onClick={() => setExpanded(false)} aria-label="Collapse music controls" aria-expanded={true} className={btn} style={{ color: 'var(--text-3)' }}>
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Seek bar: a button per click position, so it works without a drag library. */}
              <div className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                <span className="w-7 text-right">{fmt(pos)}</span>
                <button
                  className="flex-1 h-1.5 rounded-full relative cursor-pointer"
                  style={{ background: 'var(--elevated)' }}
                  aria-label="Seek"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    engine.seek(((e.clientX - r.left) / r.width) * duration)
                  }}
                >
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(pos / duration) * 100}%`, background: 'var(--primary)' }} />
                </button>
                <span className="w-7">{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => engine.prev()} aria-label="Previous track" className={btn} style={{ color: 'var(--text-2)' }}><SkipBack size={16} /></button>
                <button onClick={() => engine.skip(-10)} aria-label="Back 10 seconds" className={btn} style={{ color: 'var(--text-2)' }}>
                  <span className="text-[10px] font-semibold tabular-nums">−10</span>
                </button>
                <button
                  onClick={() => void engine.toggle()}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  <PlayIcon size={16} fill="currentColor" strokeWidth={0} />
                </button>
                <button onClick={() => engine.skip(10)} aria-label="Fast forward 10 seconds" className={btn} style={{ color: 'var(--text-2)' }}><FastForward size={16} /></button>
                <button onClick={() => engine.next()} aria-label="Next track" className={btn} style={{ color: 'var(--text-2)' }}><SkipForward size={16} /></button>
                <button
                  onClick={() => engine.setRepeat(repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all')}
                  aria-label={repeatLabel}
                  title={repeatLabel}
                  className={btn}
                  style={{ color: repeat === 'off' ? 'var(--text-3)' : 'var(--primary)' }}
                >
                  <RepeatIcon size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Volume2 size={13} style={{ color: 'var(--text-3)' }} />
                <input
                  type="range" min={0} max={1} step={0.01} value={volume}
                  onChange={(e) => engine.setVolume(Number(e.target.value))}
                  aria-label="Music volume"
                  className="flex-1 accent-[var(--primary)]"
                />
                <button
                  onClick={() => { engine.pause(); useStore.setState((st) => ({ settings: { ...st.settings, showMusicControl: false } })) }}
                  aria-label="Hide the music control"
                  title="Hide the music control (turn it back on in Settings → Appearance)"
                  className={btn}
                  style={{ color: 'var(--text-3)' }}
                >
                  <EyeOff size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
