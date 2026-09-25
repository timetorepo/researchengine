import { flushSync } from 'react-dom'
import { loaderFor, preloadRoute, routePathOf } from '@/lib/routes/registry'
import { useUI } from '@/stores/useUI'

/**
 * Navigation that moves — and never gets in the way.
 *
 * React Router navigates by pushing history and re-rendering. That is instant
 * but silent: the page you leave and the page you arrive at are simply swapped,
 * and nothing about the interface acknowledges that you went *back* rather than
 * forward.
 *
 * The View Transitions API (Chrome/Edge 111+, Safari 18+) lets the browser
 * snapshot the old frame, snapshot the new one, and animate between them. We
 * wrap the router's own history calls, which is enough to get:
 *
 *   • the page cross-fading and rising instead of cutting,
 *   • the sidebar and top bar *staying put* (they are named, see globals.css),
 *   • the active nav marker travelling from the old item to the new one.
 *
 * Three rules keep this from ever becoming a trap (the "I click a page and it
 * glitches, then finally lets me in" report):
 *
 *   1. The destination chunk is fetched FIRST, while the current page is still
 *      live and clickable. A transition never starts on top of a Suspense
 *      fallback, so there is no inert frozen frame to wait out.
 *   2. Only one transition runs at a time. A second navigation skips the first
 *      instead of stacking, because a stacked transition is what leaves the
 *      old snapshot painted over an unresponsive page.
 *   3. Every transition has a deadline. If the browser never finishes (a busy
 *      frame, a background tab), `skipTransition()` ends it and the app carries
 *      on — the same state a browser without the API would be in.
 *
 * Everything degrades to a plain navigation when the API is missing, when the
 * user asked for reduced motion, or if the browser throws.
 */

let installed = false
let active: { skipTransition?: () => void; finished?: Promise<void> } | null = null
/** How long a transition may hold the frame before we cut it short. */
const TRANSITION_DEADLINE_MS = 600

const prefersReduced = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void>; skipTransition?: () => void } }

/** End any transition still running, so the next one starts from a clean frame. */
export function skipRunningTransition() {
  try { active?.skipTransition?.() } catch { /* nothing to skip */ }
  active = null
}

function startTransition(doc: VTDocument, update: () => void) {
  skipRunningTransition()
  try {
    const t = doc.startViewTransition!(update)
    active = t
    // Rule 3: a transition may never outlive this deadline.
    const timer = setTimeout(() => {
      if (active === t) { try { t.skipTransition?.() } catch { /* already gone */ } ; active = null }
    }, TRANSITION_DEADLINE_MS)
    t.finished?.finally(() => {
      clearTimeout(timer)
      if (active === t) active = null
    })
  } catch {
    active = null
    update()
  }
}

export function installViewTransitions() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return
  installed = true

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history)
    history[method] = ((...args: Parameters<History['pushState']>) => {
      const doc = document as VTDocument
      const url = String(args[2] ?? '')
      const path = routePathOf(url)
      const load = loaderFor(path)

      if (!doc.startViewTransition || prefersReduced() || doc.visibilityState === 'hidden') {
        // No transition: still make sure the chunk is coming. Suspense handles
        // it, and the old page stays interactive until React swaps.
        if (load) {
          useUI.setState({ routeLoading: path })
          void preloadRoute(path).then(() => {
            if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
          })
        }
        return original(...args)
      }

      if (!load) {
        startTransition(doc, () => {
          try { flushSync(() => original(...args)) } catch { original(...args) }
        })
        return
      }

      // Rule 1: the chunk first — the current page keeps working meanwhile.
      useUI.setState({ routeLoading: path })
      void preloadRoute(path).then(() => {
        if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
        // The user may have navigated again while the chunk was loading.
        if (routePathOf(window.location.href) !== routePathOf(currentHref())) return
        startTransition(doc, () => {
          try { flushSync(() => original(...args)) } catch { original(...args) }
        })
      })
    }) as History['pushState']
  }
}

/** The router's current location (hash included), for stale-checking. */
function currentHref() {
  return typeof window === 'undefined' ? '' : window.location.href
}

/**
 * The list of DOM nodes that must keep their identity across a navigation —
 * giving them a view-transition-name makes the browser animate *them* rather
 * than cross-fading their pixels. Only one element may hold a given name at a
 * time, so each name here is unique in the frame.
 */
export const VT = {
  topbar: 're-vt-topbar',
  sidebar: 're-vt-sidebar',
  navIndicator: 're-nav-indicator',
} as const
