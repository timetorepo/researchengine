/**
 * The agent's work as a vertical timeline (spaceui Timeline).
 *
 * Each step is one thing the AI did to the project: a file it read, a change it
 * wrote, a command it ran, a git operation (a commit or push it made shows up as
 * the command). Steps are the same activity lines the list view shows, oldest
 * first, so the two views always agree.
 */
import { useMemo } from 'react'
import {
  Timeline, TimelineItem, TimelineIndicator, TimelineSeparator,
  TimelineHeader, TimelineTitle, TimelineDate, TimelineContent,
} from '@/components/ui/spaceui/timeline'
import type { IdeActivity } from '@/lib/chat/tools'
import { describeActivity } from '@/lib/ide/agents'

const TONE: Record<IdeActivity['kind'], string> = {
  read: 'var(--ide-accent)',
  write: 'var(--ide-ok, var(--success))',
  run: 'var(--ide-warn, var(--warning))',
  search: 'var(--ide-accent)',
  list: 'var(--ide-faint)',
  error: 'var(--ide-danger, var(--danger))',
}

function clockOf(at?: number): string {
  const d = new Date(at ?? Date.now())
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

export function AgentChangeTimeline({ lines, live = false, onOpen, empty = 'No steps yet.' }: {
  lines: IdeActivity[]
  live?: boolean
  onOpen?: (path: string, line?: number) => void
  empty?: string
}) {
  // Oldest first, capped to the last 80 steps so a long session stays light.
  const steps = useMemo(() => lines.slice(-80), [lines])

  if (!steps.length) {
    return <div className="px-3 py-6 text-center text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>{empty}</div>
  }

  return (
    <div className="px-3 py-3">
      {live && (
        <div className="mb-2 text-[11px]" style={{ color: 'var(--ide-faint)' }}>
          <span className="re-pulse-dot" /> working
        </div>
      )}
      <Timeline value={steps.length} orientation="vertical" className="gap-0">
        {steps.map((line, i) => {
          const { verb, detail } = describeActivity(line)
          const tone = TONE[line.kind] ?? 'var(--ide-faint)'
          const target = line.path ?? line.command ?? ''
          const clickable = !!line.path && !!onOpen
          const body = (
            <>
              <TimelineTitle className="text-[12px] font-medium" style={{ color: 'var(--ide-text, inherit)' }}>{verb}</TimelineTitle>
              {target && (
                <TimelineContent className="truncate font-mono text-[11px]" style={{ color: 'var(--ide-faint)' }}>
                  {target}
                </TimelineContent>
              )}
              {detail && (
                <TimelineContent className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>{detail}</TimelineContent>
              )}
            </>
          )
          return (
            <TimelineItem key={line.id ?? `${line.at}-${i}`} step={i + 1} className="pb-4">
              <TimelineIndicator
                className="size-2.5 border-0 -start-[21px] top-1.5"
                style={{ background: tone }}
              />
              <TimelineSeparator className="bg-[var(--ide-border)]" />
              <TimelineHeader className="flex items-baseline gap-2">
                {clickable ? (
                  <button type="button" className="text-left min-w-0" onClick={() => onOpen!(line.path!, line.line)} title={`Open ${line.path}`}>
                    {body}
                  </button>
                ) : (
                  <div className="min-w-0">{body}</div>
                )}
              </TimelineHeader>
              <TimelineDate className="tabular-nums text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>{clockOf(line.at)}</TimelineDate>
            </TimelineItem>
          )
        })}
      </Timeline>
    </div>
  )
}
