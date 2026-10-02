import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * One section heading, animated once when it scrolls into view. Every section on
 * the page uses this, so the rhythm (eyebrow, title, one line of context) is
 * identical everywhere and the animation cannot drift between them.
 */
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
    <section id={id} className={cn('site-section scroll-mt-24', className)}>
      <div className="site-shell">
        <motion.header
          className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {eyebrow ? (
            <div
              className={cn(
                'mb-4 text-[12px] font-medium tracking-[0.18em] text-[var(--text-3)] uppercase',
                align === 'center' && 'mx-auto',
              )}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold">{title}</h2>
          {lead ? <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)] sm:text-base">{lead}</p> : null}
        </motion.header>
        {children}
      </div>
    </section>
  )
}
