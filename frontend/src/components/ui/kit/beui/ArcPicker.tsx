// Beui-style arc picker: options laid along an arc you wheel or drag through.
// The arc eases toward the target with a short spring, so scrolling stays smooth.
import { useEffect, useRef, useState } from 'react'

export type ArcOption<T extends string | number> = { value: T; label: string }

export function ArcPicker<T extends string | number>({ options, value, onChange, label = 'Choose' }: {
  options: ArcOption<T>[]; value: T; onChange: (v: T) => void; label?: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const [pos, setPos] = useState(index)
  const target = useRef(index)
  const raf = useRef(0)

  useEffect(() => { target.current = index }, [index])

  // Eased follow: position chases the target a fraction per frame.
  useEffect(() => {
    const step = () => {
      setPos((p) => {
        const d = target.current - p
        if (Math.abs(d) < 0.001) return target.current
        return p + d * 0.18
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const choose = (i: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, i))
    target.current = clamped
    if (options[clamped].value !== value) onChange(options[clamped].value)
  }

  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 4) return
    e.preventDefault()
    choose(index + (e.deltaY > 0 ? 1 : -1))
  }

  const span = Math.PI * 0.8
  return (
    <div role="radiogroup" aria-label={label} tabIndex={0} onWheel={onWheel}
      onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') choose(index + 1); if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') choose(index - 1) }}
      className="relative h-[120px] w-[220px] overflow-hidden rounded-[14px] outline-none focus-visible:ring-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'var(--surface-border)' }} />
      {options.map((o, i) => {
        const a = (i - pos) * (span / Math.max(1, options.length - 1)) - Math.PI / 2
        const x = 110 + Math.cos(a) * 150
        const y = 60 + Math.sin(a) * 90
        const dist = Math.abs(i - pos)
        const active = dist < 0.5
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => choose(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full text-[12px] whitespace-nowrap"
            style={{ left: x, top: y, opacity: Math.max(0.25, 1 - dist * 0.35), color: active ? 'var(--text)' : 'var(--text-2)', background: active ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent', fontWeight: active ? 600 : 400 }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
