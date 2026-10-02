import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,#ffffff)] shadow-[0_10px_40px_-12px_rgba(124,92,255,0.9)]',
  secondary: 'bg-white text-[#0b0913] hover:bg-white/90',
  outline: 'border border-[var(--surface-border)] text-foreground hover:bg-white/5',
  ghost: 'text-[var(--text-2)] hover:text-foreground hover:bg-white/5',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-full gap-1.5',
  md: 'h-11 px-5 text-sm rounded-full gap-2',
  lg: 'h-13 px-7 text-[15px] rounded-full gap-2.5',
}

export interface ButtonProps extends React.ComponentPropsWithoutRef<'a'> {
  variant?: Variant
  size?: Size
}

/** A link that looks like a button. Every action on this page is a link to a file or a section. */
export function ButtonLink({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 select-none',
        'hover:-translate-y-0.5 active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
