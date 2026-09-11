import React from 'react'
import { motion } from 'framer-motion'

/** HeroUI-style switch. */
export function Switch({
  checked, onChange, label, description, size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  description?: string
  size?: 'sm' | 'md'
}) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const knob = size === 'sm' ? 16 : 20

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      {(label || description) && (
        <div className="min-w-0">
          {label && <div className="text-[13.5px] font-medium">{label}</div>}
          {description && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{description}</div>}
        </div>
      )}
      <button
        role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 rounded-full transition-colors"
        style={{ width: w, height: h, background: checked ? 'var(--primary)' : 'var(--elevated)', border: '1px solid var(--surface-border)' }}
      >
        <motion.span
          className="absolute rounded-full bg-white"
          style={{ width: knob, height: knob, top: (h - knob) / 2 - 1, boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
          animate={{ left: checked ? w - knob - 3 : 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        />
      </button>
    </div>
  )
}
