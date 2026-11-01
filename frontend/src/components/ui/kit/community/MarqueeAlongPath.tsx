/**
 * Marquee along an SVG path: words scroll continuously along a curve. The path
 * is drawn in the component, so it works at any width. Still under reduced motion.
 */
import { useReducedMotion } from 'motion/react'

export function MarqueeAlongPath({ words, className = '' }: { words: string[]; className?: string }) {
  const reduce = useReducedMotion()
  const text = words.join('  ·  ') + '  ·  '
  return (
    <svg viewBox="0 0 800 160" className={`w-full h-auto ${className}`} role="img" aria-label={words.join(', ')}>
      <defs>
        <path id="marquee-path" d="M -40 110 C 160 10, 360 150, 560 60 S 820 40, 860 90" fill="none" />
      </defs>
      <text fill="var(--text-2)" fontSize="22" letterSpacing="1">
        <textPath href="#marquee-path" startOffset="0">
          {text}
          {!reduce && <animate attributeName="startOffset" from="0%" to="-100%" dur="26s" repeatCount="indefinite" />}
        </textPath>
      </text>
    </svg>
  )
}
