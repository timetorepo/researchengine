// Portal carousel: slides step through a "portal" — the outgoing slide shrinks
// and blurs away while the next one rises out of the centre. Arrow keys and the
// dots move between slides.
// Inspired by Hyperiux Vault's "Portal Carousel" on 21st.dev
// (https://21st.dev/@hyperiux/components/portal-carousel). Rebuilt here from its
// description; it is not a copy of the upstream source.
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export interface PortalSlide { title: string; body: ReactNode }

export function PortalCarousel({ slides, label = 'Carousel' }: { slides: PortalSlide[]; label?: string }) {
  const [i, setI] = useState(0)
  const count = slides.length
  const go = (n: number) => setI((n + count) % count)
  return (
    <section aria-roledescription="carousel" aria-label={label} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1) }}
      className="relative mx-auto w-full max-w-[520px] select-none">
      <div className="relative h-[190px] overflow-hidden rounded-[18px]" style={{ perspective: 900 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.25, filter: 'blur(10px)' }}
            transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute inset-0 flex flex-col justify-center rounded-[18px] p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <div className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{slides[i].title}</div>
            <div className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{slides[i].body}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button type="button" aria-label="Previous slide" onClick={() => go(i - 1)} className="px-2 text-[13px]" style={{ color: 'var(--text-3)' }}>←</button>
        {slides.map((s, n) => (
          <button key={s.title} type="button" aria-label={`Slide ${n + 1}: ${s.title}`} aria-current={n === i}
            onClick={() => setI(n)} className="h-1.5 rounded-full transition-all"
            style={{ width: n === i ? 18 : 6, background: n === i ? 'var(--primary)' : 'var(--surface-border)' }} />
        ))}
        <button type="button" aria-label="Next slide" onClick={() => go(i + 1)} className="px-2 text-[13px]" style={{ color: 'var(--text-3)' }}>→</button>
      </div>
    </section>
  )
}
