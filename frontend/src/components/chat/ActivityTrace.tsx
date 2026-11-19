import { useState } from 'react'
import { CheckCircle2, Clock3, FileCode2, Loader2, ShieldAlert, Wrench, XCircle } from 'lucide-react'
import type { ChatMessage, ToolActivity } from '@/types'
import { Trace, TraceLine, TraceIcon, TraceTitle, TraceDescription, TraceCollapsible, TraceCollapsibleTrigger, TraceCollapsibleContent } from '@/components/ui/sortui/trace'

type Entry = { id: string; tool: string; status: ToolActivity['status']; resource?: string; label?: string; seconds?: number }
const descriptions: Record<ToolActivity['status'], string> = {
  queued: 'Queued for execution.', running: 'Tool call in progress.', waiting: 'Waiting for your response.',
  completed: 'Tool returned successfully.', failed: 'The tool reported a failure.', blocked: 'The operation was blocked.', cancelled: 'The call was cancelled.',
}
/** Only recorded public activity metadata. No tool arguments, outputs or reasoning. */
export function activityEntries(activities?: ToolActivity[], legacy?: ChatMessage['toolTrace']): Entry[] {
  if (activities?.length) return activities.map(a => ({ id:a.id, tool:a.tool, status:a.status, resource:a.resource,
    seconds: a.endedAt !== undefined && Number.isFinite(a.startedAt) && Number.isFinite(a.endedAt) && a.endedAt >= a.startedAt ? (a.endedAt-a.startedAt)/1000 : undefined }))
  return (legacy ?? []).map((a,index) => ({id:`legacy-${index}`,tool:a.tool,label:a.label,status:({ok:'completed',error:'failed',blocked:'blocked',confirm:'waiting'} as const)[a.status]}))
}
export function ActivityTrace({ activities, legacy, onOpenGraph }: { activities?: ToolActivity[]; legacy?: ChatMessage['toolTrace']; onOpenGraph?: () => void }) {
  const entries = activityEntries(activities,legacy)
  if (!entries.length) return null
  return <section className="re-activity-trace mb-3" aria-label="AI activity history">
    <h3>Tool activity <span>{entries.filter(e=>e.status==='completed').length}/{entries.length} completed</span></h3>
    <Trace>{entries.map(entry => <ActivityRow key={entry.id} entry={entry} onOpenGraph={onOpenGraph} />)}</Trace>
  </section>
}
function ActivityRow({entry,onOpenGraph}:{entry:Entry;onOpenGraph?:()=>void}) {
  const [override,setOverride] = useState<boolean>()
  const open = override ?? ['running','waiting','failed','blocked'].includes(entry.status)
  const Icon = { queued:Clock3,running:Loader2,waiting:Clock3,completed:CheckCircle2,failed:XCircle,blocked:ShieldAlert,cancelled:XCircle }[entry.status] ?? Wrench
  const status = entry.status==='running' ? 'running' : entry.status==='failed'||entry.status==='blocked' ? 'error' : entry.status==='queued'||entry.status==='waiting' ? 'pending' : undefined
  return <TraceCollapsible open={open} onOpenChange={setOverride} data-activity-status={entry.status}>
    <TraceCollapsibleTrigger><TraceLine status={status}>
      <TraceIcon><Icon className={entry.status==='running'?'re-trace-spinner':undefined} /></TraceIcon>
      <TraceTitle>{entry.tool.replace(/_/g,' ')}</TraceTitle><TraceDescription>{entry.status}</TraceDescription>
      {entry.seconds !== undefined && <TraceDescription>{entry.seconds.toFixed(1)}s</TraceDescription>}
    </TraceLine></TraceCollapsibleTrigger>
    <TraceCollapsibleContent><p>{descriptions[entry.status]}</p>
      {entry.label && <p className="re-trace-resource">{entry.label}</p>}
      {entry.resource && <p className="re-trace-resource"><FileCode2 size={12} aria-hidden="true" />{entry.resource}</p>}
      {entry.label?.startsWith("Bird's-eye graph:") && onOpenGraph && <button className="re-trace-link" type="button" onClick={onOpenGraph}>Open graph</button>}
      {entry.seconds===undefined && !['running','queued','waiting'].includes(entry.status) && <p className="re-trace-unknown">Duration not recorded.</p>}
    </TraceCollapsibleContent>
  </TraceCollapsible>
}
