/**
 * The bell.
 *
 * SmoothUI's Notification Badge does the counting (it animates the number
 * rather than swapping it, and drops to a dot when motion is reduced), so the
 * badge is the component the round asked for and the panel is this app's own.
 *
 * Everything shown here was produced locally: a release the update check found,
 * or recommendations pulled from the tags and feeds the user chose to watch.
 * There is no push service, and the recommendation notices do not exist at all
 * unless they were switched on in Settings → Notifications.
 */
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Download, Sparkles, Info, CheckCheck, Trash2, X } from 'lucide-react'
import NotificationBadge from '@/components/smoothui/notification-badge'
import { useNotifications, notifications, type AppNotification, type NotificationKind } from '@/lib/notifications/store'
import { timeAgo } from '@/lib/utils'

const KIND_ICON: Record<NotificationKind, React.ElementType> = {
  update: Download,
  recommendations: Sparkles,
  info: Info,
}

const KIND_TONE: Record<NotificationKind, string> = {
  update: 'var(--primary)',
  recommendations: 'var(--secondary)',
  info: 'var(--text-3)',
}

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const items = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const unread = items.filter((i) => !i.read).length

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openPanel = () => {
    setOpen((v) => {
      const next = !v
      // Opening the panel is reading it — a badge that stays lit after you have
      // looked at the list is a badge that lies.
      if (next) setTimeout(() => notifications.markAllRead(), 900)
      return next
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={openPanel}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        className={compact ? 're-notify-btn compact' : 're-notify-btn'}
        title="Notifications"
      >
        <NotificationBadge count={unread} max={9} variant="count" position="top-right" ping={false} showZero={false}>
          <Bell size={compact ? 17 : 16} strokeWidth={1.5} />
        </NotificationBadge>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[38px] w-[320px] rounded-[14px] overflow-hidden z-[80]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.55)' }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-[12px] font-medium flex-1">Notifications</span>
              {items.length > 0 && (
                <>
                  <button onClick={() => notifications.markAllRead()} title="Mark everything read" className="p-1 rounded-md hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                    <CheckCheck size={13} />
                  </button>
                  <button onClick={() => notifications.clear()} title="Clear the list" className="p-1 rounded-md hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close notifications" className="p-1 rounded-md hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                <X size={13} />
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-4 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  Nothing yet. When a new release is found it lands here, and recommendations can be switched on in Settings → Notifications.
                </p>
              ) : (
                items.map((n) => <Row key={n.id} n={n} onNavigate={() => setOpen(false)} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ n, onNavigate }: { n: AppNotification; onNavigate: () => void }) {
  const Icon = KIND_ICON[n.kind] ?? Info
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5" style={{ borderBottom: '1px solid var(--surface-border)', background: n.read ? 'transparent' : 'color-mix(in srgb, var(--primary) 7%, transparent)' }}>
      <Icon size={13} className="mt-0.5 shrink-0" style={{ color: KIND_TONE[n.kind] }} />
      <div className="min-w-0 flex-1">
        <a
          href={n.href ?? '#'}
          onClick={() => { notifications.markRead(n.id); onNavigate() }}
          className="text-[12px] font-medium leading-snug hover:underline block"
          style={{ color: 'var(--text)' }}>
          {n.title}
        </a>
        {n.body && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{n.body}</p>}
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{timeAgo(n.at)}</span>
      </div>
      <button onClick={() => notifications.remove(n.id)} title="Dismiss" className="p-1 rounded-md hover:bg-[var(--elevated)] shrink-0" style={{ color: 'var(--text-3)' }}>
        <X size={11} />
      </button>
    </div>
  )
}
