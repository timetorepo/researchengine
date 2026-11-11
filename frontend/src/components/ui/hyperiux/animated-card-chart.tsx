// Animated card chart: a card of bars that grow to their values when the card
// comes into view. Shows a set of labelled figures side by side.
// Inspired by badtzx0's "Animated Card Chart" on 21st.dev
// (https://21st.dev/@badtzx0/components/animated-card-chart). Rebuilt here from its
// description; it is not a copy of the upstream source.
import { useEffect, useRef, useState } from 'react'

export interface ChartBar { label: string; value: number; display: string; highlight?: boolean }

export function AnimatedCardChart({ title, bars }: { title: string; bars: ChartBar[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const max = Math.max(1, ...bars.map((b) => b.value))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="rounded-[16px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</div>
      <div className="mt-4 flex items-end gap-3 h-[150px]">
        {bars.map((b, i) => (
          <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <div className="text-[11px] mb-1 tabular-nums" style={{ color: 'var(--text-2)' }}>{b.display}</div>
            <div
              className="w-full rounded-t-[8px]"
              style={{
                height: shown ? `${(b.value / max) * 100}%` : '0%',
                transition: `height 0.9s cubic-bezier(.2,.7,.2,1) ${i * 0.12}s`,
                background: b.highlight ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 30%, var(--surface))',
              }}
            />
            <div className="text-[11px] mt-2 truncate max-w-full" style={{ color: 'var(--text-3)' }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
