import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, MessageSquare, GraduationCap, BookOpen, Library, Users, Settings, Swords, Workflow as WorkflowIcon } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { clsx } from 'clsx'

const ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/chat', icon: MessageSquare, label: 'Chats', chat: true },
  { to: '/quiz', icon: GraduationCap, label: 'Learn' },
  { to: '/articles', icon: BookOpen, label: 'Articles' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/compare', icon: Swords, label: 'Compare' },
  { to: '/workflows', icon: WorkflowIcon, label: 'Workflows' },
  { to: '/flood', icon: Users, label: 'Agent Flood' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function OSDock() {
  const navigate = useNavigate()
  const loc = useLocation()
  const ui = useUI()

  return (
    <nav
      className="absolute left-3 top-1/2 -translate-y-1/2 z-30 glass flex flex-col gap-1.5 p-2"
      style={{ borderRadius: 20, border: '1px solid var(--surface-border)', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)' }}
      aria-label="Dock"
    >
      {ITEMS.map((it) => {
        const active = it.chat ? loc.pathname.startsWith('/chat') : loc.pathname === it.to || (it.to === '/settings' && loc.pathname.startsWith('/settings'))
        return (
          <button
            key={it.to}
            aria-label={it.label}
            title={it.label}
            onClick={() => {
              if (it.chat) {
                const chats = useStore.getState().chats
                if (chats.length) { useStore.getState().setActiveChat(chats[0].id); navigate(`/chat/${chats[0].id}`) }
                else navigate(`/chat/${useStore.getState().newChat()}`)
              } else navigate(it.to)
            }}
            className={clsx('relative w-10 h-10 rounded-[14px] flex items-center justify-center transition-all hover:scale-110')}
            style={{
              background: active ? 'var(--elevated)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--text-2)',
            }}
          >
            <it.icon size={19} strokeWidth={1.5} />
            {active && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full" style={{ background: 'var(--primary)' }} />}
          </button>
        )
      })}
    </nav>
  )
}
