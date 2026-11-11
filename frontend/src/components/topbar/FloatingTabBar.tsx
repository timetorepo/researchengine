/**
 * An experimental floating tab bar: five main destinations in one glass capsule
 * at the bottom of the screen, in the style of iOS 26's floating tab bars
 * (docs/design-references/ios26-notes.md).
 *
 * It is off by default and turned on in Settings → Appearance. It is hidden on
 * the chat and coding screens, where the bottom of the window belongs to the
 * composer and the editor. The sidebar stays available everywhere.
 */
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Library, MessageSquare, Code, Workflow } from 'lucide-react'
import { useStore } from '@/stores/useStore'

const TABS = [
  { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  { to: '/chats', label: 'Chats', icon: MessageSquare, match: (p: string) => p.startsWith('/chats') },
  { to: '/code', label: 'Coding', icon: Code, match: (p: string) => p.startsWith('/code') },
  { to: '/library', label: 'Library', icon: Library, match: (p: string) => p.startsWith('/library') },
  { to: '/workflows', label: 'Workflows', icon: Workflow, match: (p: string) => p.startsWith('/workflows') },
]

/** Screens where a bottom bar would sit on top of the composer or the editor. */
const HIDDEN_ON = (p: string) => p === '/chat' || p.startsWith('/chat/') || p.startsWith('/code')

export function FloatingTabBar() {
  const on = useStore((s) => s.settings.experimentalTabBar === true)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!on || HIDDEN_ON(pathname)) return null

  return (
    <nav
      aria-label="Main"
      className="fixed left-1/2 -translate-x-1/2 z-[45]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
    >
      <div
        className="flex items-center gap-1 p-1.5 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--surface) 72%, transparent)',
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 16px 40px -14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {TABS.map((t) => {
          const active = t.match(pathname)
          const Icon = t.icon
          return (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5 h-12 min-w-[64px] px-3 rounded-full transition-colors"
              style={{
                background: active ? 'var(--elevated)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--text-3)',
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10.5px] font-medium leading-none">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
