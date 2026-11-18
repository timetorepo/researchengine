/**
 * An experimental floating tab bar: five main destinations in one glass bar at
 * the bottom of the screen, in the style of iOS 26's floating tab bars
 * (docs/design-references/ios26-notes.md).
 *
 * The bar is Glisse's liquid-glass TabBar (MIT, github.com/0kzh/glisse). It
 * draws the glass, the spring between tabs and the lens while a tab is held.
 *
 * It is off by default and turned on in Settings → Appearance. It is hidden on
 * active chat and Codersa screens, where the composer/editor owns the window.
 * The coding project list keeps the bar. Shell reserves space below content.
 */
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Library, MessageSquare, Code, Workflow } from 'lucide-react'
import { TabBar } from 'glisse'
import 'glisse/styles.css'
import { floatingNavigationVisible, matchesSection } from '@/lib/shell/navigation'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'

type TabKey = 'home' | 'chats' | 'coding' | 'library' | 'workflows'

const TABS: { key: TabKey; to: string; label: string; icon: React.ReactNode; match: (p: string) => boolean }[] = [
  { key: 'home', to: '/', label: 'Home', icon: <Home size={18} strokeWidth={1.8} />, match: (p) => p === '/' },
  { key: 'chats', to: '/chats', label: 'Chats', icon: <MessageSquare size={18} strokeWidth={1.8} />, match: (p) => matchesSection(p, '/chats') },
  { key: 'coding', to: '/code', label: 'Coding', icon: <Code size={18} strokeWidth={1.8} />, match: (p) => matchesSection(p, '/code') },
  { key: 'library', to: '/library', label: 'Library', icon: <Library size={18} strokeWidth={1.8} />, match: (p) => matchesSection(p, '/library') },
  { key: 'workflows', to: '/workflows', label: 'Workflows', icon: <Workflow size={18} strokeWidth={1.8} />, match: (p) => matchesSection(p, '/workflows') },
]

export function FloatingTabBar() {
  const material = useStore((s) => s.settings.glassMode ?? 'off')
  const strength = useStore((s) => Math.max(0, Math.min(100, s.settings.navigationGlassStrength ?? 60)))
  const on = useStore((s) => s.settings.experimentalTabBar === true)
  const { pathname } = useLocation()
  const workbenchOpen = useUI((s) => s.codingWorkbenchOpen)
  const navigate = useNavigate()
  if (!floatingNavigationVisible(pathname, on, workbenchOpen)) return null

  const active = TABS.find((t) => t.match(pathname))?.key ?? null
  const routes = Object.fromEntries(TABS.map((t) => [t.key, t.to])) as Record<TabKey, string>

  return (
    <nav
      aria-label="Main"
      data-material={material}
      className="re-floating-navigation absolute left-1/2 -translate-x-1/2 z-[25] max-w-[calc(100%-16px)]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', '--re-nav-opacity': String(1 - strength * 0.006), '--re-nav-blur': `${strength * 0.3}px` } as React.CSSProperties}
      data-testid="floating-navigation"
    >
      <TabBar
        aria-label="Main sections"
        items={TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
        value={active}
        onValueChange={(v) => { if (v !== active) navigate(routes[v as TabKey]) }}
      />
    </nav>
  )
}
