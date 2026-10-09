import React from 'react'
import { motion } from 'motion/react'

/** Aceternity-style moving border — a light sweeps around the edge. */
export function MovingBorder({
  children, className = '', radius = 999, borderColor = 'conic-gradient(from 0deg, var(--primary), var(--secondary), transparent 40%, transparent 60%, var(--primary))',
  duration = 4, onClick, disabled,
}: {
  children: React.ReactNode
  className?: string
  radius?: number
  borderColor?: string
  duration?: number
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden p-[1.5px] ${className}`}
      style={{ borderRadius: radius, opacity: disabled ? 0.4 : 1 }}
    >
      {!disabled && (
        <motion.div
          aria-hidden
          className="absolute"
          style={{
            inset: '-150%',
            background: borderColor,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {disabled && <div aria-hidden className="absolute inset-0" style={{ background: 'var(--elevated)' }} />}
      <button
        onClick={onClick}
        disabled={disabled}
        className="relative w-full h-full disabled:cursor-not-allowed"
        style={{ borderRadius: radius - 1.5, background: 'var(--bg)' }}
      >
        {children}
      </button>
    </div>
  )
}
