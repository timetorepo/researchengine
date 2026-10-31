import { WalletWatcher } from '@/components/wallet/WalletWatcher'
import { ExamGate } from '@/components/exam/Exam'
import { BugFinder } from '@/components/dev/BugFinder'
import { ActivityTracker } from '@/components/activity/ActivityTracker'
import React, { Suspense, useEffect, useMemo } from 'react'
import { lensMapDataUrl, refractionSupported } from '@/lib/glass/lensMap'
import { FpsCounter } from '@/components/shared/FpsCounter'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
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
const CodersaPage = React.lazy(() => import('@/components/codersa/CodersaPage').then((m) => ({ default: m.CodersaPage })))
const ChatsView = React.lazy(() => import('@/components/chats/ChatsView').then((m) => ({ default: m.ChatsView })))
import { startBotScheduler } from '@/lib/bots/runner'
const CalendarView = React.lazy(() => import('@/components/calendar/CalendarView').then((m) => ({ default: m.CalendarView })))
const BotsView = React.lazy(() => import('@/components/bots/BotsView').then((m) => ({ default: m.BotsView })))
const MarketplacePage = React.lazy(() => import('@/components/marketplace/MarketplacePage').then((m) => ({ default: m.MarketplacePage })))
const CrmPage = React.lazy(() => import('@/components/crm/CrmPage').then((m) => ({ default: m.CrmPage })))
const SecretsRoute = React.lazy(() => import('@/components/easter/SecretsRoute').then((m) => ({ default: m.SecretsRoute })))
const RemoverAlpha = React.lazy(() => import('@/components/alpha/RemoverAlpha').then((m) => ({ default: m.RemoverAlpha })))
const FeedbackView = React.lazy(() => import('@/components/feedback/FeedbackView').then((m) => ({ default: m.FeedbackView })))
import { AppToaster } from '@/components/shared/AppToaster'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
/**
 * On-demand overlays. None of these is on screen at first paint, so none of
 * them belongs in the entry chunk: each is imported the moment its own flag
 * turns on, and the idle preload below warms them so the first open is instant
 * anyway. Settings alone is ~250 kB of tabs that used to load for every visit.
 */
const SettingsSheet = React.lazy(() => import('@/components/settings/SettingsSheet').then((m) => ({ default: m.SettingsSheet })))
const TasksPanel = React.lazy(() => import('@/components/tasks/TasksPanel').then((m) => ({ default: m.TasksPanel })))
const CommandPalette = React.lazy(() => import('@/components/shared/CommandPalette').then((m) => ({ default: m.CommandPalette })))
const ShortcutsOverlay = React.lazy(() => import('@/components/shared/ShortcutsOverlay').then((m) => ({ default: m.ShortcutsOverlay })))
const SkillBuilderPanel = React.lazy(() => import('@/components/skills/SkillBuilderPanel').then((m) => ({ default: m.SkillBuilderPanel })))
const SkillRunModal = React.lazy(() => import('@/components/skills/SkillRunModal').then((m) => ({ default: m.SkillRunModal })))
const Onboarding = React.lazy(() => import('@/components/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })))
const StarField = React.lazy(() => import('@/components/easter/StarField').then((m) => ({ default: m.StarField })))
const DiagnosticsOverlay = React.lazy(() => import('@/components/easter/DiagnosticsOverlay').then((m) => ({ default: m.DiagnosticsOverlay })))
import { ScrollProgress } from '@/components/ui/skiper/ScrollProgress'
import { AppContextMenu } from '@/components/shared/AppContextMenu'
import { UpdateModal } from '@/components/updates/UpdateModal'
import { startConnectorSync, consumeComposioReturn, openMarketplace } from '@/lib/composio/sync'
import { ArtifactPanel } from '@/components/chat/ArtifactPanel'
import { VaultUnlock } from '@/components/vault/VaultUnlock'
import { LockScreen } from '@/components/vault/LockScreen'
import { isLocked, readLockSession } from '@/lib/security/lock'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { installViewTransitions } from '@/hooks/useViewTransitions'
import { markVisited, routePathOf } from '@/lib/routes/registry'
import { installFramePin } from '@/lib/dom/scroll'
import { watchFrameBudget } from '@/lib/system/frame-budget'
import { wireAgentActivity } from '@/lib/ide/agents'

/** Preload every lazy route chunk during idle time — first paint stays lean,
 *  but palette/navigation targets are warm by the time the user needs them. */
function useRoutePreload() {
  useEffect(() => {
    // Routes first: navigation should never wait on the network — and on a
    // machine where the server is local or on the LAN, warming all of them is a
    // disk read. Overlays follow, so the first open of Settings or the palette
    // feels like it was always there.
    const load = () => {
      Promise.all([
        import('@/components/chat/ChatView'),
        import('@/components/settings/SettingsView'),
        import('@/components/agents/FloodView'),
        import('@/components/quiz/QuizHub'),
        import('@/components/articles/ArticlesView'),
        import('@/components/library/LibraryView'),
        import('@/components/compare/CompareView'),
      ]).then(() => Promise.all([
        import('@/components/settings/SettingsSheet'),
        import('@/components/tasks/TasksPanel'),
        import('@/components/shared/CommandPalette'),
      ])).catch(() => {})
    }
    // Two frames after mount is "the shell is on screen": the user's first
    // paint is never delayed, but the warm-up does not wait for a timeout
    // either. The timer is a floor for a background tab, where rAF never fires.
    let cancelled = false
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => { if (!cancelled) load() })
    })
    const t = setTimeout(() => { if (!cancelled) load() }, 1500)
    return () => { cancelled = true; cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t) }
  }, [])
}

