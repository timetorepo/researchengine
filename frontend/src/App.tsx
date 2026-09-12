import React, { Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
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
const SecretsRoute = React.lazy(() => import('@/components/easter/SecretsRoute').then((m) => ({ default: m.SecretsRoute })))
import { Toasts } from '@/components/shared/Toasts'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsOverlay } from '@/components/shared/ShortcutsOverlay'
import { SkillBuilderPanel } from '@/components/skills/SkillBuilderPanel'
import { SkillRunModal } from '@/components/skills/SkillRunModal'
import { StarField } from '@/components/easter/StarField'
import { DiagnosticsOverlay } from '@/components/easter/DiagnosticsOverlay'
import { FocusPill } from '@/components/shared/FocusPill'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { SettingsSheet } from '@/components/settings/SettingsSheet'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

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
        <Toasts />
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

function RoutedApp() {
  const starfield = useUI((s) => s.starfield)
  const location = useLocation()
  useGlobalShortcuts()

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
    })
  }, [location.key])

  return (
    <>
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
          <Route path="/secrets" element={<SecretsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Shell>
      </ErrorBoundary>
      <Toasts />
      <SettingsSheet />
      <CommandPalette />
      <ShortcutsOverlay />
      <SkillBuilderPanel />
      <SkillRunModal />
      <FocusPill />
      {starfield && <StarField />}
      <DiagnosticsOverlay />
    </>
  )
}
