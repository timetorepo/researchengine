import React, { useEffect, useMemo } from 'react'
import { useUI } from '@/stores/useUI'

export function StarField() {
  const ui = useUI()

  const stars = useMemo(() =>
    Array.from({ length: 90 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 60 + 30,
      delay: -Math.random() * 80,
      opacity: Math.random() * 0.7 + 0.15,
    })), [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') ui.set({ starfield: false }) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="starfield" aria-hidden>
      {stars.map((s) => (
        <span key={s.id} className="star" style={{
          left: `${s.left}%`, width: s.size, height: s.size, opacity: s.opacity,
          animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`, top: '-4vh',
        }} />
      ))}
    </div>
  )
}
