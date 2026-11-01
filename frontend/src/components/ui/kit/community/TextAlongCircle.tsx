/**
 * Text set on a circle. The words run around the path and slowly turn; under
 * reduced motion the ring stands still. Used as a decorative badge.
 */
import { useReducedMotion } from 'motion/react'

export function TextAlongCircle({ text, size = 120, className = '' }: { text: string; size?: number; className?: string }) {
  const reduce = useReducedMotion()
  const id = `tac-${size}-${text.length}`
  const r = size / 2 - 12
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label={text}>
      <defs>
        <path id={id} d={`M ${size / 2}, ${size / 2} m -${r}, 0 a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 -${2 * r},0`} />
      </defs>
      <g style={{ transformOrigin: '50% 50%', animation: reduce ? undefined : 'tac-spin 28s linear infinite' }}>
        <text fill="var(--text-2)" fontSize={size / 11} letterSpacing="2.2" style={{ textTransform: 'uppercase' }}>
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </g>
      <style>{'@keyframes tac-spin { to { transform: rotate(360deg) } }'}</style>
    </svg>
  )
}
