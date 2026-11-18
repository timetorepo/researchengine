/* Adapted from the custom-brand branch of BoardUI social-button (MIT, 2026 Mertcan Dundar Esmergul). */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
/** No implied OAuth: callers own connection state and authentication. */
export function BoardSocialButton({ icon, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return <button type="button" {...props} className={`bui-button inline-flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden disabled:opacity-60 ${className}`}>
    <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden="true">{icon}</span><span className="truncate">{children}</span>
  </button>
}
