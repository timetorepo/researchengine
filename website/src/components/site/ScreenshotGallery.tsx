/**
 * The screenshot gallery.
 *
 * Clicking the folder of attachments, or any "see the screenshots" button, opens
 * every picture of the app in one dialog. It has two modes, because both are
 * genuinely useful and neither replaces the other:
 *
 *   • **All four at once** (what it opens on). Every screenshot is fully visible,
 *     uncropped, with its caption: you can see the whole product without
 *     clicking anything. This is also the mode that works on a phone, where a
 *     one-at-a-time carousel hides three quarters of what you came to look at.
 *   • **One at a time** — Aceternity's embla carousel, opened on whichever
 *     picture was clicked, with arrow keys, arrows, and a thumbnail strip.
 *
 * Details that matter for something covering the whole page:
 *
 *   • it is a real dialog — Escape closes it, arrow keys change slide in focus
 *     mode, Tab stays inside, focus goes back to whatever opened it;
 *   • the page behind it stops scrolling, including Lenis, which otherwise keeps
 *     easing the page underneath a modal;
 *   • every picture is `object-contain`, so a screenshot is never cropped to fit
 *     the frame it is being shown in.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutGrid, Maximize2, SquareStack, X } from 'lucide-react'
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

  return (
    <GalleryContext.Provider value={{ open, close, isOpen: index !== null }}>
      {children}
      <GalleryDialog index={index} onClose={close} />
    </GalleryContext.Provider>
  )
}

function GalleryDialog({ index, onClose }: { index: number | null; onClose: () => void }) {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(index ?? 0)
  const [mode, setMode] = useState<'all' | 'focus'>('all')
  const dialog = useRef<HTMLDivElement | null>(null)
  const open = index !== null

  // Keep the counter and the dots in step with the carousel, including when it is
  // moved by a drag rather than by a button.
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
    if (!open) return
    setCurrent(index ?? 0)
    // Every visit starts showing all of them.
    setMode('all')
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
      if (mode === 'focus') {
        if (event.key === 'ArrowRight') api?.scrollNext()
        if (event.key === 'ArrowLeft') api?.scrollPrev()
      }
      if (event.key === 'Tab') {
        // A short focus trap: everything focusable in the dialog is in it, so Tab
        // wraps rather than escaping to the page behind.
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
  }, [open, onClose, api, mode])

  if (typeof document === 'undefined') return null

  const focusOn = (i: number) => {
    setMode('focus')
    window.setTimeout(() => api?.scrollTo(i, true), 0)
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-label="Screenshots of Research Engine"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex flex-col bg-[rgba(4,3,8,0.9)] backdrop-blur-md"
          exit={{ opacity: 0 }}
          id="screenshot-gallery"
          initial={{ opacity: 0 }}
          ref={dialog}
          role="dialog"
          transition={{ duration: 0.22 }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="text-[13px] text-[var(--text-2)]">
              {mode === 'focus' ? (
                <>
                  <span className="text-foreground">
                    Screenshot {current + 1} of {SCREENS.length}
                  </span>
                  <span className="mx-2 text-[var(--text-3)]">·</span>
                  <span>{SCREENS[current]?.caption}</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">
                    All {SCREENS.length} screenshots
                  </span>
                  <span className="mx-2 text-[var(--text-3)]">·</span>
                  <span>The shipped app, not a mockup</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/5 px-3.5 py-2 text-[12.5px] text-[var(--text-2)] transition-colors hover:border-[rgba(124,92,255,0.45)] hover:text-foreground"
                onClick={() => setMode(mode === 'all' ? 'focus' : 'all')}
                type="button"
              >
                {mode === 'all' ? (
                  <>
                    <SquareStack className="h-3.5 w-3.5" /> One at a time
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" /> Show all {SCREENS.length}
                  </>
                )}
              </button>
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
          </div>

          {mode === 'all' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-8" data-lenis-prevent>
              <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2">
                {SCREENS.map((screen, i) => (
                  <button
                    className="group flex flex-col overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[rgba(11,9,19,0.6)] p-2 text-left transition-colors hover:border-[rgba(124,92,255,0.45)]"
                    key={screen.id}
                    onClick={() => focusOn(i)}
                    type="button"
                  >
                    {/* Capped at a third of the viewport so both rows of the 2x2
                        grid land on screen together: the point of this mode is
                        seeing all four at once, not scrolling between them.
                        `object-contain` means the cap never crops a picture. */}
                    <img
                      alt={screen.alt}
                      className="max-h-[33vh] w-full rounded-lg bg-[#0b0913] object-contain"
                      height={675}
                      src={screen.src}
                      width={900}
                    />
                    <span className="flex items-center justify-between gap-3 px-1.5 pt-2.5 pb-1">
                      <span className="text-[12.5px] leading-snug text-[var(--text-2)]">{screen.caption}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--text-3)] transition-colors group-hover:text-[#c4b5fd]">
                        <Maximize2 className="h-3 w-3" /> Full size
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mx-auto mt-5 max-w-3xl text-center text-[12px] leading-relaxed text-[var(--text-3)]">
                Four pictures of the app this page offers for download. Click one to see it on its own, at full size.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
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
