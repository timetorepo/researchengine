/**
 * Route chunks: prefetched ahead of time, never in the way.
 *
 * Every screen except Home is a `React.lazy` chunk, so the first visit to a
 * route fetches a file. Two mistakes were made trying to hide that from the
 * user, and both were worse than the fetch:
 *
 *   1. Navigation waited for the chunk. A click then did nothing at all until
 *      an import resolved — and if it never resolved, the click never
 *      navigated (the "i click a page and it automatically doesn't load").
 *   2. Because the push was deferred, a *late* import could land after a newer
 *      click and drag you to the page you had already moved on from (the
 *      "i go to another page, it goes to that page not the page i selected").
 *
 * The rules now:
 *
 *   • Navigation is synchronous. A click always moves, in the same tick.
 *   • Prefetching is a background hint. It can never gate, delay or reorder a
 *     navigation, and its result is only used to mark a chunk "warm".
 *   • Warmth is what buys polish: hovering a row starts the import, and a
 *     navigation into a warm route is the only one the View Transitions layer
 *     is allowed to animate (so a transition never starts over a skeleton).
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

/** Chunks already resolved in this session — a Set, so warmth is O(1). */
const warm = new Set<string>()
/** Imports in flight, so hovering twice does not start two fetches. */
const inflight = new Map<string, Promise<void>>()

/** The router path inside a location: hash routing, so `#/quiz` → `/quiz`. */
export function routePathOf(href: string): string {
  const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : href
  const path = hash.split('?')[0] || '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function loaderFor(path: string): Loader | null {
  return ROUTES.find((r) => r.test(path))?.load ?? null
}

/** True when this route's chunk is already in the module registry. */
export function isWarm(path: string): boolean {
  if (!loaderFor(path)) return true // Home and the redirect need nothing
  return warm.has(path)
}

/**
 * Start fetching a route's chunk in the background. Safe to call on hover, on
 * focus, or while a page is already rendering — it never touches the router.
 */
export function prefetchRoute(path: string): Promise<void> {
  const load = loaderFor(path)
  if (!load) return Promise.resolve()
  if (warm.has(path)) return Promise.resolve()
  const started = inflight.get(path)
  if (started) return started
  const p = load()
    .then(() => { warm.add(path) })
    .catch(() => { /* the route will show Suspense's own fallback and retry */ })
    .finally(() => { inflight.delete(path) })
  inflight.set(path, p)
  return p
}

/** Fetch the chunk and resolve when it is actually in hand (tests, warmers). */
export async function preloadRoute(path: string): Promise<void> {
  await prefetchRoute(path)
}

/**
 * Navigate — synchronously, always.
 *
 * The push happens in the same tick as the click; the chunk fetch is kicked off
 * beside it only to drive the hairline (Suspense renders the page the moment
 * the module lands). Because the push is synchronous, an older navigation can
 * never overwrite a newer one.
 */
export function navigateNow(args: { href: string; push: (href: string) => void }): void {
  const path = routePathOf(args.href)
  const ui = useUI.getState()
  if (!isWarm(path)) {
    ui.set({ routeLoading: path })
    void prefetchRoute(path).then(() => {
      if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
    })
    // Safety net: a chunk that never arrives must not leave the hairline up.
    setTimeout(() => {
      if (useUI.getState().routeLoading === path) useUI.setState({ routeLoading: null })
    }, 4000)
  }
  args.push(args.href)
}

/** Kept for callers written against the earlier name — same synchronous move. */
export const navigateReady = navigateNow
