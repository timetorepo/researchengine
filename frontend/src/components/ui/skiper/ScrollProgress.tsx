import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Lock, Unlock, EyeOff, RotateCcw, GripVertical, Circle, CircleDot, BarChart3, Minus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuLabel,
  ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuItem,
} from '@/components/ui/context-menu'

/**
 * Scroll progress — reimplemented from Skiper UI's "scroll progress" (skiper89)
 * against this app's own surfaces, with the shapes you asked for.
 *
 * The interesting problem is not drawing a bar. It is that ResearchEngine has no
 * single scroll container: the chat transcript, the article body, the IDE panes,
 * the library grid and the workflow canvas all scroll inside themselves, and
 * several surfaces do not scroll at all. So the indicator:
 *
 *  1. listens for scroll in the capture phase and tracks whichever element is
 *     actually scrolling — no assumptions about layout, no hardcoded selectors;
 *  2. hides itself when the current surface cannot scroll (a progress bar that
 *     sits at 0% on a static page is noise);
 *  3. keeps a position **per surface**, because the safe place differs: clear of
 *     the chat composer on Chats, the assistant panel in Coding, the dock on
 *     Home — and it steps aside entirely when the Tasks panel is open;
 *  4. can be unlocked (right-click → Unlock) and dragged anywhere, and where you
 *     drop it is remembered for that surface;
 *  5. comes in four shapes, chosen from its own right-click menu:
 *       · Bar          — the thin track, with a percentage chip on hover
 *       · Circle       — a ring with a background track and the number inside
 *       · Circle (bare)— a ring with no track, no plate, no number
 *       · Top bar      — a hairline across the top of the page you are on
 */
export type ProgressMode = 'bar' | 'circle' | 'dot' | 'top'

export const PROGRESS_MODES: { id: ProgressMode; label: string; blurb: string; icon: React.ElementType }[] = [
  { id: 'bar', label: 'Bar', blurb: 'Thin track on the edge', icon: BarChart3 },
  { id: 'circle', label: 'Circle progress', blurb: 'Ring with a background', icon: CircleDot },
  { id: 'dot', label: 'Circle (bare)', blurb: 'Ring only, no background', icon: Circle },
  { id: 'top', label: 'Top bar', blurb: 'Hairline across the top', icon: Minus },
]

type SurfaceKey = 'home' | 'chats' | 'coding' | 'quiz' | 'articles' | 'library' | 'compare' | 'workflows' | 'flood' | 'other'

interface Placement {
  /** Distance from the right edge, px. */
  right: number
  /** Vertical centre as a percentage of the viewport height, or a px value. */
  top: string
}

/**
 * Default placements. Each one exists because something occupies that edge:
 * the composer on Chats, the assistant panel in Coding, the dock rail on Home.
 */
export const SURFACE_PLACEMENT: Record<SurfaceKey, Placement> = {
  home: { right: 18, top: '54%' },
  chats: { right: 20, top: '42%' },      // above the chat composer
  coding: { right: 22, top: '34%' },     // above the IDE's tab strip
  quiz: { right: 22, top: '50%' },
  articles: { right: 22, top: '50%' },
  library: { right: 22, top: '44%' },
  compare: { right: 22, top: '44%' },
  workflows: { right: 22, top: '40%' },  // clear of the canvas minimap corner
  flood: { right: 22, top: '44%' },
  other: { right: 20, top: '50%' },
}

export function surfaceOf(pathname: string): SurfaceKey {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/chat')) return 'chats'
  if (pathname.startsWith('/chats')) return 'chats'
  if (pathname.startsWith('/code')) return 'coding'
  if (pathname.startsWith('/quiz')) return 'quiz'
  if (pathname.startsWith('/articles') || pathname.startsWith('/article')) return 'articles'
  if (pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/compare')) return 'compare'
  if (pathname.startsWith('/workflows')) return 'workflows'
  if (pathname.startsWith('/flood')) return 'flood'
  return 'other'
}

/** The element that is currently scrolling in this app — capture phase catches them all. */
function useActiveScroller() {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const onScroll = (e: Event) => {
      const target = e.target
      if (target instanceof HTMLElement) {
        if (target.scrollHeight - target.clientHeight > 24) setEl(target)
      } else if (document.scrollingElement) {
        const se = document.scrollingElement as HTMLElement
        if (se.scrollHeight - se.clientHeight > 24) setEl(se)
      }
    }
    // `scroll` does not bubble, but capture sees every scroller's events.
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [])
  return el
}

/** The left edge of the page area, so a top bar never runs under the rail. */
function useContentLeft() {
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide ? (collapsed ? 60 : 264) : 0
}

