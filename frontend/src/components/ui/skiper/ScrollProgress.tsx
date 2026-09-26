import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Lock, Unlock, EyeOff, RotateCcw, GripVertical } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

/**
 * Scroll progress — reimplemented from Skiper UI's "scroll progress" (skiper89)
 * against this app's own surfaces.
 *
 * The interesting problem here is not drawing a bar. It is that ResearchEngine
 * has no single scroll container: the chat transcript, the article body, the IDE
 * panes, the library grid and the workflow canvas all scroll inside themselves,
 * and several surfaces do not scroll at all. So the indicator:
 *
 *  1. listens for scroll in the capture phase and tracks whichever element is
 *     actually scrolling — no assumptions about layout, no hardcoded selectors;
 *  2. hides itself when the current surface cannot scroll (a progress bar that
 *     sits at 0% on a static page is noise);
 *  3. sits at a position chosen **per surface**, because the safe place differs:
 *     clear of the chat composer on Chats, clear of the assistant panel in
 *     Coding, clear of the dock rail on Home — and it steps aside entirely when
 *     the Tasks panel is open, since that owns the right edge;
 *  4. can be unlocked from its context menu (right-click) and dragged anywhere,
 *     and the position you drop it at is remembered per surface.
 *
 * It is a thin track with a filled portion and a knob, click/drag on the track
 * to jump, and a percentage chip that only appears while you point at it.
 */

type SurfaceKey = 'home' | 'chats' | 'coding' | 'quiz' | 'articles' | 'library' | 'compare' | 'workflows' | 'flood' | 'other'

interface Placement {
  /** Distance from the right edge, px. */
  right: number
  /** Vertical centre as a percentage of the viewport height. */
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

export function ScrollProgress() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const setting = useStore((s) => s.settings.scrollProgress) ?? {}
  const tasksOpen = useUI((s) => s.tasksOpen)
  const surface = surfaceOf(location.pathname)

  const scroller = useActiveScroller()
  const [progress, setProgress] = useState(0)
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const enabled = setting.enabled !== false
  const unlocked = !!setting.unlocked
  const savedPos = setting.perSurface?.[surface] ?? null

  const patch = useCallback((p: Partial<typeof setting>) => {
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

  const jumpTo = (clientY: number) => {
    const el = scroller
    if (!el) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const max = el.scrollHeight - el.clientHeight
    const top = ratio * max
    if (reduce) { el.scrollTop = top; return }
    try { el.scrollTo({ top, behavior: 'smooth' }) } catch { el.scrollTop = top }
  }

  // Drag: with the lock off, the pointer moves the indicator anywhere on screen.
  // The position is stored per surface, so unlocking on Chats does not move it
  // on the workflow canvas.
  const dragState = useRef<{ dx: number; dy: number } | null>(null)
  // A drag fires a pointer event per frame; the store write (and its
  // persistence) is batched to one per frame so the drag stays smooth.
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
      if (pos) patch({ perSurface: { ...(setting.perSurface ?? {}), [surface]: pos } })
    })
  }
  const endDrag = () => { dragState.current = null; setDragging(false) }

  // Right-click → the unlock menu. Kept open until a choice is made.
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [menu])

  if (!shown) return null

  const fillPct = Math.round(progress * 100)

  return (
    <>
      <motion.div
        data-scroll-progress
        data-surface={surface}
        data-unlocked={unlocked ? 'true' : 'false'}
        initial={false}
        animate={{ opacity: hover || dragging || unlocked ? 1 : 0.55 }}
        transition={{ duration: 0.18 }}
        className="fixed z-30 select-none"
        style={{ right: placement.right, top: placement.top, transform: 'translateY(-50%)' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fillPct}
        aria-label={`Scroll progress ${fillPct}%${unlocked ? ' — drag to move, right-click to lock' : ''}`}
        title={unlocked ? 'Drag to move · right-click to lock' : 'Right-click to unlock and move'}
      >
        <AnimatePresence>
          {hover && (
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

        {/* The track doubles as a scrubber: press anywhere on it to jump. */}
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
              height: `${Math.max(6, fillPct)}%`,
              background: 'linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--secondary)))',
              borderRadius: 999,
            }}
            initial={false}
            animate={{ height: `${Math.max(6, fillPct)}%` }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="fixed z-[70] py-1 rounded-[12px] min-w-[190px]"
            style={{
              left: Math.min(menu.x, window.innerWidth - 210),
              top: Math.min(menu.y, window.innerHeight - 150),
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              boxShadow: '0 18px 40px -18px rgba(0,0,0,0.65)',
              backdropFilter: 'blur(14px)',
            }}
            role="menu"
          >
            <MenuItem
              icon={unlocked ? <Lock size={13} /> : <Unlock size={13} />}
              label={unlocked ? 'Lock in place' : 'Unlock to drag'}
              hint={unlocked ? 'Back to the position that fits this tab' : 'Then drag it anywhere on screen'}
              onClick={() => { patch({ unlocked: !unlocked }); setMenu(null) }}
            />
            <MenuItem
              icon={<RotateCcw size={13} />}
              label="Reset position"
              onClick={() => {
                const next = { ...(setting.perSurface ?? {}) }
                delete next[surface]
                patch({ perSurface: next, unlocked: false })
                setMenu(null)
              }}
            />
            <MenuItem
              icon={<EyeOff size={13} />}
              label="Hide on every tab"
              onClick={() => { patch({ enabled: false }); setMenu(null) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function MenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick}
      className="w-full flex items-start gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--elevated)]">
      <span className="mt-0.5" style={{ color: 'var(--text-3)' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>{hint}</span>}
      </span>
    </button>
  )
}
