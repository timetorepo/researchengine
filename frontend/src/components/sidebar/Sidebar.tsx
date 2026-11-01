import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Home, MessageSquare, BookOpen, GraduationCap, Library, Users, Settings, Plus, UserRound,
  ShieldCheck, PanelLeftClose, PanelLeftOpen, Compass, Check, Swords,
  Sun, Moon, RotateCcw, Download, FolderInput, Workflow as WorkflowIcon, Code as CodeIcon, ScanText, MessageSquarePlus,
  ChevronRight,
} from 'lucide-react'
import { download } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { THEMES } from '@/lib/themes/meta'
import { useStore } from '@/stores/useStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { withProfileDefaults } from '@/lib/profile'
import { useUI } from '@/stores/useUI'
import type { ThemeId } from '@/types'
import { AppLogo } from '@/components/shared/AppLogo'
import { prefetchRoute, routePathOf, navigateNow } from '@/lib/routes/registry'
import { ChatsFlyout, ChatCube, useHoverDwell, CHATS_DWELL_MINIMIZED_MS, CHATS_DWELL_EXPANDED_MS } from './ChatsFlyout'
import { Portal } from '@/lib/dom/portal'
import { clsx } from 'clsx'
import { Bot as BotIcon, Briefcase, CalendarDays, Store } from 'lucide-react'
import { openMarketplace } from '@/lib/composio/sync'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  // Keep Coding near the top in collapsed ResearchEngineOS navigation so it
  // remains discoverable even when the compact rail has limited height.
  { to: '/code', label: 'Coding', icon: CodeIcon },
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/quiz', label: 'Learn', icon: GraduationCap },
  { to: '/articles', label: 'Articles', icon: BookOpen },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/compare', label: 'Compare', icon: Swords },
  { to: '/workflows', label: 'Workflows', icon: WorkflowIcon },
  { to: '/bots', label: 'Bots', icon: BotIcon },
  { to: '/crm', label: 'CRM', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/flood', label: 'Agent Flood', icon: Users },
  { to: '/alpha', label: 'removerAlpha', icon: ScanText },
  { to: '/feedback', label: 'Feedback', icon: MessageSquarePlus },
]

