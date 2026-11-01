/**
 * Letter swap: on hover (or focus), each letter rolls up and a fresh copy rolls
 * in beneath it, one letter after another. Plain text stays readable for
 * screen readers because the animated copy is hidden from them.
 */
import { useState } from 'react'

export function LetterSwap({ text, className = '' }: { text: string; className?: string }) {
  const [active, setActive] = useState(false)
  return (
    <span
      className={`inline-block ${className}`}
      aria-label={text}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={0}
    >
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden className="relative inline-block overflow-hidden align-bottom" style={{ height: '1.2em', lineHeight: '1.2em' }}>
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: active ? 'translateY(-100%)' : 'translateY(0)', transitionDelay: `${i * 22}ms` }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
          <span
            className="absolute left-0 top-full inline-block transition-transform duration-300"
            style={{ transform: active ? 'translateY(-100%)' : 'translateY(0)', transitionDelay: `${i * 22}ms`, color: 'var(--primary)' }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        </span>
      ))}
    </span>
  )
}