export function ScrollProgress() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const setting = useStore((s) => s.settings.scrollProgress)
  const tasksOpen = useUI((s) => s.tasksOpen)
  const surface = surfaceOf(location.pathname)
  const contentLeft = useContentLeft()

  const scroller = useActiveScroller()
  const [progress, setProgress] = useState(0)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)

  const enabled = setting?.enabled !== false
  const unlocked = !!setting?.unlocked
  const mode: ProgressMode = setting?.mode ?? 'bar'
  const savedPos = setting?.perSurface?.[surface] ?? null

  const patch = useCallback((p: Partial<NonNullable<typeof setting>>) => {
    useStore.setState((s) => ({ settings: { ...s.settings, scrollProgress: { ...(s.settings.scrollProgress ?? {}), ...p } } }))
  }, [])

  // Progress of whichever container is scrolling; recomputed on every scroll
  // and when the route changes (the new surface may already be scrolled).
  useEffect(() => {
    if (!scroller) return
    const read = () => {
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
      setProgress(Math.max(0, Math.min(1, scroller.scrollTop / max)))
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(scroller)
    return () => { scroller.removeEventListener('scroll', read); ro.disconnect() }
  }, [scroller, location.pathname])

  // A surface with nothing to scroll hides the indicator entirely.
  const scrollable = !!scroller && scroller.scrollHeight - scroller.clientHeight > 24
  const shown = enabled && scrollable

  const placement = useMemo(() => {
    if (unlocked && savedPos) return savedPos
    const base = SURFACE_PLACEMENT[surface]
    // The tasks panel owns the right edge while it is open — step aside.
    return { right: base.right + (tasksOpen ? 392 : 0), top: base.top }
  }, [unlocked, savedPos, surface, tasksOpen])

  const trackRef = useRef<HTMLDivElement | null>(null)

  const scrollToRatio = (ratio: number) => {
    const el = scroller
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const top = Math.max(0, Math.min(1, ratio)) * max
    if (reduce) { el.scrollTop = top; return }
    try { el.scrollTo({ top, behavior: 'smooth' }) } catch { el.scrollTop = top }
  }

  const jumpTo = (clientY: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    scrollToRatio((clientY - rect.top) / rect.height)
  }

  // Drag: with the lock off, the pointer moves the indicator anywhere on screen.
  // The position is stored per surface, so unlocking on Chats does not move it
  // on the workflow canvas. Pointer events are coalesced to one store write per
  // frame, because each write persists the settings.
  const dragState = useRef<{ dx: number; dy: number } | null>(null)
  const dragFrame = useRef<number | null>(null)
  const pendingDragPos = useRef<{ right: number; top: string } | null>(null)
  useEffect(() => () => { if (dragFrame.current) cancelAnimationFrame(dragFrame.current) }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!unlocked) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current
    if (!d) return
    const x = Math.max(8, Math.min(window.innerWidth - 28, e.clientX - d.dx))
    const y = Math.max(56, Math.min(window.innerHeight - 60, e.clientY - d.dy))
    pendingDragPos.current = { right: window.innerWidth - x - 20, top: `${y}px` }
    if (dragFrame.current) return
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null
      const pos = pendingDragPos.current
      if (pos) patch({ perSurface: { ...(setting?.perSurface ?? {}), [surface]: pos } })
    })
  }
  const endDrag = () => { dragState.current = null; setDragging(false) }

  // Scrubbing on a ring: press anywhere on it and the angle sets the position.
  const scrubRing = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) + Math.PI / 2
    scrollToRatio(((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2)))
  }

  if (!shown) return null

  const fillPct = Math.round(progress * 100)
  const ringSize = mode === 'dot' ? 38 : 46

  /* ---------------- the shapes ---------------- */

  const track = (
    <div
      ref={trackRef}
      onPointerDown={(e) => { if (!unlocked) { jumpTo(e.clientY) } }}
      className="relative rounded-full overflow-hidden"
      style={{
        width: unlocked ? 10 : 5,
        height: 92,
        background: 'color-mix(in srgb, var(--text-3) 22%, transparent)',
        border: unlocked ? '1px dashed color-mix(in srgb, var(--primary) 55%, transparent)' : '1px solid transparent',
        cursor: unlocked ? 'grab' : 'pointer',
        touchAction: 'none',
      }}
    >
      <motion.div
        className="absolute left-0 right-0 top-0"
        style={{
          background: 'linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--secondary)))',
          borderRadius: 999,
        }}
        initial={false}
        animate={{ height: `${Math.max(6, fillPct)}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
      />
    </div>
  )

  const ring = (withTrack: boolean) => (
    <div
      onPointerDown={(e) => {
        if (unlocked) return
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        scrubRing(e)
      }}
      onPointerMove={(e) => { if (!unlocked && e.buttons === 1) scrubRing(e) }}
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: ringSize,
        height: ringSize,
        cursor: unlocked ? 'grab' : 'crosshair',
        background: withTrack ? 'var(--surface)' : 'transparent',
        border: withTrack ? '1px solid var(--surface-border)' : (unlocked ? '1px dashed color-mix(in srgb, var(--primary) 55%, transparent)' : 'none'),
        boxShadow: withTrack ? '0 10px 26px -14px rgba(0,0,0,0.55)' : 'none',
        backdropFilter: withTrack ? 'blur(10px)' : undefined,
        touchAction: 'none',
      }}
      title={unlocked ? 'Drag to move · right-click to lock' : 'Drag around the ring to scrub'}
    >
      <svg width={ringSize} height={ringSize} viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        {withTrack && (
          <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3"
            stroke="color-mix(in srgb, var(--text-3) 24%, transparent)" />
        )}
        <motion.circle
          cx="20" cy="20" r="16" fill="none" strokeWidth="3" strokeLinecap="round"
          stroke="var(--primary)"
          strokeDasharray={2 * Math.PI * 16}
          initial={false}
          animate={{ strokeDashoffset: 2 * Math.PI * 16 * (1 - progress) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 28 }}
        />
      </svg>
      {withTrack && (
        <span className="relative text-[10.5px] font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>
          {fillPct}
        </span>
      )}
    </div>
  )

  const topBar = (
    <div
      className="fixed z-40"
      style={{ left: contentLeft, right: 0, top: 0, height: 3, pointerEvents: 'none' }}
      aria-hidden
    >
      <motion.div
        className="h-full origin-left"
        style={{
          background: 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--secondary)))',
          boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 45%, transparent)',
        }}
        initial={false}
        animate={{ scaleX: Math.max(0.004, progress) }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 30 }}
      />
    </div>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {mode === 'top' ? (
            // A hairline across the top: no chrome, so the menu is on a wrapper
            // that covers the first few pixels of the page.
            <div
              data-scroll-progress="top"
              data-surface={surface}
              className="fixed z-40"
              style={{ left: contentLeft, right: 0, top: 0, height: 12, cursor: 'default' }}
            >
              {topBar}
              <AnimatePresence>
                {hover && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute right-2 top-1.5 px-1.5 py-0.5 rounded-[7px] text-[10.5px] font-mono pointer-events-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
                  >
                    {fillPct}%
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              data-scroll-progress={mode}
              data-surface={surface}
              data-unlocked={unlocked ? 'true' : 'false'}
              initial={false}
              animate={{ opacity: hover || dragging || unlocked ? 1 : (mode === 'bar' ? 0.55 : 0.82) }}
              transition={{ duration: 0.18 }}
              className="fixed z-30 select-none"
              style={{ right: placement.right, top: placement.top, transform: 'translateY(-50%)' }}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onPointerDown={unlocked ? onPointerDown : undefined}
              onPointerMove={unlocked ? onPointerMove : undefined}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              role="scrollbar"
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={fillPct}
              aria-label={`Scroll progress ${fillPct}%${unlocked ? ' — drag to move, right-click to lock' : ''}`}
              title={unlocked ? 'Drag to move · right-click to lock' : 'Right-click for shapes'}
            >
              <AnimatePresence>
                {hover && mode !== 'circle' && (
                  <motion.span
                    initial={{ opacity: 0, x: 6, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 6, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-[7px] text-[10.5px] font-mono pointer-events-none whitespace-nowrap"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
                  >
                    {unlocked && <GripVertical size={9} className="inline -mt-px mr-0.5" />}
                    {fillPct}%
                  </motion.span>
                )}
              </AnimatePresence>
              {mode === 'bar' ? track : ring(mode === 'circle')}
            </motion.div>
          )}
        </ContextMenuTrigger>

        {/* The progress bar's own menu. It stops the event from reaching the
            app-wide menu, which is why right-clicking here used to do nothing. */}
        <ContextMenuContent className="min-w-[232px]">
          <ContextMenuLabel>Progress shape</ContextMenuLabel>
          <ContextMenuRadioGroup value={mode} onValueChange={(v) => patch({ mode: v as ProgressMode })}>
            {PROGRESS_MODES.map((m) => (
              <ContextMenuRadioItem key={m.id} value={m.id} className="items-start">
                <m.icon size={13} className="mt-[3px] shrink-0" style={{ color: 'var(--text-3)' }} />
                <span className="min-w-0">
                  <span className="block">{m.label}</span>
                  <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>{m.blurb}</span>
                </span>
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => patch({ unlocked: !unlocked })}>
            {unlocked ? <Lock size={13} /> : <Unlock size={13} />}
            {unlocked ? 'Lock in place' : 'Unlock to drag'}
            <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {unlocked ? 'fits this tab again' : 'anywhere on screen'}
            </span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => {
            const next = { ...(setting?.perSurface ?? {}) }
            delete next[surface]
            patch({ perSurface: next, unlocked: false })
          }}>
            <RotateCcw size={13} /> Reset position for this tab
          </ContextMenuItem>
          <ContextMenuItem tone="danger" onSelect={() => patch({ enabled: false })}>
            <EyeOff size={13} /> Hide on every tab
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}