export function Sidebar({ floating = false }: { floating?: boolean }) {
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const mobileOpen = useUI((s) => s.sidebarOpenMobile)
  const ui = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  // The route whose chunk is being fetched. The row you clicked says so, so a
  // cold page is visibly "yours" instead of a click that seemed to do nothing.
  const routeLoading = useUI((s) => s.routeLoading)
  const pendingFor = (to: string) => routeLoading === to
  // Warming a chunk on hover is what makes the click instant *and* lets the
  // view transition run (transitions only animate between pages that are both
  // ready). A hint, never a requirement.
  const warm = (to: string) => { void prefetchRoute(routePathOf(`#${to}`)) }

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

  // The sidebar is navigation only. Spaces, the research/coding switch and the
  // full history all live on the Chats page (where there is room to search and
  // filter), and recent conversations are one hover away on the Chats item.

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
        {!collapsed && <div className="min-w-0 flex-1 overflow-hidden"><AppLogo size={26} /></div>}
        {collapsed && <AppLogo size={26} withName={false} />}
        {!collapsed && (
          <>
            {/* Notifications live where the app is: in the rail, next to the
                name, so a released update or a recommendation is visible from
                every screen without a second window. The two buttons keep their
                size; only the logo gives up room. */}
            <div className="shrink-0"><NotificationBell /></div>
            <button
              className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--elevated)]"
              style={{ color: 'var(--text-3)' }}
              onClick={() => ui.toggleSidebar()}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} strokeWidth={1.5} />
            </button>
          </>
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
                onHover={() => warm(n.to)}
                dwellMs={n.to === '/chats' ? CHATS_DWELL_MINIMIZED_MS : 0}
                pillMorph={n.to === '/chats'}
                flyout={n.to === '/chats' ? <ChatsFlyout onNavigate={closeMobile} /> : undefined}
                onClick={() => { closeMobile(); navigateNow({ href: `#${n.to}`, push: (href) => navigate(href.replace(/^#/, '')) }) }}>
                <n.icon size={18} strokeWidth={1.5} />
              </DockItem>
            )
          })}
          <DockItem index={NAV.length + 2} label="Marketplace" onClick={() => openMarketplace()}>
            <Store size={18} strokeWidth={1.5} />
          </DockItem>
          <DockSpacer />
          <DockDivider />
          <DockItem index={NAV.length + 3} label="Theme" onClick={() => useUI.getState().openSettings('appearance')}>
            <DockThemeIcon />
          </DockItem>
          <DockItem index={NAV.length + 4} label="Notifications" onClick={() => useUI.getState().openSettings('notifications')}>
            <NotificationBell compact />
          </DockItem>
          <DockItem index={NAV.length + 5} label="Settings" onClick={() => useUI.getState().openSettings()}>
            <Settings size={18} strokeWidth={1.5} />
          </DockItem>
          <DockItem index={NAV.length + 6} label="Profile" onClick={() => useUI.getState().openSettings('profile')}>
            <UserAvatar size={22} />
          </DockItem>
        </DockRail>
      ) : (
        <>
          {/* New chat */}
          <div className="px-3 mt-1">
            <button
              onClick={() => { const id = useStore.getState().newChat(); closeMobile(); navigate(`/chat/${id}`) }}
              className="re-new-research w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-[13px] font-medium transition-all duration-200 hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6)] hover:-translate-y-px active:translate-y-0"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <Plus size={16} strokeWidth={2} /> New research
            </button>
          </div>

          {/* Nav. Hover lifts the row, grows its icon and slides the label; the
              active marker carries `re-nav-indicator`, so navigating animates it
              from the item you left to the item you arrived at. */}
          <nav className="px-3 mt-3 flex flex-col gap-0.5 re-icon-stagger">
            {NAV.map((n) => (
              n.to === '/chats'
                ? <ChatsRow key={n.to} label={n.label} icon={n.icon} onBefore={closeMobile} warm={() => warm(n.to)} pending={pendingFor(n.to)} />
                : <NavRow key={n.to} to={n.to} label={n.label} icon={n.icon} end={n.end} onBefore={closeMobile} warm={() => warm(n.to)} pending={pendingFor(n.to)} />
            ))}
          </nav>

          {/* Marketplace: one row; the apps page opens from it. */}
          <div className="px-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <MarketplaceRow onBefore={closeMobile} />
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
/* Rail rows                                                           */
/*                                                                     */
/* Every row carries an arrow at its right edge — it is the affordance   */
/* for "this goes somewhere", it slides in when you point at the row,    */
/* and on Chats it is the thing that opens: rest on the row and the      */
/* arrow is replaced by a cube of your recent conversations.             */
/* ------------------------------------------------------------------ */

interface RowProps {
  to: string
  label: string
  icon: React.ComponentType<any>
  end?: boolean
  pending: boolean
  warm: () => void
  onBefore: () => void
}

/** The Marketplace entry in the nav column. It opens the marketplace page. */
function MarketplaceRow({ onBefore }: { onBefore: () => void }) {
  const count = useUI((s) => s.connectorsCount)
  return (
    <button
      type="button"
      onClick={() => { onBefore(); openMarketplace() }}
      className={rowClass}
      style={{ color: 'var(--text-2)' }}
    >
      <Store size={17} strokeWidth={1.5} />
      <span className="flex-1 min-w-0 truncate whitespace-nowrap group-hover:translate-x-0.5 transition-transform duration-200">Marketplace</span>
      {count > 0 && <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>{count} connected</span>}
      <ChevronRight size={14} aria-hidden className="re-nav-arrow ml-auto shrink-0 opacity-30 group-hover:opacity-80 transition-all duration-200" />
    </button>
  )
}

const rowClass = 're-nav-item group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[13px] overflow-hidden'
const rowStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? 'var(--text)' : 'var(--text-2)',
  // Only the active row sets a background inline — a transparent inline value
  // would win over the stylesheet's hover wash.
  background: isActive ? 'var(--elevated)' : undefined,
})

