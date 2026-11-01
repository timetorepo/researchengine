/**
 * A notification list: a short feed of dated items, each with a kind dot, a
 * title, a line of detail and an optional action. Newest first.
 */
export interface NotificationItem { id: string; title: string; detail?: string; at: string; kind?: 'info' | 'success' | 'warning'; action?: { label: string; onSelect: () => void } }

const DOT: Record<NonNullable<NotificationItem['kind']>, string> = {
  info: 'var(--primary)',
  success: 'var(--success, #22c55e)',
  warning: 'var(--warning)',
}

export function NotificationList({ items, empty = 'Nothing new.' }: { items: NotificationItem[]; empty?: string }) {
  if (!items.length) return <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>{empty}</p>
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--surface-border)' }} aria-label="Notifications">
      {items.map((n) => (
        <li key={n.id} className="py-2.5 flex gap-3">
          <span aria-hidden className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: DOT[n.kind ?? 'info'] }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{n.title}</p>
              <time className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{n.at}</time>
            </div>
            {n.detail && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>{n.detail}</p>}
            {n.action && (
              <button type="button" onClick={n.action.onSelect} className="mt-1 text-[12px] underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                {n.action.label}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
