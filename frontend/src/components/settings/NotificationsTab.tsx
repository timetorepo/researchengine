/**
 * Notifications.
 *
 * Two switches, because there are exactly two kinds of thing this app knows
 * that the user does not: a new release exists, and something arrived that
 * matches what they asked to watch. The first is on by default (an app that
 * updates itself should say when there is something to install); the second is
 * off, because recommendations are an interest you opt into, not a default.
 *
 * Nothing here sends anything anywhere. Turning both off leaves the bell in the
 * sidebar silent and the app never writes a notification.
 */
import React from 'react'
import { ArrowDownToLine, Sparkles, BellOff, Bell } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { notifications, useNotifications } from '@/lib/notifications/store'
import { Button } from '@/components/ui/heroui/Button'

export function NotificationsTab() {
  const settings = useStore((s) => s.settings)
  const items = useNotifications()
  const updatesOn = settings.notifyUpdates !== false
  const recsOn = settings.notifyRecommendations === true

  const set = (patch: Partial<typeof settings>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  return (
    <div className="max-w-[640px]">
      <h2 className="text-[16px] font-semibold mb-1">Notifications</h2>
      <p className="text-[12.5px] mb-5" style={{ color: 'var(--text-2)' }}>
        What the bell in the sidebar is allowed to tell you. Everything is produced on this device and listed in the bell; nothing is pushed anywhere.
      </p>

      <Row
        Icon={ArrowDownToLine}
        title="New releases"
        body="When the update check finds a newer Research Engine, it is announced once. Open Settings → Updates to read the notes and install it."
        on={updatesOn}
        onToggle={() => set({ notifyUpdates: !updatesOn })}
      />

      <Row
        Icon={Sparkles}
        title="Recommendations"
        body="Off by default. When on, new items pulled from the tags and RSS feeds you watch show up here, at most once a day."
        on={recsOn}
        onToggle={() => set({ notifyRecommendations: !recsOn })}
      />

      <div className="surface p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={13} style={{ color: 'var(--text-3)' }} />
          <span className="text-[12.5px] font-medium flex-1">What is in the bell right now</span>
          <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{items.length} item{items.length === 1 ? '' : 's'}</span>
        </div>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <BellOff size={13} /> Nothing yet — that is the normal state.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.slice(0, 8).map((n) => (
              <div key={n.id} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: n.read ? 'var(--text-3)' : 'var(--primary)' }} />
                <span className="flex-1 truncate">{n.title}</span>
                <span className="text-[10.5px] shrink-0" style={{ color: 'var(--text-3)' }}>{new Date(n.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => notifications.markAllRead()}>Mark all read</Button>
            <Button size="sm" variant="ghost" onClick={() => notifications.clear()}>Clear</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ Icon, title, body, on, onToggle }: {
  Icon: React.ElementType; title: string; body: string; on: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className="surface p-4 w-full text-left flex items-start gap-3 mb-2.5">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: on ? 'var(--primary)' : 'var(--text-3)' }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{body}</span>
      </span>
      <span className="relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5"
        style={{ background: on ? 'var(--success)' : 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
        <span className="absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </span>
    </button>
  )
}
