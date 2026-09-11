import React, { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, MessageSquare, BookOpen, GraduationCap, Library, Users, Settings, Plus,
  Trash2, Search, ShieldCheck, PanelLeftClose, PanelLeftOpen, Compass, X, Pencil, Check, Swords,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { AppLogo } from '@/components/shared/AppLogo'
import { useVirtualList } from '@/hooks/useVirtualList'
import { timeAgo } from '@/lib/utils'
import { clsx } from 'clsx'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/quiz', label: 'Read & Quiz', icon: GraduationCap },
  { to: '/articles', label: 'Articles', icon: BookOpen },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/compare', label: 'Compare', icon: Swords },
  { to: '/flood', label: 'Agent Flood', icon: Users },
]

export function Sidebar({ floating = false }: { floating?: boolean }) {
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const mobileOpen = useUI((s) => s.sidebarOpenMobile)
  const ui = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const chats = useStore((s) => s.chats)
  const spaces = useStore((s) => s.spaces)
  const integrations = useStore((s) => s.integrations)
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const anyIntegration = Object.values(integrations).some((i) => i.connected)

  const filtered = useMemo(() => {
    let list = chats
    if (spaceFilter) list = list.filter((c) => c.spaceId === spaceFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
    }
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [chats, spaceFilter, query])

  const virt = useVirtualList(filtered.length, 44)

  const width = collapsed ? 60 : 264

  const body = (
    <div className={clsx('h-full flex flex-col', floating && 'h-full rounded-2xl overflow-hidden')}
      style={{
        width,
        background: floating ? 'var(--glass)' : undefined,
        backdropFilter: floating ? 'blur(20px) saturate(1.3)' : undefined,
        borderRight: floating ? 'none' : '1px solid var(--surface-border)',
        transition: 'width 240ms var(--spring)',
      }}>

      {/* Header */}
      <div className={clsx('flex items-center px-3 pt-3 pb-2 gap-2', collapsed && 'justify-center')}>
        {!collapsed && <AppLogo size={26} />}
        {collapsed && <AppLogo size={26} withName={false} />}
        {!collapsed && (
          <button
            className="ml-auto p-1.5 rounded-lg hover:bg-[var(--elevated)]"
            style={{ color: 'var(--text-3)' }}
            onClick={() => ui.toggleSidebar()}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1 mt-2">
          <IconBtn label="Expand" onClick={() => ui.toggleSidebar()}><PanelLeftOpen size={18} strokeWidth={1.5} /></IconBtn>
          <IconBtn label="New chat" onClick={() => { const id = useStore.getState().newChat(); navigate(`/chat/${id}`) }}><Plus size={18} strokeWidth={1.5} /></IconBtn>
          <div className="w-6 my-1" style={{ borderTop: '1px solid var(--surface-border)' }} />
          {NAV.map((n) => {
            const active = n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
            return (
              <IconBtn key={n.to} label={n.label} active={active} onClick={() => navigate(n.to)}>
                <n.icon size={18} strokeWidth={1.5} />
              </IconBtn>
            )
          })}
        </div>
      ) : (
        <>
          {/* New chat */}
          <div className="px-3 mt-1">
            <button
              onClick={() => { const id = useStore.getState().newChat(spaceFilter ?? undefined); navigate(`/chat/${id}`) }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-[13px] font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <Plus size={16} strokeWidth={2} /> New research
            </button>
          </div>

          {/* Search */}
          <div className="px-3 mt-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px]" style={{ background: 'var(--elevated)' }}>
              <Search size={14} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="bg-transparent outline-none text-[13px] flex-1 min-w-0"
              />
              {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} style={{ color: 'var(--text-3)' }} /></button>}
            </div>
          </div>

          {/* Nav */}
          <nav className="px-3 mt-3 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[13px] transition-colors"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--text)' : 'var(--text-2)',
                  background: isActive ? 'var(--elevated)' : 'transparent',
                })}
              >
                <n.icon size={17} strokeWidth={1.5} />
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Spaces */}
          <div className="px-3 mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider px-2.5 mb-1.5" style={{ color: 'var(--text-3)' }}>Spaces</div>
            <div className="flex flex-wrap gap-1.5 px-1">
              <SpaceChip active={spaceFilter === null} label="All" color="var(--text-3)" onClick={() => setSpaceFilter(null)} />
              {spaces.map((sp) => (
                <SpaceChip key={sp.id} active={spaceFilter === sp.id} label={sp.name} color={sp.color} onClick={() => setSpaceFilter(spaceFilter === sp.id ? null : sp.id)} />
              ))}
            </div>
          </div>

          {/* Chat history */}
          <div className="px-3 mt-4 flex-1 min-h-0 flex flex-col">
            <div className="text-[10px] font-semibold uppercase tracking-wider px-2.5 mb-1.5" style={{ color: 'var(--text-3)' }}>
              History · {filtered.length}
            </div>
            <div ref={virt.ref} onScroll={virt.onScroll} className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
                  No research yet.
                  <br />Your conversations stay on this device.
                </div>
              ) : (
                <div style={virt.containerStyle}>
                  <div style={{ transform: `translateY(${virt.offset}px)` }}>
                    {filtered.slice(virt.slice.start, virt.slice.end).map((c) => (
                      <ChatItem key={c.id} id={c.id} title={c.title} when={c.updatedAt} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Privacy shield footer */}
      <div className={clsx('p-3', collapsed && 'flex justify-center')} style={{ borderTop: '1px solid var(--surface-border)' }}>
        <PrivacyShield compact={collapsed} amber={anyIntegration} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="h-full hidden md:block shrink-0">{body}</aside>
      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden sheet-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => ui.set({ sidebarOpenMobile: false })}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 md:hidden surface-elevated"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function IconBtn({ children, label, onClick, active = false }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-current={active ? 'page' : undefined}
      className="relative p-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]"
      style={{ color: active ? 'var(--primary)' : 'var(--text-2)', background: active ? 'var(--elevated)' : 'transparent' }}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full" style={{ background: 'var(--primary)' }} />}
      {children}
    </button>
  )
}

