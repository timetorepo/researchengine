// dqnamo-style logo trace loader. The ResearchEngine mark is drawn as a stroke
// that traces each outline, loops while `loading`, then fills in when
// `isComplete` goes true and calls `onDone` once the fill has finished.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

// Paths from public/icon.svg (the ResearchEngine mark, viewBox 0 0 32 32).
export const RE_LOGO_PATHS = ['M16 6 L25 12 L16 18 L7 12 Z', 'M16 14 L25 20 L16 26 L7 20 Z']
export const RE_LOGO_FILLS = ['#6C8EEF', '#A78BFA']

export function LogoTraceLoader({
  loading = true, isComplete = false, size = 48, strokeWidth = 1.2,
  loopDurationSeconds = 1.8, fillFadeSeconds = 0.5, onDone, ariaLabel = 'Loading',
}: {
  loading?: boolean; isComplete?: boolean; size?: number; strokeWidth?: number
  loopDurationSeconds?: number; fillFadeSeconds?: number; onDone?: () => void; ariaLabel?: string
}) {
  const [filled, setFilled] = useState(false)
  const doneRef = useRef(false)
  useEffect(() => { if (isComplete) setFilled(true) }, [isComplete])
  useEffect(() => {
    if (!filled || doneRef.current) return
    const t = setTimeout(() => { doneRef.current = true; onDone?.() }, fillFadeSeconds * 1000)
    return () => clearTimeout(t)
  }, [filled, fillFadeSeconds, onDone])

  return (
    <svg role="img" aria-label={ariaLabel} width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#0A0A0B" opacity={filled ? 1 : 0} />
      {RE_LOGO_PATHS.map((d, i) => (
        <g key={d}>
          <motion.path d={d} pathLength={1} stroke="var(--primary, #6C8EEF)" strokeWidth={strokeWidth}
            strokeLinejoin="round" fill="none"
            initial={{ pathLength: 0, opacity: 1 }}
            animate={filled ? { pathLength: 1, opacity: 0 } : loading ? { pathLength: [0, 1, 1], opacity: [1, 1, 0.2] } : { pathLength: 1 }}
            transition={filled ? { duration: fillFadeSeconds } : { duration: loopDurationSeconds, repeat: loading ? Infinity : 0, delay: i * 0.2, ease: 'easeInOut' }} />
          <motion.path d={d} fill={RE_LOGO_FILLS[i]} initial={{ opacity: 0 }}
            animate={{ opacity: filled ? (i === 1 ? 0.85 : 1) : 0 }} transition={{ duration: fillFadeSeconds }} />
        </g>
      ))}
    </svg>
  )
}
