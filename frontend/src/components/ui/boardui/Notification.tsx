/* BoardUI notification anatomy adapted to the existing Sonner lifetime host. MIT; see LICENSE. */
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import type { ToastTone } from '@/lib/notify'
export function BoardNotification({ title, body, tone, onDismiss }: { title: string; body?: string; tone: ToastTone; onDismiss: () => void }) {
  const Icon = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: XCircle }[tone]
  return <div className={`bui-notification bui-notification-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <Icon size={18} className="shrink-0 mt-0.5" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{title}</p>{body && <p className="text-xs mt-1 text-[var(--text-2)]">{body}</p>}</div>
    <button onClick={onDismiss} aria-label="Dismiss notification" className="p-1 shrink-0 rounded-lg"><X size={14} /></button>
  </div>
}
