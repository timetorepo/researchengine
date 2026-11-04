import React from 'react'
import './cards.css'

/**
 * A card with a slowly turning coloured rim. The rim is a conic gradient
 * behind the card body, so only the edge glows. Reduced motion stops the turn.
 */
export function GlowBorderCard({
  title = 'Ready when you are',
  children,
  a = '#ff9a3c',
  b = '#ffd166',
}: {
  title?: string
  children?: React.ReactNode
  a?: string
  b?: string
}) {
  return (
    <section
      data-ui="glow-border-card"
      aria-label={title}
      className="re-glow-border w-full max-w-[320px] p-5"
      style={{ ['--glow-a' as string]: a, ['--glow-b' as string]: b, background: 'var(--surface)' }}
    >
      <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
      <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {children ?? 'The rim turns slowly to show the card is live. It stops when the system asks for less motion.'}
      </div>
    </section>
  )
}

export default GlowBorderCard
