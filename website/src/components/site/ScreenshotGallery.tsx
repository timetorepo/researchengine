/**
 * The screenshot gallery.
 *
 * Clicking the folder of attachments, or any "see the screenshots" button,
 * opens every picture full size in the carousel the round asked for
 * (Aceternity's embla carousel, vendored as `@/components/aceternity/Carousel`),
 * opening on the one that was clicked.
 *
 * Details that matter for something covering the whole page:
 *
 *   • it is a real dialog — Escape closes it, the arrows change slide, Tab stays
 *     inside, and focus goes back to whatever opened it;
 *   • the page behind it stops scrolling, including Lenis, which otherwise keeps
 *     easing the page underneath a modal;
 *   • the picture is `object-contain`, so a screenshot is never cropped to fit
 *     the frame it is being shown in.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Maximize2, X } from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/aceternity/Carousel'
import { SCREENS } from '@/data/screens'
import { pauseSmoothScroll, resumeSmoothScroll } from '@/lib/smooth-scroll'
import { cn } from '@/lib/utils'

interface GalleryContextValue {
  open: (index?: number) => void
  close: () => void
  isOpen: boolean
}

const GalleryContext = createContext<GalleryContextValue>({ open: () => {}, close: () => {}, isOpen: false })

export const useGallery = () => useContext(GalleryContext)

export function GalleryProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState<number | null>(null)
  const trigger = useRef<HTMLElement | null>(null)

  const open = useCallback((at = 0) => {
    trigger.current = (document.activeElement as HTMLElement) ?? null
    setIndex(Math.max(0, Math.min(at, SCREENS.length - 1)))
  }, [])

  const close = useCallback(() => {
    setIndex(null)
    trigger.current?.focus?.()
  }, [])

  const isOpen = index !== null

  return (
    <GalleryContext.Provider value={{ open, close, isOpen }}>
      {children}
      <GalleryDialog index={index} onClose={close} />
    </GalleryContext.Provider>
  )
}

function GalleryDialog({ index, onClose }: { index: number | null; onClose: () => void }) {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(index ?? 0)
  const dialog = useRef<HTMLDivElement | null>(null)
  const open = index !== null

  // Keep the dots and the counter in step with the carousel, including when it
  // is moved by a drag rather than by a button.
  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on('select', onSelect)
    onSelect()
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  useEffect(() => {
    if (open) setCurrent(index ?? 0)
  }, [index, open])

  // Scroll lock, including Lenis, and Escape / arrows.
  useEffect(() => {
    if (!open) return
    pauseSmoothScroll()
    document.documentElement.classList.add('gallery-open')

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowRight') api?.scrollNext()
      if (event.key === 'ArrowLeft') api?.scrollPrev()
      if (event.key === 'Tab') {
        // A short focus trap: the dialog has three or four stops and they are
        // all inside it, so Tab wraps rather than escaping to the page.
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        )
        if (!nodes || nodes.length === 0) return
        const list = [...nodes]
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !dialog.current?.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKey)
    const focusTimer = window.setTimeout(() => {
      dialog.current?.querySelector<HTMLElement>('[data-gallery-close]')?.focus()
    }, 60)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(focusTimer)
      resumeSmoothScroll()
      document.documentElement.classList.remove('gallery-open')
    }
  }, [open, onClose, api])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-label="Screenshots of Research Engine"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex flex-col bg-[rgba(4,3,8,0.88)] backdrop-blur-md"
          exit={{ opacity: 0 }}
          id="screenshot-gallery"
          initial={{ opacity: 0 }}
          ref={dialog}
          role="dialog"
          transition={{ duration: 0.22 }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="text-[13px] text-[var(--text-2)]">
              <span className="text-foreground">
                Screenshot {current + 1} of {SCREENS.length}
              </span>
              <span className="mx-2 text-[var(--text-3)]">·</span>
              <span>The shipped app, not a mockup</span>
            </div>
            <button
              aria-label="Close the screenshots"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] bg-white/5 text-[var(--text-2)] transition-colors hover:border-[rgba(124,92,255,0.45)] hover:text-foreground"
              data-gallery-close
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center px-3 sm:px-10">
            <Carousel
              className="w-full"
              initialScroll={index ?? 0}
              opts={{ align: 'center', loop: true, containScroll: 'keepSnaps' }}
              setApi={setApi}
            >
              <CarouselContent className="-ml-3 sm:-ml-4">
                {SCREENS.map((screen, i) => (
                  <CarouselItem className="pl-3 sm:pl-4" key={screen.id}>
                    <div className="mx-auto flex max-w-6xl flex-col items-center">
                      <img
                        alt={screen.alt}
                        className="max-h-[62vh] w-auto max-w-full rounded-xl border border-white/10 bg-[#0b0913] object-contain shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)] sm:max-h-[68vh]"
                        height={675}
                        src={screen.src}
                        width={900}
                      />
                      <p className="mt-4 max-w-2xl px-4 text-center text-[13px] leading-relaxed text-[var(--text-2)]">
                        {screen.caption}
                      </p>
                      <p className="sr-only">
                        Screenshot {i + 1} of {SCREENS.length}
                      </p>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-1 sm:-left-2" />
              <CarouselNext className="right-1 sm:-right-2" />
            </Carousel>
          </div>

          <div className="flex items-center justify-center gap-2 px-5 py-5 sm:px-8">
            {SCREENS.map((screen, i) => (
              <button
                aria-label={`Show screenshot ${i + 1}: ${screen.caption}`}
                aria-pressed={i === current}
                className={cn(
                  'h-10 w-16 overflow-hidden rounded-md border transition-all',
                  i === current
                    ? 'border-[rgba(124,92,255,0.7)] opacity-100'
                    : 'border-[var(--surface-border)] opacity-55 hover:opacity-90',
                )}
                key={screen.id}
                onClick={() => api?.scrollTo(i)}
                type="button"
              >
                <img alt="" className="h-full w-full object-cover" src={screen.src} />
              </button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/** The small button that opens the gallery, used wherever a section wants one. */
export function GalleryButton({
  children,
  className,
  index = 0,
}: {
  children?: React.ReactNode
  className?: string
  index?: number
}) {
  const { open } = useGallery()
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/5 px-4 py-2 text-[13px] text-[var(--text-2)] transition-colors hover:border-[rgba(124,92,255,0.45)] hover:text-foreground',
        className,
      )}
      onClick={() => open(index)}
      type="button"
    >
      <Maximize2 className="h-3.5 w-3.5" />
      {children ?? 'Open the screenshots'}
    </button>
  )
}
