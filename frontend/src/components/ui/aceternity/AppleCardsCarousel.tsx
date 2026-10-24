/**
 * Apple Cards Carousel — Aceternity UI, vendored (R16).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/apple-cards-carousel-demo
 *
 * Source: toukoum/portfolio → src/components/projects/apple-cards-carousel.tsx
 * Provenance + upstream digest: frontend/scripts/aceternity-sources.json
 * (`node frontend/scripts/aceternity-vendor.mjs --verify` re-checks it).
 *
 * Local patches — upstream is a Next.js marketing carousel:
 *   • `next/image` → a plain `<img>` with lazy loading and a blur-up class, and
 *     `@tabler/icons-react` → lucide-react, because neither belongs in this bundle;
 *   • `useOutsideClick` is a local hook instead of a `@/hooks` import that does
 *     not exist here;
 *   • a card can carry **art instead of a photo** (`art`), which is how this app
 *     uses it: every card is drawn from its own theme tokens, so no stock
 *     photography ends up in a privacy-first research tool;
 *   • the expanded panel is `--surface`/`--text`, not `bg-white dark:bg-neutral-900`,
 *     and the backdrop is this app's `--scrim`;
 *   • the scroll wheel is not captured — the carousel scrolls horizontally like
 *     the rest of this app, and Escape closes the open card.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppleCard = {
  /** Optional image. Prefer `art` when the card should not use a stock photo. */
  src?: string
  title: string
  category: string
  content: React.ReactNode
  /** Drawn artwork for the card face — any node, themed by the caller. */
  art?: React.ReactNode
}

const CarouselContext = createContext<{ onCardClose: (index: number) => void; currentIndex: number }>({
  onCardClose: () => {},
  currentIndex: 0,
})

/** Local patch: upstream imports this from a hooks folder this app does not have. */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      onOutside()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [ref, onOutside])
}

const CARD_WIDTH = 224
const CARD_GAP = 16

export const Carousel = ({ items, initialScroll = 0 }: { items: React.ReactNode[]; initialScroll?: number }) => {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = initialScroll
      checkScrollability()
    }
  }, [initialScroll])

  const checkScrollability = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
    }
  }

  const scrollBy = (direction: 1 | -1) => {
    carouselRef.current?.scrollBy({ left: direction * (CARD_WIDTH + CARD_GAP), behavior: 'smooth' })
  }

  const handleCardClose = (index: number) => {
    carouselRef.current?.scrollTo({ left: (CARD_WIDTH + CARD_GAP) * index, behavior: 'smooth' })
    setCurrentIndex(index)
  }

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <div className="relative w-full">
        <div
          ref={carouselRef}
          onScroll={checkScrollability}
          className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex flex-row justify-start gap-4 pl-1">
            {items.map((item, index) => (
              <motion.div
                key={`card-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.12 * index, ease: 'easeOut' } }}
                className="snap-start last:pr-6"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <button
            aria-label="Previous card"
            className="grid h-9 w-9 place-items-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Next card"
            className="grid h-9 w-9 place-items-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </CarouselContext.Provider>
  )
}

export const Card = ({ card, index, layout = false }: { card: AppleCard; index: number; layout?: boolean }) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { onCardClose } = useContext(CarouselContext)
  const reduce = useReducedMotion()

  const handleClose = useCallback(() => {
    setOpen(false)
    onCardClose(index)
  }, [index, onCardClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') handleClose() }
    if (!open) return
    window.addEventListener('keydown', onKeyDown)
    // Remember what the body was doing: a marketing page can just set it back
    // to 'auto', an app shell cannot.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, handleClose])

  useOutsideClick(containerRef, handleClose)

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] h-screen overflow-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 h-full w-full"
              style={{ background: 'var(--scrim)', backdropFilter: 'blur(14px)' }}
            />
            <motion.div
              ref={containerRef}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              layoutId={layout ? `card-${card.title}` : undefined}
              className="relative z-[71] mx-auto my-10 h-fit w-[92vw] max-w-3xl rounded-3xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            >
              <div className="sticky top-4 z-[72] flex justify-end px-6 pt-6">
                <button
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 pt-1 md:px-10">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--primary)' }}>
                  {card.category}
                </p>
                <p className="mt-3 text-[26px] font-semibold md:text-[38px]" style={{ letterSpacing: '-0.02em' }}>
                  {card.title}
                </p>
              </div>

              <div className="px-6 pb-10 pt-5 md:px-10">{card.content}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button
        layoutId={layout ? `card-${card.title}` : undefined}
        onClick={() => setOpen(true)}
        whileHover={reduce ? undefined : { y: -3 }}
        className="relative z-10 flex h-[300px] w-56 flex-col items-start justify-between overflow-hidden rounded-3xl text-left"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
      >
        {/* The art, whatever the caller drew — a themed diagram, a gradient, an SVG. */}
        <div className="absolute inset-0 z-0">{card.art}</div>
        {card.src && (
          <img
            alt={card.title}
            className="absolute inset-0 z-0 h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={card.src}
          />
        )}
        {/* Legibility scrim: the label sits on top of whatever the art is. */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 h-3/5"
          style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--bg) 88%, transparent), transparent)' }}
        />
        <div className="relative z-20 p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--primary)' }}>
            {card.category}
          </p>
          <p className="mt-1.5 max-w-[190px] text-[19px] font-semibold leading-tight [text-wrap:balance]">
            {card.title}
          </p>
        </div>
      </motion.button>
    </>
  )
}

/** Kept so anything importing the upstream name still resolves. */
export const BlurImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [loading, setLoading] = useState(true)
  return (
    <img
      alt={alt}
      className={cn('transition duration-300', loading ? 'blur-sm' : 'blur-0', className)}
      decoding="async"
      loading="lazy"
      onLoad={() => setLoading(false)}
      src={src}
    />
  )
}