function useNavClick(to: string, onBefore: () => void) {
  const navigate = useNavigate()
  return (e: React.MouseEvent) => {
    onBefore()
    // The move happens now, in this tick. The chunk is usually already warm
    // from the hover; if it is not, the shell shows its skeleton and the
    // hairline — never a blocked click.
    e.preventDefault()
    navigateNow({ href: `#${to}`, push: (href) => navigate(href.replace(/^#/, '')) })
  }
}

export function NavRow({ to, label, icon: Icon, end, pending, warm, onBefore }: RowProps) {
  const onClick = useNavClick(to, onBefore)
  return (
    <NavLink to={to} end={end} onMouseEnter={warm} onFocus={warm} onClick={onClick}
      data-pending={pending ? 'true' : 'false'}
      aria-busy={pending || undefined}
      className={rowClass}
      style={rowStyle}
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
          <Icon size={17} strokeWidth={1.5} className="transition-transform" />
          {/* `nowrap` + `truncate` matters more than it looks: the rail animates
              its own width, and a label allowed to reflow mid-animation wraps to
              a second line — the "doubled label" ghost that kept coming back. */}
          <span className="flex-1 min-w-0 truncate whitespace-nowrap group-hover:translate-x-0.5 transition-transform duration-200">{label}</span>
          {/* Dim while you are elsewhere, bright while you point at it — and
              always present, so the row reads as a door rather than a label. */}
          <ChevronRight size={14} aria-hidden
            className={clsx('re-nav-arrow ml-auto shrink-0 transition-all duration-200',
              isActive ? 'opacity-70' : 'opacity-30 group-hover:opacity-80 group-hover:translate-x-0.5')} />
        </>
      )}
    </NavLink>
  )
}

/**
 * Chats keeps its arrow visible and, after a moment of rest, opens a cube of
 * recent conversations in place of it. The arrow is the seed of the cube: it
 * shrinks toward it, the cube grows from the same point, and both settle in one
 * spring. Nothing re-triggers while it is open.
 */
export function ChatsRow({ label, icon: Icon, pending, warm, onBefore }: Omit<RowProps, 'to' | 'end'>) {
  const onClick = useNavClick('/chats', onBefore)
  const pathname = useLocation().pathname
  const isActive = pathname.startsWith('/chats')
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const rowRef = useRef<HTMLAnchorElement | null>(null)
  const dwell = useHoverDwell(CHATS_DWELL_EXPANDED_MS)

  // Measure on arm (and keep it honest if the window moves underneath us).
  useEffect(() => {
    if (!dwell.armed) { setAnchor(null); return }
    const place = () => {
      const rect = rowRef.current?.getBoundingClientRect()
      if (rect) setAnchor({ x: rect.right + 10, y: rect.top + rect.height / 2 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [dwell.armed])

  return (
    <>
      <NavLink ref={rowRef as any} to="/chats" end={false}
        onMouseEnter={() => { warm(); dwell.onEnter() }}
        onMouseLeave={dwell.onLeave}
        onFocus={warm}
        onClick={(e) => { dwell.close(); onClick(e) }}
        data-pending={pending ? 'true' : 'false'}
        data-chats-row="true"
        data-flyout={dwell.armed ? 'true' : 'false'}
        aria-busy={pending || undefined}
        className={rowClass}
        style={rowStyle}
      >
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
          <Icon size={17} strokeWidth={1.5} className="transition-transform" />
          {/* `nowrap` + `truncate` matters more than it looks: the rail animates
              its own width, and a label allowed to reflow mid-animation wraps to
              a second line — the "doubled label" ghost that kept coming back. */}
          <span className="flex-1 min-w-0 truncate whitespace-nowrap group-hover:translate-x-0.5 transition-transform duration-200">{label}</span>
          {/* The seed: an arrow that becomes the cube. */}
          <motion.span
            aria-hidden
            className="re-nav-arrow ml-auto shrink-0 flex items-center justify-center"
            initial={false}
            animate={dwell.armed
              ? { scale: 0.72, opacity: 0.9, rotate: 0, borderRadius: 8 }
              : { scale: 1, opacity: 1, borderRadius: 999 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{
              width: 18, height: 18,
              background: dwell.armed ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-3)',
            }}
          >
            <ChevronRight size={14} />
          </motion.span>
        </>
      </NavLink>

      {/* Portal-ed so the sidebar's own clipping can never trim the cube, and
          positioned at the row it belongs to. */}
      <Portal>
        <div className="fixed z-[65]" style={{ left: anchor?.x ?? 0, top: anchor?.y ?? 0, transform: 'translateY(-50%)', pointerEvents: dwell.armed ? 'auto' : 'none' }}>
          <ChatCube open={dwell.armed && !!anchor} origin="left"
            onEnter={dwell.onEnter} onLeave={dwell.onLeave}>
            <ChatsFlyout onNavigate={dwell.close} />
          </ChatCube>
        </div>
      </Portal>
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

function DockItem({ index, label, active = false, pending = false, onClick, onHover, children, tone, dwellMs = 0, flyout, pillMorph = false }: {
  index: number
  label: string
  active?: boolean
  /** Its route chunk is loading right now. */
  pending?: boolean
  onClick: () => void
  /** Warm the route while the pointer is here. */
  onHover?: () => void
  children: React.ReactNode
  tone?: string
  /** Rest for this long and `flyout` opens (0 = never). */
  dwellMs?: number
  /** Panel shown after the dwell, anchored at this item's right edge. */
  flyout?: React.ReactNode
  /** While the flyout is open, swell the pill itself into a rounded cube. */
  pillMorph?: boolean
}) {
  const ctx = useContext(DockCtx)
  const itemRef = useRef<HTMLDivElement>(null)
  const [labelAt, setLabelAt] = useState<{ x: number; y: number } | null>(null)
  const dwell = useHoverDwell(dwellMs || 0, dwellMs > 0)
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
  // The name and the flyout are both measured from the live element, and both
  // are dropped the instant the pointer leaves — a stale measurement is what
  // left a ghost label behind in an earlier round.
  useEffect(() => {
    if (!dwell.armed) return
    const place = () => {
      const r = itemRef.current?.getBoundingClientRect()
      if (r) setLabelAt((cur) => cur ?? { x: r.right + 10, y: r.top + r.height / 2 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [dwell.armed])

  const hovered = ctx?.hovered ?? null
  const d = hovered === null ? null : Math.abs(index - hovered)
  const { scale, lean } = dockMetrics(d)
  const pointed = hovered === index
  const morphed = dwell.armed && pillMorph
  const dir = hovered === null ? 0 : Math.sign(index - hovered)
  const color = tone ?? (active ? 'var(--primary)' : 'var(--text-2)')

  return (
    <div
      className="re-dock-item relative flex justify-center"
      data-pointed={pointed ? 'true' : 'false'}
      style={{ zIndex: pointed ? 6 : 1 }}
      onMouseEnter={() => { ctx?.setHovered(index); onHover?.(); dwell.onEnter() }}
      onMouseLeave={dwell.onLeave}
      onFocus={() => { ctx?.setHovered(index); dwell.onEnter() }}
      onBlur={() => { ctx?.setHovered(null); dwell.onLeave() }}
    >
      <motion.div
        animate={{ scale: morphed ? scale * 1.12 : scale, y: dir * lean }}
        transition={{ type: 'spring', damping: 20, stiffness: 420, mass: 0.6 }}
        className="relative"
        ref={itemRef}
        data-flyout={morphed ? 'true' : 'false'}
      >
        <motion.button
          onClick={() => { dwell.close(); onClick() }}
          aria-label={label}
          title={label}
          aria-current={active ? 'page' : undefined}
          aria-expanded={dwellMs > 0 ? dwell.armed : undefined}
          initial={false}
          animate={{ borderRadius: morphed ? 18 : 11 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative flex items-center justify-center w-9 h-9 transition-colors"
          style={{
            color,
            background: active || pointed ? 'var(--elevated)' : 'transparent',
            boxShadow: pointed ? '0 8px 22px -10px rgba(0,0,0,0.55)' : 'none',
          }}
        >
          {active && <span className="re-nav-indicator absolute left-[-5px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full" style={{ background: 'var(--primary)' }} />}
          {children}
          {pending && <span className="re-dock-pending" aria-hidden />}
        </motion.button>

        {/* The cube grows out of the pill you were pointing at. */}
        {flyout && (
          <Portal>
            <div className="fixed z-[66]" style={{ left: (labelAt?.x ?? 0) + 8, top: labelAt?.y ?? 0, transform: 'translateY(-50%)', pointerEvents: dwell.armed ? 'auto' : 'none' }}>
              <ChatCube open={dwell.armed && !!labelAt} origin="left" onEnter={dwell.onEnter} onLeave={dwell.onLeave}>
                {flyout}
              </ChatCube>
            </div>
          </Portal>
        )}

        {/* The mirror under the highlighted icon (Cult UI's dock). */}
        {pointed && <span className="re-dock-reflection" aria-hidden>{children}</span>}
      </motion.div>

      {/* The name, only for the icon under the pointer — portal-ed so no
          ancestor's overflow or stacking context can swallow it. */}
      <Portal>
        <AnimatePresence>
          {pointed && labelAt && !morphed && (
            <motion.span
              initial={{ opacity: 0, x: -8, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.94 }}
              transition={{ type: 'spring', damping: 22, stiffness: 400 }}
              className="re-dock-label pointer-events-none fixed -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-[11px] text-[13.5px] font-medium surface-elevated"
              style={{ left: labelAt.x, top: labelAt.y, color: 'var(--text)', boxShadow: '0 10px 28px -12px rgba(0,0,0,0.5)' }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </Portal>
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
  return <div className="re-dock-spacer" />
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
      onClick={() => useUI.setState({ settingsSheet: true })}
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
        onPointerDown={() => { longPressed.current = false; pressTimer.current = setTimeout(() => { longPressed.current = true; setPickerOpen(true) }, 500) }}
        onPointerUp={() => clearTimeout(pressTimer.current)}
        onPointerLeave={() => clearTimeout(pressTimer.current)}
        onClick={() => { if (!longPressed.current) cycle() }}
        className={clsx(
          'pressable flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]',
          collapsed ? 'p-2' : 'w-full px-2.5 py-2',
        )}
        aria-label="Cycle theme" title="Click: cycle themes · hold: theme picker"
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
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(name)
  const initials = (name || 'Researcher').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'R'

  return (
    <div className="relative">
      <button
        onClick={() => { setDraft(name); setOpen((o) => !o) }}
        className={clsx('pressable flex items-center gap-2 rounded-[10px] transition-colors hover:bg-[var(--elevated)]', collapsed ? 'p-1.5' : 'w-full px-2 py-1.5')}
        aria-label="Profile"
      >
        <span className="relative shrink-0">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--primary) 22%, transparent)', color: 'var(--primary)' }}>
            {initials}
          </span>
          <span className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--success)', border: '2px solid var(--bg)' }} />
        </span>
        {!collapsed && (
          <span className="text-left min-w-0">
            <span className="block text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
            <span className="block text-[9.5px]" style={{ color: 'var(--text-3)' }}>Local · private</span>
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
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>Display name</div>
              <div className="flex gap-1.5 mb-3">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { useStore.setState((s) => ({ settings: { ...s.settings, profileName: draft.trim() || 'Researcher' } })); setOpen(false) } }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[8px] text-[12px] bg-transparent outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                <button
                  onClick={() => { useStore.setState((s) => ({ settings: { ...s.settings, profileName: draft.trim() || 'Researcher' } })); setOpen(false) }}
                  className="px-2.5 rounded-[8px] text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}>
                  <Check size={13} />
                </button>
              </div>
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
