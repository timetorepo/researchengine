/**
 * Which chunk a URL needs — and getting it before we move.
 *
 * Every screen except Home is a `React.lazy` chunk, so the first visit to a
 * route has to fetch a file. Navigating *into* that fetch is what made a tap
 * feel broken: the router swapped in the Suspense skeleton, the View
 * Transitions API froze the old frame as a snapshot on top, and for the length
 * of the transition the page was inert — the "it glitches and then lets me in"
 * the user reported.
 *
 * The fix is to know the chunk up front: a navigation waits for the module
 * (milliseconds when warm, one import when cold) *while the current page stays
 * live and clickable*, and only then swaps. Nothing to freeze, nothing inert.
 */
import { useUI } from '@/stores/useUI'

type Loader = () => Promise<unknown>

/**
 * Path pattern → chunk. The patterns mirror the routes in App.tsx; a path that
 * matches nothing (Home, the wildcard redirect) needs no chunk at all.
 */
const ROUTES: { test: (path: string) => boolean; load: Loader }[] = [
  { test: (p) => p === '/chat' || p.startsWith('/chat/'), load: () => import('@/components/chat/ChatView') },
  { test: (p) => p.startsWith('/settings'), load: () => import('@/components/settings/SettingsView') },
  { test: (p) => p.startsWith('/flood'), load: () => import('@/components/agents/FloodView') },
  { test: (p) => p.startsWith('/quiz'), load: () => import('@/components/quiz/QuizHub') },
  { test: (p) => p.startsWith('/articles/'), load: () => import('@/components/articles/ArticleEditor') },
  { test: (p) => p.startsWith('/articles'), load: () => import('@/components/articles/ArticlesView') },
  { test: (p) => p.startsWith('/library'), load: () => import('@/components/library/LibraryView') },
  { test: (p) => p.startsWith('/compare'), load: () => import('@/components/compare/CompareView') },
  { test: (p) => p.startsWith('/workflows/'), load: () => import('@/components/workflows/WorkflowEditor') },
  { test: (p) => p.startsWith('/workflows'), load: () => import('@/components/workflows/WorkflowsList') },
  { test: (p) => p.startsWith('/code'), load: () => import('@/components/ide/CodingView') },
  { test: (p) => p.startsWith('/chats'), load: () => import('@/components/chats/ChatsView') },
  { test: (p) => p.startsWith('/secrets'), load: () => import('@/components/easter/SecretsRoute') },
]

/** The router path inside a location: hash routing, so `#/quiz` → `/quiz`. */
export function routePathOf(href: string): string {
  const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : href
  const path = hash.split('?')[0] || '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function loaderFor(path: string): Loader | null {
  return ROUTES.find((r) => r.test(path))?.load ?? null
}

/**
 * Fetch the chunk a path needs. Resolves immediately when it is already in the
 * module registry — which is the normal case, because React.lazy's own import
 * and this one resolve to the same module.
 */
export async function preloadRoute(path: string): Promise<void> {
  const load = loaderFor(path)
  if (!load) return
  try {
    await load()
  } catch {
    // A chunk that will not load must not swallow the navigation: let the
    // route render and let Suspense show its own skeleton / error.
  }
}

/**
 * Navigate with the chunk already in hand.
 *
 * Sets a "loading" flag for the shell's progress hairline so a cold route is
 * visibly being fetched (the click was heard), then pushes — by which time the
 * lazy component resolves without ever suspending.
 */
export async function navigateReady(args: {
  href: string
  push: (href: string) => void
  clear?: () => void
}): Promise<void> {
  const path = routePathOf(args.href)
  const load = loaderFor(path)
  if (load) {
    const ui = useUI.getState()
    const needsFetch = true // the module registry tells us nothing cheaply; importing is a no-op when warm
    if (needsFetch) ui.set({ routeLoading: path })
    await preloadRoute(path)
  }
  args.push(args.href)
  args.clear?.()
  // The shell clears it when the new location renders; this is the safety net
  // for a navigation that never produces one (same route, aborted).
  setTimeout(() => {
    if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
  }, 1200)
}
