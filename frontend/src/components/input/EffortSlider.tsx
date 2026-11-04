/**
 * Thinking-effort slider for the prompt bar, in ChatGPT's style: a hairline
 * track with a dot per step, a white thumb that rides it, and the step labels
 * set under the track with the current one lit. The steps come from the
 * provider's own vocabulary (see EFFORT_SETS in InputBar), so Medium / High /
 * Max are whatever that provider actually offers.
 *
 * Pointer: press anywhere on the track and drag. Keyboard: arrows, Home, End.
 */
import React, { useRef, useState } from 'react'

export interface EffortStep { id: string; label: string; hint: string }

/** Which step a horizontal position lands on. Pure, so it can be tested. */
export function indexFromX(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0
  const t = Math.min(1, Math.max(0, x / width))
  return Math.round(t * (count - 1))
}

/** The step after moving `delta` from `index`, clamped to the ladder. */
export function stepIndex(index: number, delta: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index + delta))
}

export function EffortSlider({ steps, value, onChange }: {
  steps: EffortStep[]
  value: string
  onChange: (id: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const current = Math.max(0, steps.findIndex((s) => s.id === value))
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? current
  const n = steps.length
  const pct = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * 100)

  const pick = (i: number) => { if (steps[i] && steps[i].id !== value) onChange(steps[i].id) }
  const fromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return current
    return indexFromX(clientX - rect.left, rect.width, n)
  }

  return (
    <div className="w-[248px] select-none" style={{ color: 'var(--text)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>Thinking effort</span>
        <span className="text-[12px] font-semibold">{steps[shown]?.label}</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Thinking effort"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={current}
        aria-valuetext={steps[current]?.label}
        className="relative h-6 cursor-pointer touch-none outline-none focus-visible:ring-2 rounded-full mx-2"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(fromEvent(e.clientX))
        }}
        onPointerMove={(e) => {
          const i = fromEvent(e.clientX)
          setHover(dragging.current ? null : i)
          if (dragging.current) pick(i)
        }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          const map: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }
          if (e.key in map) { e.preventDefault(); pick(stepIndex(current, map[e.key], n)) }
          if (e.key === 'Home') { e.preventDefault(); pick(0) }
          if (e.key === 'End') { e.preventDefault(); pick(n - 1) }
        }}
      >
        {/* hairline track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
          style={{ background: 'var(--surface-border)' }} />
        {/* filled part up to the current step */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-[width] duration-150"
          style={{ width: `${pct(current)}%`, background: 'var(--text-2)' }} />
        {/* a dot per step */}
        {steps.map((s, i) => (
          <span key={s.id} className="absolute top-1/2 w-[5px] h-[5px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${pct(i)}%`, background: i <= current ? 'var(--text-2)' : 'var(--text-3)' }} />
        ))}
        {/* thumb */}
        <span className="absolute top-1/2 w-[16px] h-[16px] rounded-full -translate-x-1/2 -translate-y-1/2 transition-[left] duration-150 pointer-events-none"
          style={{
            left: `${pct(current)}%`,
            background: 'var(--text)',
            boxShadow: '0 0 0 4px color-mix(in srgb, var(--text) 12%, transparent), 0 2px 6px rgb(0 0 0 / .3)',
          }} />
      </div>

      <div className="relative h-4 mt-2.5 mx-2">
        {steps.map((s, i) => (
          <button key={s.id} type="button" tabIndex={-1}
            onClick={() => pick(i)}
            className="absolute -translate-x-1/2 text-[11px] whitespace-nowrap transition-colors"
            style={{
              left: `${pct(i)}%`,
              color: i === current ? 'var(--text)' : 'var(--text-3)',
              fontWeight: i === current ? 600 : 400,
              transform: i === 0 ? 'translateX(0)' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-snug" style={{ color: 'var(--text-3)' }}>
        {steps[shown]?.hint}
      </p>
    </div>
  )
}
