/**
 * A button with a dotted border. On hover it only takes a grey fill: it does
 * not grow or expand. Used for secondary actions.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function DotBorderButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 ${className}`}
      style={{ border: '1.5px dotted var(--text-3)', color: 'var(--text-2)', background: 'transparent', ...(rest.style ?? {}) }}
    >
      {children}
    </button>
  )
}
