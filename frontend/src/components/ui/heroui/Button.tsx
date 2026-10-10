import React from 'react'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type Variant = 'solid' | 'bordered' | 'flat' | 'ghost' | 'shadow'
type Color = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'default'
type Size = 'sm' | 'md' | 'lg'

const COLORS: Record<Color, { solid: React.CSSProperties; fg: string }> = {
  primary: { solid: { background: 'var(--primary)' }, fg: 'var(--primary)' },
  secondary: { solid: { background: 'var(--secondary)' }, fg: 'var(--secondary)' },
  success: { solid: { background: 'var(--success)' }, fg: 'var(--success)' },
  danger: { solid: { background: 'var(--danger)' }, fg: 'var(--danger)' },
  warning: { solid: { background: 'var(--warning)' }, fg: 'var(--warning)' },
  default: { solid: { background: 'var(--elevated)' }, fg: 'var(--text-2)' },
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[12px] rounded-[8px]',
  md: 'px-4 py-2 text-[13px] rounded-[14px]',
  lg: 'px-6 py-2.5 text-[14px] rounded-[14px]',
}

export function Button({
  children, variant = 'solid', color = 'primary', size = 'md', isLoading = false, disabled = false,
  onClick, className = '', fullWidth = false, startContent, type = 'button',
}: {
  children: React.ReactNode
  variant?: Variant
  color?: Color
  size?: Size
  isLoading?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  fullWidth?: boolean
  startContent?: React.ReactNode
  type?: 'button' | 'submit'
}) {
  const c = COLORS[color]
  const style: React.CSSProperties = {}
  if (variant === 'solid' || variant === 'shadow') {
    Object.assign(style, c.solid, { color: color === 'default' ? 'var(--text)' : '#fff' })
    if (variant === 'shadow') style.boxShadow = `0 8px 24px -8px color-mix(in srgb, ${c.fg} 55%, transparent)`
  } else if (variant === 'bordered') {
    style.border = `1px solid color-mix(in srgb, ${c.fg} 55%, transparent)`
    style.color = c.fg
  } else if (variant === 'flat') {
    style.background = `color-mix(in srgb, ${c.fg} 14%, transparent)`
    style.color = c.fg
  } else {
    style.color = c.fg
  }

  return (
    <motion.button
      type={type}
      whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors select-none',
        SIZES[size],
        fullWidth && 'w-full',
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        className,
      )}
      style={style}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin" /> : startContent}
      {children}
    </motion.button>
  )
}
