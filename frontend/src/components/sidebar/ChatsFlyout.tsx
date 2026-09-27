import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ArrowRight, Code2, Sparkles, Pin } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { navigateNow } from '@/lib/routes/registry'
import { timeAgo } from '@/lib/utils'

/**
 * Recent chats, on hover.
 *
 * Resting on the Chats item for a moment turns the item itself into a cube of
 * recent conversations: in the collapsed rail the *pill* opens up, in the
 * expanded rail the *edge arrow* opens up. One motion either way — the shell
 * grows from the thing you are pointing at, then its contents arrive in a short
 * stagger — and it never re-triggers while it is open.
 *
 * Dwell times are deliberately different, and they are not the same way round
 * as they look: 2s while the rail is minimised — the pointer is often just
 * travelling along the rail to another icon — and 1s on an expanded row, where
 * resting on a full-width row is intent.
 */
export const CHATS_DWELL_MINIMIZED_MS = 2000
export const CHATS_DWELL_EXPANDED_MS = 1000

/**
 * Arms after the pointer has rested for `ms`.
 *
 * Leaving does *not* close it instantly: the cube is drawn beside the thing you
 * are pointing at, so there is a few pixels of gap to cross, and an instant
 * close would shut the door as your pointer walks through it. A short grace
 * covers the crossing; arriving at the cube cancels the pending close, and
 * leaving both ends closes it for good.
 */
export function useHoverDwell(ms: number, enabled = true, graceMs = 240) {
  const [armed, setArmed] = useState(false)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearArm = () => { if (armTimer.current) { clearTimeout(armTimer.current); armTimer.current = null } }
  const clearClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  useEffect(() => () => { clearArm(); clearClose() }, [])
  return {
    armed,
    onEnter: () => {
      // Re-entering cancels a pending close first — including the case where the
      // pointer only brushed the item on its way across.
      clearClose()
      if (!enabled || armed) return
      clearArm()
      armTimer.current = setTimeout(() => setArmed(true), ms)
    },
    onLeave: () => {
      clearArm()
      if (!armed) return
      clearClose()
      closeTimer.current = setTimeout(() => setArmed(false), graceMs)
    },
    close: () => { clearArm(); clearClose(); setArmed(false) },
  }
}

const RECENT_LIMIT = 6

export function ChatsFlyout({ onNavigate, align = 'right' }: { onNavigate?: () => void; align?: 'right' | 'left' }) {
  const chats = useStore((s) => s.chats)
  const navigate = useNavigate()

  // Recent = whatever you touched last, research and coding together — the point
  // of the cube is "get me back to where I was", not "browse by kind".
  const recent = useMemo(
    () => [...chats].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, RECENT_LIMIT),
    [chats],
  )

  const open = (id: string) => {
    onNavigate?.()
    navigateNow({ href: `#/chat/${id}`, push: (href) => navigate(href.replace(/^#/, '')) })
  }

  return (
    <div className="w-[248px]">
      <div className="flex items-center gap-1.5 px-1 pb-1.5">
        <MessageSquare size={12} style={{ color: 'var(--primary)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-2)' }}>Recent chats</span>
        <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-3)' }}>{chats.length} total</span>
      </div>

      {recent.length === 0 ? (
        <div className="px-1 py-3 text-[11.5px] text-center" style={{ color: 'var(--text-3)' }}>
          Nothing yet — start a research chat and it lands here.
        </div>
      ) : (
        <div className="space-y-0.5 max-h-[228px] overflow-y-auto no-scrollbar">
          {recent.map((c, i) => {
            const coding = c.kind === 'coding'
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: align === 'right' ? 8 : -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 + i * 0.035, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => open(c.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[9px] text-left hover:bg-[var(--elevated)]"
              >
                {coding
                  ? <Code2 size={13} style={{ color: 'var(--success)' }} className="shrink-0" />
                  : <Sparkles size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] truncate" style={{ color: 'var(--text)' }}>{c.title || 'Untitled'}</span>
                  <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                    {coding && c.settings?.project ? `${c.settings.project} · ` : ''}{timeAgo(c.updatedAt ?? Date.now())}
                  </span>
                </span>
                {c.pinned && <Pin size={10} style={{ color: 'var(--text-3)' }} className="shrink-0" />}
              </motion.button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => { onNavigate?.(); navigate('/chats') }}
        className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 rounded-[9px] text-[11.5px] font-medium"
        style={{ background: 'color-mix(in srgb, var(--primary) 13%, transparent)', color: 'var(--primary)' }}
      >
        All chats <ArrowRight size={12} />
      </button>
    </div>
  )
}

/**
 * The cube shell: one spring, from the size of whatever you were pointing at to
 * the panel's full size. `from` decides the corner it appears to grow out of.
 */
export function ChatCube({
  open, onEnter, onLeave, children, origin = 'left',
}: {
  open: boolean
  onEnter?: () => void
  onLeave?: () => void
  children: React.ReactNode
  origin?: 'left' | 'right'
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cube"
          initial={{ opacity: 0, scale: 0.35, borderRadius: 18, x: origin === 'left' ? -14 : 14 }}
          animate={{ opacity: 1, scale: 1, borderRadius: 16, x: 0 }}
          exit={{ opacity: 0, scale: 0.5, borderRadius: 18, x: origin === 'left' ? -10 : 10 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
          style={{
            transformOrigin: origin === 'left' ? '0% 50%' : '100% 50%',
            background: 'var(--glass)',
            border: '1px solid var(--surface-border)',
            boxShadow: '0 24px 60px -24px rgba(0,0,0,0.65)',
            backdropFilter: 'blur(20px) saturate(1.4)',
          }}
          className="p-2"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
