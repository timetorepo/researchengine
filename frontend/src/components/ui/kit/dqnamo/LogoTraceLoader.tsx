import { RE_SYMBOL_PATH, RE_SYMBOL_VIEWBOX } from '@/lib/brand'
// dqnamo-style logo trace loader. The ResearchEngine mark is drawn as a stroke
// that traces each outline, loops while `loading`, then fills in when
// `isComplete` goes true and calls `onDone` once the fill has finished.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

// Shared selected identity. Pixel-sized stroke props are scaled to its source viewBox.
export const RE_LOGO_PATHS = [RE_SYMBOL_PATH]
export const RE_LOGO_FILLS = ['var(--primary)']

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
    <svg role="img" aria-label={ariaLabel} width={size} height={size} viewBox={RE_SYMBOL_VIEWBOX} fill="none">

      {RE_LOGO_PATHS.map((d, i) => (
        <g key={d}>
          <motion.path d={d} pathLength={1} stroke="var(--primary, #6C8EEF)" strokeWidth={strokeWidth * 5.5}
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
