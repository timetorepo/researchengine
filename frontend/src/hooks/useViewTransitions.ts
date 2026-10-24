import { isWarm, loaderFor, prefetchRoute, routePathOf } from '@/lib/routes/registry'
import { useUI } from '@/stores/useUI'

/**
 * Route-change observer.
 *
 * This used to be the View Transitions layer, patching `history.pushState` and
 * running the push inside the transition callback. That deferral is what broke
 * navigation: react-router notifies its subscribers when `pushState` returns, so
 * a deferred push reported the *old* location, React rendered the old page, and
 * the second click only worked because by then `window.location` already held
 * the path the listener would read ("I click it once and it denies"). The
 * transition now lives where the navigation is decided — `lib/routes/vt.ts`,
 * called from `navigateNow` — and this patch does one thing only: it watches
 * every navigation (including ones that never pass through our helper) and
 * gives the UI its cold-route feedback.
 *
 * Rule, and it is the whole point: **call `original` first, in the same tick.**
 * Anything put in front of it is a navigation that can be lost.
 */

let installed = false

type PushState = History['pushState']

export function installViewTransitions() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return
  installed = true

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history) as PushState
    history[method] = ((...args: Parameters<PushState>) => {
      // 1. The navigation happens now, unconditionally.
      original(...args)

      // 2. Then the feedback: a cold route raises the hairline and starts its
      //    chunk beside the navigation, so the row you picked says it is
      //    loading and the fetch is warm for the next visit.
      const path = routePathOf(String(args[2] ?? ''))
      const load = loaderFor(path)
      if (load && !isWarm(path)) {
        useUI.setState({ routeLoading: path })
        void prefetchRoute(path).then(() => {
          if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
        })
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
