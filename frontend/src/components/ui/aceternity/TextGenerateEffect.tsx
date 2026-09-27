import React, { useEffect } from 'react'
import { motion, useAnimate } from 'framer-motion'

/** Aceternity-style text generate effect — words materialize with blur + rise. */
export function TextGenerateEffect({
  text, duration = 0.9, delay = 0, className = '', as: Tag = 'div', once = true,
}: {
  text: string
  duration?: number
  delay?: number
  className?: string
  as?: any
  once?: boolean
}) {
  const words = text.split(/\s+/)
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (!scope.current) return
    animate(
      'span[data-word]',
      { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
      { duration: duration * 0.4, delay: (i) => delay + i * (duration / words.length), ease: 'easeOut' },
    )
  }, [text])

  return (
    <Tag ref={scope} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span
          key={i}
          data-word
          aria-hidden
          className="inline-block mr-[0.28em] will-change-transform"
          style={{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(4px)' }}
        >
          {w}
        </span>
      ))}
    </Tag>
  )
}
