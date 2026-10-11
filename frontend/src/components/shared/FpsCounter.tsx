import { useEffect, useState } from 'react'
import { useStore } from '@/stores/useStore'

/**
 * A frames-per-second counter, drawn over the app when Settings → Performance
 * turns it on. It counts animation frames over one-second windows, so it
 * reports what the browser actually painted, and it stops listening entirely
 * when it is off.
 */
export function FpsCounter() {
  const on = useStore((s) => s.settings.showFps === true)
  const [fps, setFps] = useState<number | null>(null)

  useEffect(() => {
    if (!on) return
    let raf = 0
    let frames = 0
    let windowStart = performance.now()
    const tick = (now: number) => {
      frames += 1
      const elapsed = now - windowStart
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed))
        frames = 0
        windowStart = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])

  if (!on) return null
  const tone = fps === null ? 'var(--text-3)' : fps >= 55 ? '#34D399' : fps >= 30 ? '#FBBF24' : '#F87171'
  return (
    <div
      role="status"
      aria-label="Frames per second"
      className="pointer-events-none fixed top-2 right-2 z-[9999] rounded-md px-2 py-1 font-mono text-[11px] tabular-nums"
      style={{ background: 'rgba(0,0,0,0.6)', color: tone }}
    >
      {fps === null ? '… fps' : `${fps} fps`}
    </div>
  )
}