function SpaceChip({ active, label, color, onClick }: { active: boolean; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] transition-all"
      style={{
        background: active ? 'var(--elevated)' : 'transparent',
        border: `1px solid ${active ? color : 'var(--surface-border)'}`,
        color: active ? 'var(--text)' : 'var(--text-2)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </button>
  )
}

function ChatItem({ id, title, when }: { id: string; title: string; when: number }) {
  const { id: activeId } = useParams()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(title)
  const active = activeId === id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="group chat-row flex items-center rounded-[10px] mb-0.5"
      data-active={active}
      style={{ height: 44 }}
    >
      <button
        onClick={() => { useStore.getState().setActiveChat(id); navigate(`/chat/${id}`) }}
        className="flex-1 min-w-0 text-left px-2.5 py-2"
      >
        {renaming ? (
          <input
            autoFocus value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { useStore.getState().renameChat(id, draft || title); setRenaming(false) }
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={() => { useStore.getState().renameChat(id, draft || title); setRenaming(false) }}
            className="w-full bg-transparent outline-none text-[13px] border-b border-[var(--primary)]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="text-[13px] truncate" style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}>{title}</div>
            <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{timeAgo(when)}</div>
          </>
        )}
      </button>

      <div className="hidden group-hover:flex items-center gap-0.5 pr-2">
        <button aria-label="Rename" className="p-1 rounded hover:bg-[var(--surface)]" style={{ color: 'var(--text-3)' }}
          onClick={() => { setDraft(title); setRenaming(true) }}><Pencil size={12.5} strokeWidth={1.5} /></button>
        <button aria-label="Delete chat" className="p-1 rounded hover:bg-[var(--surface)] hover:text-[var(--danger)]" style={{ color: 'var(--text-3)' }}
          onClick={() => useStore.getState().deleteChat(id)}><Trash2 size={12.5} strokeWidth={1.5} /></button>
      </div>
    </motion.div>
  )
}

export function PrivacyShield({ compact = false, amber = false }: { compact?: boolean; amber?: boolean }) {
  const ui = useUI()
  const click = () => {
    const n = useUI.getState().shieldClicks + 1
    if (n >= 7) {
      ui.set({ diagnostics: true, shieldClicks: 0 })
      setTimeout(() => useUI.setState({ diagnostics: false }), 6000)
    } else {
      ui.set({ shieldClicks: n })
      ui.set({ paletteOpen: false, settingsOpen: false })
      window.dispatchEvent(new CustomEvent('re:open-privacy'))
    }
  }
  const color = amber ? 'var(--warning)' : 'var(--success)'
  return (
    <button
      onClick={click}
      className={clsx('flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]', compact ? 'p-2' : 'w-full px-2.5 py-2')}
      aria-label="Privacy shield"
      title={amber ? 'Integrations active — review what is connected' : 'Everything is local'}
    >
      <span className="relative">
        <ShieldCheck size={18} strokeWidth={1.5} style={{ color }} />
        <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color, color }} />
      </span>
      {!compact && (
        <span className="text-left leading-tight">
          <span className="block text-[12.5px] font-medium">Privacy Shield</span>
          <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>
            {amber ? 'Integrations active' : 'All data stays local'}
          </span>
        </span>
      )}
    </button>
  )
}
