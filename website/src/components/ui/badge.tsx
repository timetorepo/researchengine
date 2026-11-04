import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A small pill: the hero's licence line, a card's tag, the version chips. */
export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'brand' | 'green'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium',
        tone === 'neutral' && 'border-[var(--surface-border)] bg-white/5 text-[var(--text-2)]',
        tone === 'brand' && 'border-[rgba(124,92,255,0.35)] bg-[rgba(124,92,255,0.14)] text-[#c4b5fd]',
        tone === 'green' && 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[#86efac]',
        className,
      )}
    >
      {children}
    </span>
  )
}
