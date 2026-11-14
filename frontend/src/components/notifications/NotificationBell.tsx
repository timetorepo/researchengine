/* BoardUI notification-center layout adaptation, MIT (2026 Mertcan Dundar Esmergul).
 * Real existing local store only; no demonstration people or notifications. */
import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Bell, CheckCheck, Download, Info, BookOpen, X } from 'lucide-react'
import { useNotifications, notifications, type NotificationKind } from '@/lib/notifications/store'
import { timeAgo } from '@/lib/utils'
const ICONS = { update: Download, recommendations: BookOpen, info: Info }
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const items = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread' | NotificationKind>('all')
  const unread = items.filter((item) => !item.read).length
  const shown = items.filter((item) => tab === 'all' || (tab === 'unread' ? !item.read : item.kind === tab))
  const tabs = [['all', 'All'], ['unread', 'Unread'], ['update', 'Updates'], ['recommendations', 'Reading'], ['info', 'Info']] as const
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'} className={compact ? 're-notify-btn compact relative' : 're-notify-btn relative'}>
      <Bell size={compact ? 17 : 16} strokeWidth={1.5} />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[var(--primary)] text-white text-[9px] px-1 min-w-3">{unread}</span>}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={10} className="z-[210]">
      <Popover.Popup className="bui-popover !p-0 w-[360px]" aria-label="Notification center">
        <header className="p-4 flex items-center gap-2 border-b border-[var(--surface-border)]"><div className="flex-1"><h2 className="font-semibold text-sm">Notifications</h2><p className="text-xs text-[var(--text-3)]">{unread} unread</p></div>
          <button className="bui-icon-button" onClick={() => notifications.markAllRead()} aria-label="Mark all notifications read" disabled={!unread}><CheckCheck size={16} /></button>
          <Popover.Close className="bui-icon-button" aria-label="Close notifications"><X size={16} /></Popover.Close>
        </header>
        <div className="flex gap-1 overflow-x-auto p-2" role="group" aria-label="Notification filters">{tabs.map(([id, label]) => <button key={id} className="px-2 py-1.5 rounded-lg text-xs whitespace-nowrap" aria-pressed={tab === id} style={{ background: tab === id ? 'var(--elevated)' : undefined }} onClick={() => setTab(id)}>{label}</button>)}</div>
        <div className="max-h-[min(420px,60dvh)] overflow-auto">
          {!shown.length && <p className="p-5 text-xs text-[var(--text-3)]">{items.length ? 'No notifications in this filter.' : 'No notifications yet. Updates and enabled reading recommendations appear here.'}</p>}
          {shown.map((item, index) => { const Icon = ICONS[item.kind]; const group = new Date(item.at).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier'; const previousGroup = index > 0 && (new Date(shown[index - 1].at).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier'); return <div key={item.id}>{group !== previousGroup && <h3 className="px-4 py-2 text-[11px] text-[var(--text-3)]">{group}</h3>}<article key={item.id} className="flex gap-3 p-4 border-t border-[var(--surface-border)]" style={{ background: item.read ? undefined : 'color-mix(in srgb,var(--primary) 6%,transparent)' }}>
            <Icon size={16} className="shrink-0 mt-0.5 text-[var(--text-2)]" /><div className="min-w-0 flex-1">
              {item.href ? <a href={item.href} className="font-medium hover:underline" onClick={() => { notifications.markRead(item.id); setOpen(false) }}>{item.title}</a> : <button className="font-medium text-left" onClick={() => notifications.markRead(item.id)}>{item.title}</button>}
              {item.body && <p className="text-[var(--text-2)] mt-1">{item.body}</p>}<p className="text-[10px] text-[var(--text-3)] mt-2">{timeAgo(item.at)}</p>
            </div><button className="shrink-0 self-start p-1" aria-label={`Dismiss ${item.title}`} onClick={() => notifications.remove(item.id)}><X size={14} /></button>
          </article></div> })}
        </div>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>
}
