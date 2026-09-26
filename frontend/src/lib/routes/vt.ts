/**
 * View Transitions, wired so that a navigation can never be lost.
 *
 * The browser's View Transitions API wants the DOM change inside a callback it
 * runs *after* snapping the old frame. react-router, meanwhile, tells its
 * subscribers about a navigation **when `pushState` returns** — so if the push
 * itself is deferred into that callback, the listener reports the *old*
 * location, React renders the old page, and the URL quietly disagrees with the
 * screen. Every click then needs a second one, because by then `window.location`
 * already contains the path the listener will read. That bug shipped, and the
 * report was "I click it once and it denies; I click the same button again and
 * it works".
 *
 * So the order here is: **push first, always, in the same tick** — the router
 * sees the new location synchronously and React re-renders — and the
 * transition, when we can afford one, wraps that push and tells the browser to
 * wait for React to finish painting before it captures the new frame.
 *
 * A transition is only started when it is certain to be an improvement:
 *
 *   - the browser has the API, the tab is visible, and motion is not reduced;
 *   - the destination has already RENDERED once (`hasVisited`). A route's first
 *     render always suspends (React.lazy starts its import then throws the
 *     promise, however long ago the chunk was prefetched), and animating into a
 *     skeleton is what froze the frame in an earlier round.
 *
 * Nothing here is load-bearing for navigation itself. If the API misbehaves,
 * throws, or never finishes, `skipTransition()` ends it and the app carries on
 * on the page it already moved to.
 */

type VTDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void>; skipTransition?: () => void }
}

let active: { skipTransition?: () => void; finished?: Promise<void> } | null = null
/** How long a transition may hold the frame before we cut it short. */
export const TRANSITION_DEADLINE_MS = 600

const prefersReduced = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** End any transition still running, so the next one starts from a clean frame. */
export function skipRunningTransition() {
  try { active?.skipTransition?.() } catch { /* nothing to skip */ }
  active = null
}

/** The API exists and this frame is worth animating. */
export function canAnimateNow(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as VTDocument
  return !!doc.startViewTransition && !prefersReduced() && doc.visibilityState !== 'hidden'
}

/**
 * Run `update` — a navigation — inside a view transition.
 *
 * The callback returns a promise, so the browser keeps the old frame until
 * React has committed and painted the new one. That is the same job `flushSync`
 * is usually asked to do, without betting the navigation on a synchronous
 * render that can silently not happen.
 */
export function startNavigationTransition(update: () => void): void {
  if (typeof document === 'undefined') { update(); return }
  const doc = document as VTDocument
  if (!doc.startViewTransition) { update(); return }

  skipRunningTransition()
  try {
    const t = doc.startViewTransition(() => new Promise<void>((resolve) => {
      // The navigation itself: synchronous, in this tick, exactly as it would
      // be without a transition.
      update()
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))
    active = t
    const timer = setTimeout(() => {
      if (active === t) { try { t.skipTransition?.() } catch { /* already gone */ } ; active = null }
    }, TRANSITION_DEADLINE_MS)
    t.finished?.finally(() => {
      clearTimeout(timer)
      if (active === t) active = null
    })
  } catch {
    // The transition could not start — the navigation still must, so do it.
    active = null
    update()
  }
}
