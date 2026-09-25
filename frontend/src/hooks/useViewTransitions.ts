import { flushSync } from 'react-dom'
import { isWarm, loaderFor, prefetchRoute, routePathOf } from '@/lib/routes/registry'
import { useUI } from '@/stores/useUI'

/**
 * Navigation that moves — and can never get in the way.
 *
 * React Router navigates by pushing history and re-rendering: instant, but
 * silent. The View Transitions API (Chrome/Edge 111+, Safari 18+) lets the
 * browser snapshot the old frame, snapshot the new one, and animate between
 * them, which gives the app: the page cross-fading and rising instead of
 * cutting, the sidebar and top bar standing still (they are named in
 * globals.css), and the active nav marker travelling between rows.
 *
 * Rules that keep this safe, after two rounds of it misbehaving:
 *
 *   1. The push is synchronous. A navigation never waits for anything, so a
 *      click always moves and an older click can never win a race with a newer
 *      one.
 *   2. A transition only runs when the destination chunk is ALREADY in hand.
 *      Animating into a Suspense skeleton is what froze the frame over an inert
 *      page; hovering a nav row prefetches, so in practice it is warm by then.
 *   3. Only one transition at a time, and every transition has a deadline —
 *      `skipTransition()` ends it and the app carries on.
 *
 * When any of that cannot be guaranteed the router simply navigates: no
 * animation is worth a page that does not load.
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
      const path = routePathOf(String(args[2] ?? ''))
      const load = loaderFor(path)

      // A cold chunk is fetched beside the navigation, never in front of it:
      // this keeps the hairline honest and warms the route for next time.
      if (load && !isWarm(path)) {
        useUI.setState({ routeLoading: path })
        void prefetchRoute(path).then(() => {
          if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
        })
      }

      const canAnimate =
        !!doc.startViewTransition &&
        !prefersReduced() &&
        doc.visibilityState !== 'hidden' &&
        // Rule 2: never animate into a page that is still a skeleton.
        isWarm(path)

      if (!canAnimate) {
        original(...args)
        return
      }
      startTransition(doc, () => {
        try { flushSync(() => original(...args)) } catch { original(...args) }
      })
    }) as History['pushState']
  }
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
