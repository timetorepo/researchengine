import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { applyTheme } from '@/lib/themes/meta'
import { Shell } from '@/components/layout/Shell'
import { HomeScreen } from '@/components/home/HomeScreen'
import { ChatView } from '@/components/chat/ChatView'
import { SettingsView } from '@/components/settings/SettingsView'
import { FloodView } from '@/components/agents/FloodView'
import { QuizHub } from '@/components/quiz/QuizHub'
import { ArticlesView } from '@/components/articles/ArticlesView'
import { ArticleEditor } from '@/components/articles/ArticleEditor'
import { LibraryView } from '@/components/library/LibraryView'
import { CompareView } from '@/components/compare/CompareView'
import { NotFound404 } from '@/components/easter/NotFound404'
import { SecretsRoute } from '@/components/easter/SecretsRoute'
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
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

export default function App() {
  const settings = useStore((s) => s.settings)
  const notFound = useUI((s) => s.notFound)

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

  return (
    <HashRouter>
      <RoutedApp />
    </HashRouter>
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
          <Route path="/secrets" element={<SecretsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      </ErrorBoundary>
      <Toasts />
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
