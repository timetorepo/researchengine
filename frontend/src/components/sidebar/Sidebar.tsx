import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, MessageSquare, BookOpen, GraduationCap, Library, Users, Settings, Plus, UserRound,
  Trash2, Search, ShieldCheck, PanelLeftClose, PanelLeftOpen, Compass, X, Pencil, Check, Swords,
  Sun, Moon, RotateCcw, Pin, PinOff, Download, FolderInput, Workflow as WorkflowIcon, Code as CodeIcon,
} from 'lucide-react'
import { download, timeAgo } from '@/lib/utils'
import { THEMES } from '@/lib/themes/meta'
import { useStore } from '@/stores/useStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { withProfileDefaults } from '@/lib/profile'
import { useUI } from '@/stores/useUI'
import type { ThemeId } from '@/types'
import { AppLogo } from '@/components/shared/AppLogo'
import { useVirtualList } from '@/hooks/useVirtualList'
import { navigateReady } from '@/lib/routes/registry'
import { clsx } from 'clsx'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  // Keep Coding near the top in collapsed ResearchEngineOS navigation so it
  // remains discoverable even when the compact rail has limited height.
  { to: '/code', label: 'Coding', icon: CodeIcon },
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/quiz', label: 'Read & Quiz', icon: GraduationCap },
  { to: '/articles', label: 'Articles', icon: BookOpen },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/compare', label: 'Compare', icon: Swords },
  { to: '/workflows', label: 'Workflows', icon: WorkflowIcon },
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
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Research and coding conversations are different work; the history list
  // shows one kind at a time rather than interleaving them.
  const [kindFilter, setKindFilter] = useState<'research' | 'coding'>('research')
  // The route whose chunk is being fetched. The row you clicked says so, so a
  // cold page is visibly "yours" instead of a click that seemed to do nothing.
  const routeLoading = useUI((s) => s.routeLoading)
  const pendingFor = (to: string) => routeLoading === to

  // Close the mobile drawer whenever the route changes (covers every nav action),
  // and when the viewport grows past the drawer breakpoint. Without this the
  // drawer + its scrim stay mounted over the new page, blanking the screen and
  // swallowing clicks.
  useEffect(() => {
    if (useUI.getState().sidebarOpenMobile) useUI.setState({ sidebarOpenMobile: false })
    // location.key changes on every navigation, even to the same route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onResize = () => { if (mq.matches && useUI.getState().sidebarOpenMobile) useUI.setState({ sidebarOpenMobile: false }) }
    mq.addEventListener('change', onResize)
    return () => mq.removeEventListener('change', onResize)
  }, [])

  const closeMobile = () => { if (useUI.getState().sidebarOpenMobile) useUI.setState({ sidebarOpenMobile: false }) }

  const filtered = useMemo(() => {
    let list = chats
    // `kind` is optional on chats written before it existed — those are research.
    if (kindFilter === 'coding') list = list.filter((c) => c.kind === 'coding')
    else list = list.filter((c) => c.kind !== 'coding')
    if (spaceFilter) list = list.filter((c) => c.spaceId === spaceFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
    }
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [chats, spaceFilter, query, kindFilter])

  const unpinned = useMemo(() => filtered.filter((c) => !c.pinned), [filtered])
  const virt = useVirtualList(unpinned.length, 44)

  const width = collapsed ? 60 : 264

  const body = (
    <div className={clsx('re-vt-sidebar h-full flex flex-col', floating && 'h-full rounded-2xl overflow-hidden')}
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
        <DockRail>
          <DockItem index={0} label="Expand sidebar" onClick={() => ui.toggleSidebar()}>
            <PanelLeftOpen size={18} strokeWidth={1.5} />
          </DockItem>
          <DockItem index={1} label="New research" onClick={() => { const id = useStore.getState().newChat(); closeMobile(); navigate(`/chat/${id}`) }}>
            <Plus size={18} strokeWidth={1.5} />
          </DockItem>
          <DockDivider />
          {NAV.map((n, i) => {
            const active = n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
            return (
              <DockItem key={n.to} index={i + 2} label={n.label} active={active} pending={pendingFor(n.to)}
                onClick={() => { closeMobile(); void navigateReady({ href: `#${n.to}`, push: (href) => navigate(href.replace(/^#/, '')) }) }}>
                <n.icon size={18} strokeWidth={1.5} />
              </DockItem>
            )
          })}
          <DockSpacer />
          <DockDivider />
          <DockItem index={NAV.length + 2} label="Theme" onClick={() => useUI.getState().openSettings('appearance')}>
            <DockThemeIcon />
          </DockItem>
          <DockItem index={NAV.length + 3} label="Settings" onClick={() => useUI.getState().openSettings()}>
            <Settings size={18} strokeWidth={1.5} />
          </DockItem>
          <DockItem index={NAV.length + 4} label="Profile" onClick={() => useUI.getState().openSettings('profile')}>
            <UserAvatar size={22} />
          </DockItem>
        </DockRail>
      ) : (
        <>
          {/* New chat */}
          <div className="px-3 mt-1">
            <button
              onClick={() => { const id = useStore.getState().newChat(spaceFilter ?? undefined); closeMobile(); navigate(`/chat/${id}`) }}
              className="re-new-research w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-[13px] font-medium transition-all duration-200 hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6)] hover:-translate-y-px active:translate-y-0"
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

          {/* Nav. Hover lifts the row, grows its icon and slides the label; the
              active marker carries `re-nav-indicator`, so navigating animates it
              from the item you left to the item you arrived at. */}
          <nav className="px-3 mt-3 flex flex-col gap-0.5 re-icon-stagger">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={(e) => {
                  closeMobile()
                  // Let the chunk arrive first — the page you are on stays
                  // clickable while it does.
                  e.preventDefault()
                  void navigateReady({ href: `#${n.to}`, push: (href) => navigate(href.replace(/^#/, '')) })
                }}
                data-pending={pendingFor(n.to) ? 'true' : 'false'}
                aria-busy={pendingFor(n.to) || undefined}
                className="re-nav-item group flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[13px] overflow-hidden"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--text)' : 'var(--text-2)',
                  // Only the active row sets a background inline — a transparent
                  // inline value would win over the stylesheet's hover wash.
                  background: isActive ? 'var(--elevated)' : undefined,
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="re-nav-marker"
                        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                        className="re-nav-indicator absolute w-[3px] rounded-full"
                        style={{ left: 0, top: '50%', marginTop: -9, height: 18, background: 'var(--primary)' }}
                        aria-hidden
                      />
                    )}
                    <n.icon size={17} strokeWidth={1.5} className="transition-transform" />
                    <span className="group-hover:translate-x-0.5 transition-transform duration-200">{n.label}</span>
                  </>
                )}
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
            <div className="re-history-tabs" role="tablist" aria-label="Conversation kind">
              <button role="tab" aria-selected={kindFilter === 'research'} data-active={kindFilter === 'research'}
                onClick={() => setKindFilter('research')}>
                Research
              </button>
              <button role="tab" aria-selected={kindFilter === 'coding'} data-active={kindFilter === 'coding'}
                onClick={() => setKindFilter('coding')}>
                Coding
              </button>
              <span className="re-history-count">{filtered.length}</span>
            </div>
            <div ref={virt.ref} onScroll={virt.onScroll} className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
                  No research yet.
                  <br />Your conversations stay on this device.
                </div>
              ) : (
                <>
                  {/* Pinned section */}
                  {filtered.some((c) => c.pinned) && (
                    <div className="mb-1">
                      <div className="px-2.5 pb-1 pt-1.5 text-[9.5px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        <Pin size={9} /> Pinned
                      </div>
                      {filtered.filter((c) => c.pinned).map((c) => (
                        <ChatItem key={c.id} id={c.id} title={c.title} when={c.updatedAt} pinned kind={c.kind} />
                      ))}
                    </div>
                  )}
                  <div style={virt.containerStyle}>
                    <div style={{ transform: `translateY(${virt.offset}px)` }}>
                      {unpinned.slice(virt.slice.start, virt.slice.end).map((c) => (
                        <ChatItem key={c.id} id={c.id} title={c.title} when={c.updatedAt} kind={c.kind} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer (expanded rail only — the collapsed rail is one dock).
          The privacy shield moved to the top bar: it reports on the whole app,
          so it should not be hidden when the sidebar is. */}
      {!collapsed && (
        <div className="px-2 py-2 space-y-0.5" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <ThemeQuickToggle collapsed={false} />
          <SettingsLauncher collapsed={false} />
          <ProfilePill collapsed={false} />
        </div>
      )}
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

/* ------------------------------------------------------------------ */
/* The dock                                                            */
/*                                                                     */
/* When the sidebar is collapsed it stops being a list of links and    */
/* becomes a dock: point at an icon and it swells, its neighbours lean */
/* away to make room, and the name appears beside it. Same gesture as  */
/* the macOS dock / Cult UI's Dock component, vertical, and driven by  */
/* hover state rather than pointer geometry so it behaves identically  */
/* under a mouse, a trackpad or a touch has no hover to give.          */
/* ------------------------------------------------------------------ */

interface DockCtxValue { hovered: number | null; setHovered: (i: number | null) => void }
const DockCtx = createContext<DockCtxValue | null>(null)

/** Scale and lean for an item `d` places away from the pointed-at one. */
export function dockMetrics(d: number | null) {
  if (d === null) return { scale: 1, lean: 0, dim: false }
  if (d === 0) return { scale: 1.6, lean: 0, dim: false }
  if (d === 1) return { scale: 1.26, lean: 8, dim: false }
  if (d === 2) return { scale: 1.08, lean: 3, dim: false }
  return { scale: 1, lean: 0, dim: true }
}

function DockRail({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <DockCtx.Provider value={{ hovered, setHovered }}>
      <div
        className="re-dock flex-1 min-h-0 flex flex-col items-center pt-1 pb-2"
        onMouseLeave={() => setHovered(null)}
        data-dock="true"
      >
        {children}
      </div>
    </DockCtx.Provider>
  )
}

function DockItem({ index, label, active = false, pending = false, onClick, children, tone }: {
  index: number
  label: string
  active?: boolean
  /** Its route chunk is loading right now. */
  pending?: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: string
}) {
  const ctx = useContext(DockCtx)
  const itemRef = useRef<HTMLDivElement>(null)
  const [labelAt, setLabelAt] = useState<{ x: number; y: number } | null>(null)
  // The name is drawn in a portal at the icon's screen position. Coding mode's
  // workbench builds its own stacking context, so a label positioned inside the
  // rail was being painted under it — the "text disappears in coding mode"
  // report. A portal has no ancestor to be trapped by.
  useEffect(() => {
    if (ctx?.hovered !== index) { setLabelAt(null); return }
    const el = itemRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setLabelAt({ x: r.right + 10, y: r.top + r.height / 2 })
  }, [ctx?.hovered, index])
  const hovered = ctx?.hovered ?? null
  const d = hovered === null ? null : Math.abs(index - hovered)
  const { scale, lean } = dockMetrics(d)
  const pointed = hovered === index
  const dir = hovered === null ? 0 : Math.sign(index - hovered)
  const color = tone ?? (active ? 'var(--primary)' : 'var(--text-2)')

  return (
    <div
      className="re-dock-item relative flex justify-center"
      style={{ zIndex: pointed ? 6 : 1 }}
      onMouseEnter={() => ctx?.setHovered(index)}
      onFocus={() => ctx?.setHovered(index)}
      onBlur={() => ctx?.setHovered(null)}
    >
      <motion.div
        animate={{ scale, y: dir * lean }}
        transition={{ type: 'spring', damping: 20, stiffness: 420, mass: 0.6 }}
        className="relative"
        ref={itemRef}
      >
        <button
          onClick={onClick}
          aria-label={label}
          title={label}
          aria-current={active ? 'page' : undefined}
          className="relative flex items-center justify-center w-9 h-9 rounded-[11px] transition-colors"
          style={{
            color,
            background: active ? 'var(--elevated)' : pointed ? 'var(--elevated)' : 'transparent',
            boxShadow: pointed ? '0 8px 22px -10px rgba(0,0,0,0.55)' : 'none',
          }}
        >
          {active && <span className="re-nav-indicator absolute left-[-5px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full" style={{ background: 'var(--primary)' }} />}
          {children}
          {pending && <span className="re-dock-pending" aria-hidden />}
        </button>

      </motion.div>

      {/* The name, only for the icon under the pointer — portal-ed so no
          ancestor's overflow or stacking context can swallow it. */}
      {createPortal(
        <AnimatePresence>
          {pointed && labelAt && (
            <motion.span
              initial={{ opacity: 0, x: -8, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.94 }}
              transition={{ type: 'spring', damping: 22, stiffness: 400 }}
              className="re-dock-label pointer-events-none fixed -translate-y-1/2 whitespace-nowrap px-2.5 py-1 rounded-[9px] text-[11.5px] font-medium surface-elevated"
              style={{ left: labelAt.x, top: labelAt.y, color: 'var(--text)', boxShadow: '0 10px 28px -12px rgba(0,0,0,0.5)' }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** A hairline between dock groups, indented like the macOS dock's dividers. */
function DockDivider() {
  return <div className="w-6 my-1.5 shrink-0" style={{ borderTop: '1px solid var(--surface-border)' }} />
}

/** Sun/moon for the dock, independent of the expanded footer's control. */
function DockThemeIcon() {
  const theme = useStore((s) => s.settings.theme)
  const isDark = THEMES.find((t) => t.id === theme)?.kind !== 'light'
  return isDark ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />
}

/** Bottom padding that makes the collapsed rail feel like a shelf rather than
 *  a column that ran out of room. */
function DockSpacer() {
  return <div className="flex-1 min-h-2" />
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

function ChatItem({ id, title, when, pinned, kind }: { id: string; title: string; when: number; pinned?: boolean; kind?: string }) {
  const { id: activeId } = useParams()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(title)
  const active = activeId === id
  const spaces = useStore((s) => s.spaces)

  const setPinned = (v: boolean) => useStore.setState((s) => ({
    chats: s.chats.map((c) => c.id === id ? { ...c, pinned: v } : c),
  }))
  const moveToSpace = (spaceId?: string) => useStore.setState((s) => ({
    chats: s.chats.map((c) => c.id === id ? { ...c, spaceId } : c),
  }))
  const exportChat = () => {
    const chat = useStore.getState().chats.find((c) => c.id === id)
    if (!chat) return
    download(`${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'chat'}.json`,
      JSON.stringify(chat, null, 2), 'application/json')
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="group chat-row flex items-center rounded-[10px] mb-0.5 relative"
      data-active={active}
      data-kind={kind === 'coding' ? 'coding' : 'research'}
      style={{ height: 44 }}
      onContextMenu={(e) => { e.preventDefault(); setMenu(true) }}
    >
      <button
        onClick={() => { useStore.getState().setActiveChat(id); navigate(`/chat/${id}`) }}
        onDoubleClick={() => { setDraft(title); setRenaming(true) }}
        title={title}
        className="flex-1 min-w-0 text-left px-2.5 py-2"
      >
        {renaming ? (
          <input
            autoFocus value={draft} maxLength={40}
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
            <div className="text-[13px] truncate flex items-center gap-1" style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}>
              {pinned && <Pin size={10} className="shrink-0" style={{ color: 'var(--warning)' }} />}
              {kind === 'coding' && <CodeIcon size={11} className="shrink-0" style={{ color: 'var(--primary)' }} />}
              <span className="chat-title truncate">{title}</span>
            </div>
            <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{timeAgo(when)}</div>
          </>
        )}
      </button>

      <div className="hidden group-hover:flex items-center gap-0.5 pr-2">
        <button aria-label="More options" title="Rename / Pin / Export / Move / Delete" className="p-1 rounded hover:bg-[var(--surface)]" style={{ color: 'var(--text-3)' }}
          onClick={() => setMenu(true)}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-2 top-10 z-[61] min-w-[160px] surface-elevated p-1 rounded-[12px]"
              style={{ boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)', border: '1px solid var(--surface-border)' }}
            >
              <CtxItem icon={<Pencil size={13} />} label="Rename" onClick={() => { setMenu(false); setDraft(title); setRenaming(true) }} />
              <CtxItem icon={pinned ? <PinOff size={13} /> : <Pin size={13} />} label={pinned ? 'Unpin' : 'Pin'} onClick={() => { setPinned(!pinned); setMenu(false) }} />
              <CtxItem icon={<Download size={13} />} label="Export as JSON" onClick={() => { exportChat(); setMenu(false) }} />
              <div className="px-2 pt-1.5 pb-0.5 text-[9.5px] uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                <FolderInput size={9} /> Move to space
              </div>
              {spaces.map((sp) => (
                <CtxItem key={sp.id} icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: sp.color }} />}
                  label={sp.name} onClick={() => { moveToSpace(sp.id); setMenu(false) }} />
              ))}
              <CtxItem icon={<Trash2 size={13} />} label="Delete" danger onClick={() => { useStore.getState().deleteChat(id); setMenu(false) }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-[12.5px] text-left transition-colors hover:bg-[var(--surface)]"
      style={{ color: danger ? 'var(--danger)' : 'var(--text-2)' }}>
      {icon} {label}
    </button>
  )
}

/** Settings button — always visible, always in the same spot. Opens the
 *  slide-in Settings overlay (preserves current page context). */
function SettingsLauncher({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      onClick={() => useUI.getState().openSettings()}
      className={clsx(
        'pressable flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]',
        collapsed ? 'p-2' : 'w-full px-2.5 py-2',
      )}
      aria-label="Settings" title="Settings (Cmd/Ctrl+,)"
      style={{ color: 'var(--text-2)' }}
    >
      <Settings size={18} strokeWidth={1.5} />
      {!collapsed && <span className="text-[12.5px] font-medium">Settings</span>}
      {!collapsed && <kbd className="ml-auto text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>⌘,</kbd>}
    </button>
  )
}

/** Theme quick-toggle — click cycles favorited themes; long-press opens the picker. */
function ThemeQuickToggle({ collapsed }: { collapsed: boolean }) {
  const theme = useStore((s) => s.settings.theme)
  const favorites = useStore((s) => s.settings.themeFavorites) ?? ['dark', 'light', 'catppuccin-mocha']
  const [pickerOpen, setPickerOpen] = useState(false)
  const pressTimer = useRef<any>(null)
  const longPressed = useRef(false)
  const isDark = THEMES.find((t) => t.id === theme)?.kind !== 'light'
  const favs: ThemeId[] = favorites.length ? favorites : ['dark', 'light']

  const cycle = () => {
    const idx = favs.indexOf(theme)
    const next = favs[(idx + 1) % favs.length] ?? 'dark'
    useStore.setState((s) => ({ settings: { ...s.settings, theme: next } }))
  }

  return (
    <div className="relative">
      <button
        onPointerDown={() => { longPressed.current = false; pressTimer.current = setTimeout(() => { longPressed.current = true; useUI.getState().openSettings('appearance') }, 600) }}
        onPointerUp={() => clearTimeout(pressTimer.current)}
        onPointerLeave={() => clearTimeout(pressTimer.current)}
        onClick={() => { if (!longPressed.current) cycle() }}
        className={clsx(
          'pressable flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]',
          collapsed ? 'p-2' : 'w-full px-2.5 py-2',
        )}
        aria-label="Cycle theme" title="Click: cycle themes · hold: Appearance settings"
        style={{ color: 'var(--text-2)' }}
      >
        {isDark ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
        {!collapsed && (
          <span className="text-[12.5px] flex-1 text-left truncate">{THEMES.find((t) => t.id === theme)?.name ?? theme}</span>
        )}
      </button>

      <AnimatePresence>
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="absolute bottom-full left-0 mb-2 z-50 w-[248px] surface-elevated p-2 grid grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto"
              style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
            >
              {THEMES.map((t) => (
                <button key={t.id}
                  onClick={() => { useStore.setState((s) => ({ settings: { ...s.settings, theme: t.id } })); setPickerOpen(false) }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-[8px] text-[11px] text-left transition-colors hover:bg-[var(--elevated)]"
                  style={{ color: t.id === theme ? 'var(--primary)' : 'var(--text-2)', border: t.id === theme ? '1px solid var(--primary)' : '1px solid transparent' }}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.swatches[2] }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** User profile pill — avatar, name, presence dot. Popover with profile options. */
function ProfilePill({ collapsed }: { collapsed: boolean }) {
  const name = useStore((s) => s.settings.profileName) ?? 'Researcher'
  const handle = withProfileDefaults(useStore((s) => s.settings.profile)).handle
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(name)

  return (
    <div className="relative">
      <button
        onClick={() => { setDraft(name); setOpen((o) => !o) }}
        className={clsx('pressable flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]', collapsed ? 'p-1.5' : 'w-full px-2 py-1.5')}
        aria-label="Profile"
      >
        <span className="relative shrink-0">
          <UserAvatar size={28} />
          <span className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--success)', border: '2px solid var(--bg)' }} />
        </span>
        {!collapsed && (
          <span className="text-left min-w-0">
            <span className="block text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
            <span className="block text-[9.5px] truncate" style={{ color: 'var(--text-3)' }}>@{handle} · Local</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="absolute bottom-full left-0 mb-2 z-50 w-[240px] surface-elevated p-3"
              style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <UserAvatar size={40} />
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate">{name}</div>
                  <div className="text-[10.5px] font-mono truncate" style={{ color: 'var(--text-3)' }}>@{handle}</div>
                </div>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>Display name</div>
              <div className="flex gap-1.5 mb-3">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const nextName = draft.trim() || 'Researcher'
                    useStore.setState((s) => ({ settings: { ...s.settings, profileName: nextName, profile: withProfileDefaults({ ...s.settings.profile, name: nextName }) } }))
                    setOpen(false)
                  }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[8px] text-[12px] bg-transparent outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                <button
                  onClick={() => {
                    const nextName = draft.trim() || 'Researcher'
                    useStore.setState((s) => ({ settings: { ...s.settings, profileName: nextName, profile: withProfileDefaults({ ...s.settings.profile, name: nextName }) } }))
                    setOpen(false)
                  }}
                  className="px-2.5 rounded-[8px] text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}>
                  <Check size={13} />
                </button>
              </div>
              <button
                onClick={() => { setOpen(false); useUI.getState().openSettings('profile') }}
                className="w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-[8px] text-[12px] hover:bg-[var(--elevated)]"
                style={{ color: 'var(--text-2)' }}>
                <UserRound size={13} /> Edit profile &amp; avatar
              </button>
              <button
                onClick={() => { setOpen(false); useStore.setState((s) => ({ settings: { ...s.settings, onboarded: false } })) }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-[12px] hover:bg-[var(--elevated)]"
                style={{ color: 'var(--text-2)' }}>
                <RotateCcw size={13} /> Run setup again
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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
