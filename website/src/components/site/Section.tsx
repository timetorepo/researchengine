import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * The page's shared rhythm: eyebrow, title, one line of context.
 *
 * Two decisions are deliberate, because both were visible bugs on the page
 * before this file existed:
 *
 *   • The eyebrow is a small line of letterspaced type, not a pill. A pill above
 *     a heading is the shape every generated landing page has, and at large
 *     heading sizes a pill with its own margins is also the thing that ends up
 *     sitting on top of the heading's first line.
 *   • Entrances fade opacity only. No `y` transform on text: a transformed text
 *     layer, mid-scroll, on a page that also has backdrop blur, is what produced
 *     the doubled headline a visitor saw. Opacity cannot double-paint.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 text-[12px] font-medium tracking-[0.18em] text-[var(--text-3)] uppercase', className)}>
      {children}
    </div>
  )
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      transition={{ delay: reduced ? 0 : delay, duration: 0.55, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-60px' }}
      whileInView={{ opacity: 1 }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'center',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold [text-wrap:balance]">{title}</h2>
      {lead ? <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)] sm:text-base">{lead}</p> : null}
    </Reveal>
  )
}

/** A whole `<section>` with the same heading treatment, for the simple cases. */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className,
  align = 'center',
}: {
  id: string
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
  className?: string
  align?: 'center' | 'left'
}) {
  return (
    <section className={cn('site-section scroll-mt-24', className)} id={id}>
      <div className="site-shell">
        <SectionHeading align={align} eyebrow={eyebrow} lead={lead} title={title} />
        {children}
      </div>
    </section>
  )
}
