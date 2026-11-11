/**
 * An experimental floating tab bar: five main destinations in one glass bar at
 * the bottom of the screen, in the style of iOS 26's floating tab bars
 * (docs/design-references/ios26-notes.md).
 *
 * The bar is Glisse's liquid-glass TabBar (MIT, github.com/0kzh/glisse). It
 * draws the glass, the spring between tabs and the lens while a tab is held.
 *
 * It is off by default and turned on in Settings → Appearance. It is hidden on
 * the chat and coding screens, where the bottom of the window belongs to the
 * composer and the editor. The sidebar stays available everywhere.
 */
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Library, MessageSquare, Code, Workflow } from 'lucide-react'
import { TabBar } from 'glisse'
import 'glisse/styles.css'
import { useStore } from '@/stores/useStore'

type TabKey = 'home' | 'chats' | 'coding' | 'library' | 'workflows'

const TABS: { key: TabKey; to: string; label: string; icon: React.ReactNode; match: (p: string) => boolean }[] = [
  { key: 'home', to: '/', label: 'Home', icon: <Home size={18} strokeWidth={1.8} />, match: (p) => p === '/' },
  { key: 'chats', to: '/chats', label: 'Chats', icon: <MessageSquare size={18} strokeWidth={1.8} />, match: (p) => p.startsWith('/chats') },
  { key: 'coding', to: '/code', label: 'Coding', icon: <Code size={18} strokeWidth={1.8} />, match: (p) => p.startsWith('/code') },
  { key: 'library', to: '/library', label: 'Library', icon: <Library size={18} strokeWidth={1.8} />, match: (p) => p.startsWith('/library') },
  { key: 'workflows', to: '/workflows', label: 'Workflows', icon: <Workflow size={18} strokeWidth={1.8} />, match: (p) => p.startsWith('/workflows') },
]

/** Screens where a bottom bar would sit on top of the composer or the editor. */
const HIDDEN_ON = (p: string) => p === '/chat' || p.startsWith('/chat/') || p.startsWith('/code')

export function FloatingTabBar() {
  const on = useStore((s) => s.settings.experimentalTabBar === true)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!on || HIDDEN_ON(pathname)) return null

  const active = TABS.find((t) => t.match(pathname))?.key ?? null
  const routes = Object.fromEntries(TABS.map((t) => [t.key, t.to])) as Record<TabKey, string>

  return (
    <nav
      aria-label="Main"
      className="fixed left-1/2 -translate-x-1/2 z-[45]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
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
