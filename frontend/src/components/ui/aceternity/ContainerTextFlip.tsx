/**
 * Container Text Flip — Aceternity UI, vendored (R16).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/container-text-flip-demo
 *
 * Source: Najdi-AI/najd-ai-website → components/ui/container-text-flip.tsx
 * (the `animateLetters` revision of the same file kris70lesgo/asHelp has).
 * Provenance + upstream digest: frontend/scripts/aceternity-sources.json
 * (`node frontend/scripts/aceternity-vendor.mjs --verify` re-checks it).
 *
 * Local patches — upstream is a light/dark-only marketing container:
 *   • the faked bevel (grey gradients + inset shadows) is one theme-true
 *     surface: `--surface`, `--surface-border`, `--text` — it follows all
 *     thirteen themes instead of inventing a second palette;
 *   • the width animation measures with `scrollWidth + 30`, which collapsed the
 *     pill when the font had not loaded yet — it re-measures on `document.fonts.ready`
 *     and never goes below the longest word, so the box stops resizing mid-flip;
 *   • reduce-motion swaps words without animating them.
 */
import React, { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface ContainerTextFlipProps {
  /** Array of words to cycle through in the animation */
  words?: string[]
  /** Time in milliseconds between word transitions */
  interval?: number
  /** Additional CSS classes to apply to the container */
  className?: string
  /** Additional CSS classes to apply to the text */
  textClassName?: string
  /** Duration of the transition animation in milliseconds */
  animationDuration?: number
  /**
   * When true (default) the word is animated per-letter. Set to false for
   * scripts with cursive joining (e.g. Arabic) where splitting into
   * per-character spans breaks glyph shaping.
   */
  animateLetters?: boolean
}

export function ContainerTextFlip({
  words = ['better', 'modern', 'beautiful', 'awesome'],
  interval = 3000,
  className,
  textClassName,
  animationDuration = 700,
  animateLetters = true,
}: ContainerTextFlipProps) {
  const id = useId()
  const reduce = useReducedMotion()
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [width, setWidth] = useState<number | 'auto'>('auto')
  const textRef = useRef<HTMLSpanElement>(null)

  // Measure every word, not just the current one: the pill should be as wide as
  // the widest word it will ever show, so the flips never move the layout.
  useEffect(() => {
    const measure = () => {
      const node = textRef.current
      if (!node) return
      const widthOf = (word: string) => {
        const probe = document.createElement('span')
        probe.textContent = word
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;'
        probe.className = node.className
        probe.style.font = getComputedStyle(node).font
        document.body.appendChild(probe)
        const w = probe.getBoundingClientRect().width
        probe.remove()
        return w
      }
      const widest = Math.max(...words.map(widthOf), node.getBoundingClientRect().width)
      if (widest > 0) setWidth(Math.ceil(widest) + 30)
    }
    measure()
    // A webfont arriving late used to leave the measurement short.
    document.fonts?.ready.then(measure).catch(() => {})
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [words])

  useEffect(() => {
    if (words.length < 2) return
    const intervalId = setInterval(() => {
      setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length)
    }, interval)
    return () => clearInterval(intervalId)
  }, [words, interval])

  const word = words[currentWordIndex] ?? ''

  return (
    <motion.span
      layout
      layoutId={`words-here-${id}`}
      animate={reduce ? undefined : { width }}
      transition={{ duration: animationDuration / 2000, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'relative inline-block overflow-hidden rounded-[14px] px-4 pb-2.5 pt-2 text-center text-[28px] font-bold leading-tight',
        className,
      )}
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
    >
      <span ref={textRef} className={cn('inline-block', textClassName)}>
        {animateLetters && !reduce ? (
          <span className="inline-block">
            {word.split('').map((letter, index) => (
              <motion.span
                key={`${currentWordIndex}-${index}`}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ delay: index * 0.02 }}
                className="inline-block"
              >
                {letter === ' ' ? '\u00a0' : letter}
              </motion.span>
            ))}
          </span>
        ) : (
          <span>{word}</span>
        )}
      </span>
    </motion.span>
  )
}

export default ContainerTextFlip
