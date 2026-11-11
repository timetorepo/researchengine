/**
 * Adaptive quality: what this machine can actually hold.
 *
 * "It can get laggy sometimes" is not one bug, and it is not fixable by making
 * everything lighter for everyone — the app has animated backgrounds, thinking
 * orbs, canvas effects and a live stream of tokens, and on a fast machine those
 * are the point. The lag appears on slower machines, in a virtualised GPU, on
 * battery, or when something else owns the CPU for a while.
 *
 * So instead of guessing, this measures: a short sample of real frame deltas
 * while the app is running, taken a few seconds after startup and re-taken when
 * the window comes back, never more often than once a minute. From the median
 * frame time it derives a level, and the animated canvases read that level
 * before deciding how much to draw. Everything degrades smoothly — no feature
 * is switched off behind the user's back, and the numbers are shown in
 * Settings → Performance, with a Re-measure button and a way to turn the whole
 * idea off.
 *
 * The loop: rAF while sampling (~2 s), then silence. Nothing here polls.
 */
import { useEffect, useState } from 'react'
import { useStore } from '@/stores/useStore'

export type FrameLevel = 'full' | 'reduced' | 'minimal'

export interface FrameHealth {
  /** Median frames per second over the sample. */
  fps: number
  /** Median frame time, ms. */
  frameMs: number
  level: FrameLevel
  samples: number
  measuredAt: number
  /** Why the level is what it is, in words, for the settings panel. */
  reason: string
}

const DEFAULT: FrameHealth = { fps: 0, frameMs: 0, level: 'full', samples: 0, measuredAt: 0, reason: 'not measured yet' }

let health: FrameHealth = DEFAULT
const listeners = new Set<(h: FrameHealth) => void>()
let sampling = false
let lastSampleAt = 0
let raf = 0

export function frameHealth(): FrameHealth {
  return health
}

/** What a canvas should do right now. `minimal` means: draw one static frame. */
export function frameLevel(): FrameLevel {
  const s = useStore.getState().settings
  if (s.adaptiveQuality === false) return 'full'
  if (s.reduceMotion) return 'minimal'
  return health.level
}

export function subscribeFrameHealth(fn: (h: FrameHealth) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function publish(next: Partial<FrameHealth>) {
  health = { ...health, ...next, measuredAt: Date.now() }
  for (const fn of listeners) fn(health)
}

/** React binding for the settings panel. */
export function useFrameHealth(): FrameHealth {
  const [h, setH] = useState(health)
  useEffect(() => subscribeFrameHealth(setH), [])
  return h
}

/**
 * The level as React state, so a canvas that reads it re-renders when the
 * measurement lands — a downgrade four seconds after startup has to reach the
 * layers that are already running.
 */
export function useFrameLevel(): FrameLevel {
  const [level, setLevel] = useState<FrameLevel>(() => frameLevel())
  useEffect(() => subscribeFrameHealth(() => setLevel(frameLevel())), [])
  return level
}

/**
 * Take one sample, then stop.
 *
 * The first 30 frames after navigation are noise — a route chunk is still
 * decoding, fonts are settling — so they are dropped and the median of what
 * follows is used. Median, not mean: one 400 ms GC pause should not condemn a
 * machine to a permanent downgrade.
 */
export function measureFrameBudget(samples = 90, opts: { minIntervalMs?: number } = {}): void {
  if (typeof window === 'undefined' || sampling) return
  const minInterval = opts.minIntervalMs ?? 60_000
  if (lastSampleAt && Date.now() - lastSampleAt < minInterval) return
  if (document.visibilityState === 'hidden') return
  sampling = true
  const deltas: number[] = []
  let previous = 0
  let warmup = 30

  const tick = (now: number) => {
    if (previous) {
      if (warmup > 0) warmup -= 1
      else if (document.visibilityState === 'visible') deltas.push(now - previous)
    }
    previous = now
    if (deltas.length >= samples) {
      finish()
      return
    }
    raf = requestAnimationFrame(tick)
  }

  const finish = () => {
    sampling = false
    lastSampleAt = Date.now()
    cancelAnimationFrame(raf)
    if (deltas.length < 10) {
      publish({ reason: 'the window was hidden for most of the sample' })
      return
    }
    const sorted = [...deltas].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const frameMs = Math.round(median * 10) / 10
    const fps = Math.round(1000 / median)
    // 60 Hz gives ~16.7 ms. Between 16.7 and 22 the machine is holding, but
    // with no headroom; past 34 ms (under 30 fps) the expensive layers go.
    const level: FrameLevel = median > 34 ? 'minimal' : median > 22 ? 'reduced' : 'full'
    publish({
      fps, frameMs, level, samples: deltas.length,
      reason: level === 'full'
        ? 'frames arrive comfortably; everything is drawn'
        : level === 'reduced'
          ? 'frames arrive late under load — glow layers are thinned'
          : 'frames are slow here — animated layers freeze to a still frame',
    })
  }

  raf = requestAnimationFrame(tick)
}

/**
 * Start watching, once per app run: after startup, and again when the window
 * returns from being hidden (a laptop that was asleep, or a machine that was
 * busy with something else, is a different machine now).
 */
export function watchFrameBudget(): () => void {
  const kick = () => { window.setTimeout(() => measureFrameBudget(), 4000) }
  kick()
  const onVisible = () => { if (document.visibilityState === 'visible') measureFrameBudget() }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    cancelAnimationFrame(raf)
  }
}

/** Manual re-measure from Settings → Performance. */
export function remeasure(): void {
  lastSampleAt = 0
  publish({ reason: 'measuring…' })
  measureFrameBudget(90, { minIntervalMs: 0 })
}
