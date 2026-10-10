/**
 * Smooth scrolling, with Lenis.
 *
 * Two decisions worth naming:
 *
 *   • A visitor who asked their system for less motion gets the browser's own
 *     scrolling. No instance is created at all, so nothing has to be animated
 *     back down.
 *   • Every in-page anchor goes through `scrollToSection`, so a link does not
 *     jump while the rest of the page eases. When Lenis is not running the page
 *     is reached by computing an offset and calling `window.scrollTo` — this
 *     repository deliberately bans `scrollIntoView` in app code, because it
 *     scrolls every ancestor and has caused real bugs here.
 */
import Lenis from 'lenis'

const NAV_OFFSET = -84

let instance: Lenis | null = null
let frame = 0

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function initSmoothScroll(): Lenis | null {
  if (typeof window === 'undefined') return null
  if (instance) return instance
  if (prefersReducedMotion()) return null

  instance = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    lerp: 0.11,
  })

  const raf = (time: number) => {
    instance?.raf(time)
    frame = requestAnimationFrame(raf)
  }
  frame = requestAnimationFrame(raf)

  document.documentElement.classList.add('lenis', 'lenis-smooth')
  // Exposed for the site test (and for anyone poking at it in the console).
  ;(window as unknown as Record<string, unknown>).__lenis = instance
  return instance
}

export function destroySmoothScroll() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  instance?.destroy()
  instance = null
  document.documentElement.classList.remove('lenis', 'lenis-smooth')
}

/**
 * Stop the page moving, for as long as a dialog is open.
 *
 * Lenis keeps its own transform loop, so hiding the body scroller is not enough:
 * without stopping the instance the page underneath a modal keeps easing. Both
 * are undone by `resumeSmoothScroll`, and neither needs a Lenis instance to
 * exist (a visitor who prefers reduced motion has none).
 */
export function pauseSmoothScroll() {
  if (typeof window === 'undefined') return
  instance?.stop()
  document.documentElement.style.overflow = 'hidden'
}

export function resumeSmoothScroll() {
  if (typeof window === 'undefined') return
  instance?.start()
  document.documentElement.style.removeProperty('overflow')
}

/** Scroll to a section by id, with the sticky header's height taken off. */
export function scrollToSection(id: string) {
  if (typeof window === 'undefined') return
  const target = document.getElementById(id)
  if (!target) return
  const top = target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET
  if (instance) {
    instance.scrollTo(top, { duration: 1.1 })
    return
  }
  window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
