import { flushSync } from 'react-dom'

/**
 * Navigation that moves.
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
 * React 18 renders asynchronously, so the DOM update has to be forced to
 * complete inside the transition's callback — that is what `flushSync` is for.
 * Everything degrades to a plain navigation when the API is missing, when the
 * user asked for reduced motion, or if the browser throws.
 */

let installed = false

const prefersReduced = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function installViewTransitions() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return
  installed = true

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history)
    history[method] = ((...args: Parameters<History['pushState']>) => {
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
      if (!doc.startViewTransition || prefersReduced()) return original(...args)
      try {
        doc.startViewTransition(() => {
          try {
            flushSync(() => original(...args))
          } catch {
            // flushSync cannot run from inside a React lifecycle — the router
            // still gets its update, just without the synchronous flush.
            original(...args)
          }
        })
      } catch {
        // A transition that refuses to start must never block navigation.
        original(...args)
      }
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
