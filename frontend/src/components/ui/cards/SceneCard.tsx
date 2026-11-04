import React, { useState } from 'react'
import './cards.css'

/**
 * A light-control card: small tags on top, a title, a colour dot with an
 * intensity readout and an edit control, and a warm glow that rises from the
 * bottom edge as the intensity goes up. The layout follows the reference
 * card from the design brief (tags, large title, meta row, glow below).
 */
export function SceneCard({
  title = 'Workspace',
  tags = ['light', 'cabinet', 'scenario'],
  color = '#ff9a3c',
  initialIntensity = 64,
}: {
  title?: string
  tags?: string[]
  color?: string
  initialIntensity?: number
}) {
  const [intensity, setIntensity] = useState(initialIntensity)
  const glow = Math.max(0, Math.min(100, intensity)) / 100
  return (
    <section
      data-ui="scene-card"
      aria-label={`${title} light card`}
      className="relative w-full max-w-[320px] h-[330px] overflow-hidden rounded-[24px] border"
      style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', boxShadow: '0 12px 30px -18px rgba(0,0,0,0.35)' }}
    >
      <div
        className="re-scene-glow"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle, ${color} 0%, color-mix(in srgb, ${color} 55%, transparent) 40%, transparent 70%)`,
          opacity: 0.25 + glow * 0.75,
          transform: `translateX(-50%) scale(${0.7 + glow * 0.5})`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0 z-10 p-4 pb-3 rounded-t-[24px]"
        style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)', backdropFilter: 'blur(10px)' }}
      >
        <div className="text-[11px] tracking-wide" style={{ color: 'var(--text-3)' }}>
          {tags.join(' • ')}
        </div>
        <div className="mt-6 text-[22px] font-medium leading-tight" style={{ color: 'var(--text)' }}>{title}</div>
        <div className="mt-2 flex items-center justify-between text-[12px]" style={{ color: 'var(--text-2)' }}>
          <span className="flex items-center gap-1.5">
            color <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            intensity: <span className="tabular-nums">{intensity}%</span>
          </span>
          <label className="cursor-pointer" style={{ color: 'var(--text-3)' }}>
            edit
            <input
              type="range"
              min={0}
              max={100}
              value={intensity}
              aria-label="Intensity"
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="ml-2 w-16 align-middle"
            />
          </label>
        </div>
      </div>
    </section>
  )
}

export default SceneCard
