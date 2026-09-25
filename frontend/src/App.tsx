import React, { Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { applyTheme } from '@/lib/themes/meta'
import { Shell } from '@/components/layout/Shell'
import { HomeScreen } from '@/components/home/HomeScreen'
import { RouteSkeleton } from '@/components/shared/RouteSkeleton'
import { NotFound404 } from '@/components/easter/NotFound404'

// Route-level code splitting: every heavy screen streams in on demand so the
// initial bundle stays lean. HomeScreen stays eager — it is the landing view.
const ChatView = React.lazy(() => import('@/components/chat/ChatView').then((m) => ({ default: m.ChatView })))
const SettingsView = React.lazy(() => import('@/components/settings/SettingsView').then((m) => ({ default: m.SettingsView })))
const FloodView = React.lazy(() => import('@/components/agents/FloodView').then((m) => ({ default: m.FloodView })))
const QuizHub = React.lazy(() => import('@/components/quiz/QuizHub').then((m) => ({ default: m.QuizHub })))
const ArticlesView = React.lazy(() => import('@/components/articles/ArticlesView').then((m) => ({ default: m.ArticlesView })))
const ArticleEditor = React.lazy(() => import('@/components/articles/ArticleEditor').then((m) => ({ default: m.ArticleEditor })))
const LibraryView = React.lazy(() => import('@/components/library/LibraryView').then((m) => ({ default: m.LibraryView })))
const CompareView = React.lazy(() => import('@/components/compare/CompareView').then((m) => ({ default: m.CompareView })))
const WorkflowsList = React.lazy(() => import('@/components/workflows/WorkflowsList').then((m) => ({ default: m.WorkflowsList })))
const WorkflowEditor = React.lazy(() => import('@/components/workflows/WorkflowEditor').then((m) => ({ default: m.WorkflowEditor })))
const CodingView = React.lazy(() => import('@/components/ide/CodingView').then((m) => ({ default: m.CodingView })))
const ChatsView = React.lazy(() => import('@/components/chats/ChatsView').then((m) => ({ default: m.ChatsView })))
const SecretsRoute = React.lazy(() => import('@/components/easter/SecretsRoute').then((m) => ({ default: m.SecretsRoute })))
import { AppToaster } from '@/components/shared/AppToaster'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsOverlay } from '@/components/shared/ShortcutsOverlay'
import { SkillBuilderPanel } from '@/components/skills/SkillBuilderPanel'
import { SkillRunModal } from '@/components/skills/SkillRunModal'
import { StarField } from '@/components/easter/StarField'
import { DiagnosticsOverlay } from '@/components/easter/DiagnosticsOverlay'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { SettingsSheet } from '@/components/settings/SettingsSheet'
import { VaultUnlock } from '@/components/vault/VaultUnlock'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { installViewTransitions } from '@/hooks/useViewTransitions'
import { installFramePin } from '@/lib/dom/scroll'
import { wireAgentActivity } from '@/lib/ide/agents'

/** Preload every lazy route chunk during idle time — first paint stays lean,
 *  but palette/navigation targets are warm by the time the user needs them. */
function useRoutePreload() {
  useEffect(() => {
    const load = () => {
      Promise.all([
        import('@/components/chat/ChatView'),
        import('@/components/settings/SettingsView'),
        import('@/components/agents/FloodView'),
        import('@/components/quiz/QuizHub'),
        import('@/components/articles/ArticlesView'),
        import('@/components/library/LibraryView'),
        import('@/components/compare/CompareView'),
      ]).catch(() => {})
    }
    const idle = (window as any).requestIdleCallback
    if (typeof idle === 'function') {
      const id = idle(load, { timeout: 4000 })
      return () => (window as any).cancelIdleCallback?.(id)
    }
    const t = setTimeout(load, 2500)
    return () => clearTimeout(t)
  }, [])
}

export default function App() {
  const settings = useStore((s) => s.settings)
  const notFound = useUI((s) => s.notFound)
  useRoutePreload()

  // Navigation is wrapped in the View Transitions API where the browser has it:
  // the shell stays put, the page cross-fades, the nav marker travels.
  useEffect(() => { installViewTransitions() }, [])

  // Apply theme + font scale + motion prefs whenever they change
  useEffect(() => {
    const reduced = settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    applyTheme(settings.theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: reduced })
  }, [settings.theme, settings.fontScale, settings.compact, settings.reduceMotion])

  if (notFound) return <NotFound404 />

  if (!settings.onboarded) {
    return (
      <>
        <Onboarding />
        <AppToaster />
      </>
    )
  }

  const reduced = settings.reduceMotion ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'} transition={{ type: 'spring', damping: 26, stiffness: 320 }}>
      <HashRouter>
        <RoutedApp />
      </HashRouter>
    </MotionConfig>
  )
}

/**
 * Cold routes have to fetch a chunk. Rather than freezing the frame or showing
 * a bare skeleton, a two-pixel bar crosses the top of the window — the same
 * signal every browser gives — and the rail marks the row you picked.
 */
function RouteProgress() {
  const loading = useUI((s) => s.routeLoading)
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="route-progress"
          className="re-route-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="progressbar"
          aria-label="Loading page"
        >
          <span className="re-route-progress-bar" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function RoutedApp() {
  const starfield = useUI((s) => s.starfield)
  const location = useLocation()
  useGlobalShortcuts()

  // The app frame is a fixed, non-scrolling box. Anything that scrolls it — a
  // stray scrollIntoView from a list, the browser revealing a focused input —
  // leaves the whole UI parked off-centre and the user cannot scroll it back,
  // because `overflow: hidden` ignores the wheel. Put it back, always.
  useEffect(() => installFramePin(), [])

  // Agent tasks and the chat share one activity feed (coding mode only).
  useEffect(() => { wireAgentActivity() }, [])

  // Transient overlays must never survive navigation: any leftover full-screen
  // scrim would silently swallow every click until a refresh. Close them all
  // on every route change (location.key also covers same-path navigations).
  useEffect(() => {
    useUI.setState({
      paletteOpen: false,
      shortcutsOpen: false,
      skillBuilderOpen: null,
      skillRun: null,
      islandExpanded: false,
      sidebarOpenMobile: false,
      routeLoading: null,
    })
  }, [location.key])

  return (
    <>
      {/* Refraction filter used by Liquid Glass (chatbox / island bend effect). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
        <defs>
          <filter id="re-glass-bend" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="1" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {/* A hairline that says the click was heard while a route chunk loads.
          The page underneath stays interactive the whole time. */}
      <RouteProgress />
      <ErrorBoundary>
      <Shell>
        <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/chat/:id" element={<ChatView />} />
          <Route path="/settings/*" element={<SettingsView />} />
          <Route path="/flood" element={<FloodView />} />
          <Route path="/quiz" element={<QuizHub />} />
          <Route path="/articles" element={<ArticlesView />} />
          <Route path="/articles/:id" element={<ArticleEditor />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/compare" element={<CompareView />} />
          <Route path="/workflows" element={<WorkflowsList />} />
          <Route path="/workflows/:id" element={<WorkflowEditor />} />
          <Route path="/code" element={<CodingView />} />
          <Route path="/chats" element={<ChatsView />} />
          <Route path="/secrets" element={<SecretsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Shell>
      </ErrorBoundary>
      <AppToaster />
      <SettingsSheet />
      <VaultUnlock />
      <CommandPalette />
      <ShortcutsOverlay />
      <SkillBuilderPanel />
      <SkillRunModal />
      {starfield && <StarField />}
      <DiagnosticsOverlay />
    </>
  )
}