export default function App() {
  const settings = useStore((s) => s.settings)
  const notFound = useUI((s) => s.notFound)
  useRoutePreload()
  useEffect(() => { startBotScheduler() }, [])
  // Connected-app count and notices run on every screen. A sign-in window that
  // lands back here returns the person to the Marketplace.
  useEffect(() => { if (consumeComposioReturn()) openMarketplace(); return startConnectorSync() }, [])

  // Navigation is wrapped in the View Transitions API where the browser has it:
  // the shell stays put, the page cross-fades, the nav marker travels.
  useEffect(() => { installViewTransitions() }, [])

  // The startup lock. Checked before anything renders, because the one thing a
  // lock cannot undo is a screen that has already drawn your chats.
  const locked = isLocked() && !readLockSession()
  if (locked) {
    return (
      <>
        <LockScreen />
        <AppToaster />
      </>
    )
  }

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
        {/* One right-click menu for the whole app. The scroll indicator, chat
            rows and other surfaces that own their right-click stop the event
            before it reaches this, so theirs is the one you get. */}
        <AppContextMenu>
          <RoutedApp />
        </AppContextMenu>
        <FpsCounter />
        <WalletWatcher />
        <ExamGate />
        <ActivityTracker />
        {/* Developer-mode only: the bug finder hotkey and its report. */}
        {settings.developerMode && <BugFinder />}
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

function RouteLatch() {
  const location = useLocation()
  const path = routePathOf(`#${location.pathname}`)
  useEffect(() => { markVisited(path) }, [path])
  return null
}

function RoutedApp() {
  // The refraction lens, computed once. Bending is only switched on where the
  // map exists and the engine can use it; elsewhere Liquid Glass is a blur.
  const lensMap = useMemo(() => lensMapDataUrl() ?? '', [])
  useEffect(() => {
    document.documentElement.dataset.refract = lensMap && refractionSupported() ? 'on' : 'off'
  }, [lensMap])
  const starfield = useUI((s) => s.starfield)
  // One subscription for the overlay flags, so toggling any of them re-renders
  // this component (and only mounts the overlay that turned on).
  const overlay = useUI((s) => ({
    settingsSheet: s.settingsSheet,
    tasksPanel: s.tasksOpen,
    paletteOpen: s.paletteOpen,
    shortcutsOpen: s.shortcutsOpen,
    skillBuilder: s.skillBuilderOpen,
    skillRun: s.skillRun,
    diagnostics: s.diagnostics,
  }))
  // First run only — a returning user never pays for the tour's chunk.
  const firstRun = useStore((s) => s.settings.onboarded !== true)
  const location = useLocation()
  useGlobalShortcuts()

  // The app frame is a fixed, non-scrolling box. Anything that scrolls it — a
  // stray scrollIntoView from a list, the browser revealing a focused input —
  // leaves the whole UI parked off-centre and the user cannot scroll it back,
  // because `overflow: hidden` ignores the wheel. Put it back, always.
  useEffect(() => installFramePin(), [])

  // Agent tasks and the chat share one activity feed (coding mode only).
  useEffect(() => { wireAgentActivity() }, [])

  // Adaptive quality: one short sample of the real frame rate a few seconds in,
  // and again whenever the window comes back from being hidden. The animated
  // canvases read the level; Settings → Performance shows it.
  useEffect(() => watchFrameBudget(), [])

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
      {/* Refraction for Liquid Glass: a lens map bends what is behind the
          chatbox, the island and toasts at their edges (lib/glass/lensMap.ts). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
        <defs>
          <filter id="re-glass-bend" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feImage href={lensMap} preserveAspectRatio="none" result="lens" />
            <feDisplacementMap in="SourceGraphic" in2="lens" scale="22" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {/* A hairline that says the click was heard while a route chunk loads.
          The page underneath stays interactive the whole time. */}
      <RouteProgress />
      <ErrorBoundary>
      <Shell>
        <Suspense fallback={<RouteSkeleton />}>
        {/* Inside the boundary on purpose. When a route suspends, everything in
            here — this latch included — is replaced by the skeleton and mounts
            again the moment the chunk lands, so the effect below fires exactly
            when the route has rendered for real. The View Transitions layer
            reads that mark; a route is never animated into before then, because
            flushing a render that suspends loses the navigation. */}
        <RouteLatch />
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
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/bots" element={<BotsView />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/:slug" element={<MarketplacePage />} />
          <Route path="/crm" element={<CrmPage />} />
          <Route path="/workflows/:id" element={<WorkflowEditor />} />
          <Route path="/code" element={<CodingView />} />
          <Route path="/code/codersa" element={<CodersaPage />} />
          <Route path="/chats" element={<ChatsView />} />
          <Route path="/alpha" element={<RemoverAlpha />} />
          <Route path="/feedback" element={<FeedbackView />} />
          <Route path="/secrets" element={<SecretsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Shell>
      </ErrorBoundary>
      <AppToaster />
      {/* Always mounted: the vault prompt has to be able to appear over
          anything, and the scroll rail follows whichever surface scrolls. */}
      <VaultUnlock />
      {/* The new-release popup lives outside the router on purpose — a version
          announcement should be able to reach the user on any page. */}
      <UpdateModal />
      <ArtifactPanel />
      <ScrollProgress />
      {/* Each overlay mounts only once its own flag is on, so the chunk is
          fetched when it is actually wanted (and the idle preload has usually
          fetched it already). */}
      <Suspense fallback={null}>
        {overlay && (
          <>
            {overlay.settingsSheet && <SettingsSheet />}
            {overlay.tasksPanel && <TasksPanel />}
            {overlay.paletteOpen && <CommandPalette />}
            {overlay.shortcutsOpen && <ShortcutsOverlay />}
            {overlay.skillBuilder && <SkillBuilderPanel />}
            {overlay.skillRun && <SkillRunModal />}
            {firstRun && <Onboarding />}
            {starfield && <StarField />}
            {overlay.diagnostics && <DiagnosticsOverlay />}
          </>
        )}
      </Suspense>
    </>
  )
}
