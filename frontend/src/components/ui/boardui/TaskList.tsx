/* Original Research Engine equivalent of BoardUI Pro's publicly demonstrated agent task log. */
import { useState } from 'react'
import { CheckCircle2, ChevronRight, Clock3, FileCode2, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import type { ToolActivity } from '@/types'
export function BoardTaskList({ activities }: { activities: ToolActivity[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return <section className="bui-task-list mb-3" aria-label="Agent task activity">
    <h3 className="text-xs font-medium mb-2">Tool activity <span className="text-[var(--text-3)]">{activities.filter((a) => a.status === 'completed').length}/{activities.length} completed</span></h3>
    {activities.map((activity) => {
      const running = activity.status === 'running' || activity.status === 'waiting'
      const Icon = { queued: Clock3, running: Loader2, waiting: Clock3, completed: CheckCircle2, failed: XCircle, blocked: ShieldAlert, cancelled: XCircle }[activity.status]
      const open = expanded[activity.id] ?? (running || activity.status === 'failed' || activity.status === 'blocked')
      return <div key={activity.id} className="border-l border-[var(--surface-border)] pl-3 py-1">
        <button type="button" className="flex w-full gap-2 items-center text-left py-1.5 text-xs" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [activity.id]: !open }))}>
          <Icon size={14} className={activity.status === 'running' ? 'animate-spin shrink-0' : 'shrink-0'} /><span className="font-medium flex-1 min-w-0 truncate">{activity.tool.replace(/_/g, ' ')}</span><span className="text-[var(--text-3)]">{activity.status}</span><ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : undefined }} />
        </button>
        {open && <div className="text-xs text-[var(--text-2)] pb-2 pl-5">
          <p>{activity.status === 'queued' ? 'Queued for execution.' : activity.status === 'waiting' ? 'Waiting for your response.' : activity.status === 'running' ? 'Tool call in progress.' : activity.status === 'completed' ? 'Tool returned successfully.' : activity.status === 'blocked' ? 'The operation was blocked.' : activity.status === 'cancelled' ? 'The call was cancelled.' : 'The tool reported a failure.'}</p>
          {activity.resource && <span className="inline-flex max-w-full items-center gap-1 mt-2 p-1 rounded-md bg-[var(--elevated)]"><FileCode2 size={12} className="shrink-0" /><span className="truncate">{activity.resource}</span></span>}
          {activity.endedAt && <p className="text-[10px] text-[var(--text-3)] mt-1">{((activity.endedAt - activity.startedAt) / 1000).toFixed(1)}s</p>}
        </div>}
      </div>
    })}
  </section>
}
