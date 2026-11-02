import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, FastForward, Music, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import * as engine from '@/lib/music/engine'
import { useMusic, useMusicSync } from '@/stores/useMusic'
import { useStore } from '@/stores/useStore'

/**
 * Music control for the top bar. It appears only while music is playing and
 * disappears when playback stops. While it is shown it is a pill with the track
 * name and artist; press it and the same surface grows into a card with the full
 * transport: previous, play/pause, next, back and forward 10 seconds, repeat, a seek
 * bar, the album and mood, and volume.
 *
 * Playback itself only starts from a user action (browsers block autoplay), so the
 * way to start music is the play button in Settings → Appearance.
 */
const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const
const PILL_W = 220
const CARD_W = 300
const PILL_H = 36
const CARD_H = 196

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function MusicControl() {
  useMusicSync()
  const { playing, now, repeat, volume } = useMusic()
  const [expanded, setExpanded] = useState(false)
  const reduced = useStore((s) => s.settings.reduceMotion) ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const rootRef = useRef<HTMLDivElement>(null)

  // Collapse on an outside press or Escape, as the Dynamic Island does.
  useEffect(() => {
    if (!expanded) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setExpanded(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [expanded])

  // Nothing plays, nothing shows. The track's details come from the engine on every change.
  if (!playing || !now) return null

  const w = expanded ? CARD_W : PILL_W
  const h = expanded ? CARD_H : PILL_H
  const radius = expanded ? 22 : 999
  const transition = reduced ? { duration: 0.12 } : spring
  const repeatLabel = repeat === 'one' ? 'Repeat this track' : repeat === 'all' ? 'Repeat all' : 'Repeat off'
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat
  const btn = 'p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors'

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
                aria-label="Pause music"
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                <Pause size={13} fill="currentColor" strokeWidth={0} />
              </button>
              <span className="flex-1 min-w-0 leading-tight" title={`${now.title} · ${now.artist}`}>
                <span className="block text-[11.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{now.title}</span>
                <span className="block text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{now.artist}</span>
              </span>
              <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={!reduced ? 'wave-bar h-full' : 'w-[2.5px] rounded-sm'}
                    style={{ animationDelay: `${i * 150}ms`, background: 'var(--primary)' }} />
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
              className="flex flex-col gap-2 p-3 h-full"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary, var(--primary)))' }}>
                  <Music size={16} color="#fff" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate" style={{ letterSpacing: '-0.01em' }}>{now.title}</div>
                  <div className="text-[10.5px] truncate" style={{ color: 'var(--text-2)' }}>{now.artist} · {now.album}</div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
                    {now.mood} · {now.bpm} BPM · {now.number} of {now.count}
                  </div>
                </div>
                <button onClick={() => setExpanded(false)} aria-label="Collapse music controls" aria-expanded={true} className={btn} style={{ color: 'var(--text-3)' }}>
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Seek bar: a button per click position, so it works without a drag library. */}
              <div className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                <span className="w-7 text-right">{fmt(now.position)}</span>
                <button
                  className="flex-1 h-1.5 rounded-full relative cursor-pointer"
                  style={{ background: 'var(--elevated)' }}
                  aria-label="Seek"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    engine.seek(((e.clientX - r.left) / r.width) * now.duration)
                  }}
                >
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(now.position / now.duration) * 100}%`, background: 'var(--primary)' }} />
                </button>
                <span className="w-7">{fmt(now.duration)}</span>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => engine.prev()} aria-label="Previous track" className={btn} style={{ color: 'var(--text-2)' }}><SkipBack size={16} /></button>
                <button onClick={() => engine.skip(-10)} aria-label="Back 10 seconds" className={btn} style={{ color: 'var(--text-2)' }}>
                  <span className="text-[10px] font-semibold tabular-nums">−10</span>
                </button>
                <button
                  onClick={() => void engine.toggle()}
                  aria-label="Pause"
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  <Pause size={16} fill="currentColor" strokeWidth={0} />
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
