// Block transition: a grid of colour blocks sweeps across the screen whenever
// `transitionKey` changes, hides the swap, then clears. Used between onboarding steps.
// Inspired by Hyperiux Vault's "Block Transition" on 21st.dev
// (https://21st.dev/@hyperiux/components/block-transition). Rebuilt here from its
// description; it is not a copy of the upstream source.
import { useEffect, useState } from 'react'

const COLS = 8
const ROWS = 5

export function BlockTransition({ transitionKey, duration = 0.9 }: { transitionKey: string | number; duration?: number }) {
  const [phase, setPhase] = useState<'idle' | 'run'>('idle')
  const [first, setFirst] = useState(true)

  useEffect(() => {
    if (first) { setFirst(false); return }
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    setPhase('run')
    const id = setTimeout(() => setPhase('idle'), duration * 1000 + 120)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey])

  if (phase === 'idle') return null
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => i)
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[60] grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
      {cells.map((i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const delay = (col + row * 0.6) * (duration / (COLS + ROWS))
        return (
          <span
            key={i}
            style={{
              background: (col + row) % 2 ? 'var(--primary)' : 'var(--secondary, var(--primary))',
              transformOrigin: 'center',
              animation: `hyperiux-block ${duration}s ease-in-out ${delay}s both`,
            }}
          />
        )
      })}
      <style>{'@keyframes hyperiux-block{0%{transform:scale(0)}45%,55%{transform:scale(1)}100%{transform:scale(0)}}'}</style>
    </div>
  )
}
