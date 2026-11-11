/**
 * Colourful Text — Aceternity UI, vendored (R16).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/colourful-text-demo
 *
 * Source: cRED-f/QuestGen-AI-Agent → components/ui/colourful-text.tsx
 * (byte-identical to xlibs-components@1.0.13/dist/components/aceternity/colourful-text.js,
 * which is the compiled upstream file).
 * Provenance + upstream digest: frontend/scripts/aceternity-sources.json
 * (`node frontend/scripts/aceternity-vendor.mjs --verify` re-checks it).
 *
 * Local patches — upstream is written for a light/dark-only site with a fixed
 * palette:
 *   • the ramp is rotated by one step per beat instead of `sort(() => Math.random() - 0.5)`,
 *     which is a hydration mismatch and can hand a letter the same colour twice;
 *   • reduce-motion renders the text once and leaves it alone;
 *   • `className` is passed through, so callers keep this app's typography.
 */
import React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** The palette upstream ships with: green → yellow → orange → red → purple → blue. */
export const COLOURFUL_TEXT_COLORS = [
  'rgb(131, 179, 32)',
  'rgb(47, 195, 106)',
  'rgb(42, 169, 210)',
  'rgb(4, 112, 202)',
  'rgb(107, 10, 255)',
  'rgb(183, 0, 218)',
  'rgb(218, 0, 171)',
  'rgb(230, 64, 92)',
  'rgb(232, 98, 63)',
  'rgb(249, 129, 47)',
]

export function ColourfulText({
  text,
  colors = COLOURFUL_TEXT_COLORS,
  className,
  interval = 5000,
}: {
  text: string
  colors?: string[]
  className?: string
  /** ms between colour shifts */
  interval?: number
}) {
  const reduce = useReducedMotion()
  const [rotation, setRotation] = React.useState(0)

  React.useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setRotation((r) => (r + 1) % colors.length), interval)
    return () => clearInterval(id)
  }, [colors.length, interval, reduce])

  if (reduce) {
    return <span className={cn('inline-block whitespace-pre font-sans tracking-tight', className)}>{text}</span>
  }

  return (
    <span aria-label={text} className={cn('inline-block', className)}>
      {text.split('').map((char, index) => (
        <motion.span
          // Keyed by position: the letter is the same letter, its colour moves.
          key={index}
          aria-hidden="true"
          animate={{ color: colors[(index + rotation) % colors.length], opacity: [1, 0.78, 1] }}
          className="inline-block whitespace-pre font-sans tracking-tight"
          transition={{ duration: 0.5, delay: (index % 12) * 0.03, ease: 'easeInOut' }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

export default ColourfulText
