/**
 * "What just happened" — the Cursor habit.
 *
 * Cursor's trick is not the edits, it is that you can always see what the model
 * looked at and where it wrote: read this file, edited that one, ran this
 * command. Every IDE tool call in this app emits an activity line (see
 * lib/chat/tools), so the same visibility exists for your own session and for
 * each background agent.
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, FilePlus2, PencilLine, TerminalSquare, Search, FolderTree, AlertTriangle, Sparkles } from 'lucide-react'
import type { IdeActivity } from '@/lib/chat/tools'
import { describeActivity } from '@/lib/ide/agents'

const ICON: Record<IdeActivity['kind'], React.ElementType> = {
  read: FileText,
  write: PencilLine,
  run: TerminalSquare,
  search: Search,
  list: FolderTree,
  error: AlertTriangle,
}

const TONE: Record<IdeActivity['kind'], string> = {
  read: 'var(--ide-accent)',
  write: 'var(--ide-ok, var(--success))',
  run: 'var(--ide-warn, var(--warning))',
  search: 'var(--ide-accent)',
  list: 'var(--ide-faint)',
  error: 'var(--ide-danger, var(--danger))',
}

export function ActivityRow({ line, onOpen, compact = false }: {
  line: IdeActivity
  onOpen?: (path: string, line?: number) => void
  compact?: boolean
}) {
  const Icon = line.kind === 'write' && line.created ? FilePlus2 : (ICON[line.kind] ?? Sparkles)
  const { verb, detail } = describeActivity(line)
  const tone = TONE[line.kind] ?? 'var(--ide-faint)'
  const at = new Date(line.at ?? Date.now())
  const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:${String(at.getSeconds()).padStart(2, '0')}`

  const body = (
    <>
      <span className="re-act-icon" style={{ color: tone }}><Icon size={12} /></span>
      <span className="min-w-0 flex-1">
        <span className="re-act-verb">{verb}</span>
        {line.path && <span className="re-act-path" title={line.path}>{line.path}</span>}
        {!line.path && line.command && <span className="re-act-path" title={line.command}>{line.command}</span>}
        {detail && <span className="re-act-detail">{line.kind === 'write' ? detail : `· ${detail}`}</span>}
      </span>
      {!compact && <span className="re-act-clock tabular-nums">{clock}</span>}
    </>
  )

  if (line.path && onOpen) {
    return (
      <button
        className="re-act-row"
        data-kind={line.kind}
        onClick={() => onOpen(line.path!, line.line)}
        title={`Open ${line.path}`}
      >{body}</button>
    )
  }
  return <div className="re-act-row" data-kind={line.kind}>{body}</div>
}

export function AgentTimeline({ lines, onOpen, empty = 'Nothing yet — the AI has not touched the project in this session.', live = false, height = 'auto' }: {
  lines: IdeActivity[]
  onOpen?: (path: string, line?: number) => void
  empty?: string
  live?: boolean
  height?: number | string
}) {
  if (!lines.length) {
    return (
      <div className="px-3 py-6 text-center text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>
        {empty}
      </div>
    )
  }
  return (
    <div className="re-timeline" style={{ maxHeight: height }}>
      {live && (
        <div className="re-timeline-live">
          <span className="re-pulse-dot" /> working
        </div>
      )}
      <AnimatePresence initial={false}>
        {[...lines].slice(-60).reverse().map((line) => (
          <motion.div
            key={line.id ?? `${line.at}-${line.path ?? line.command ?? line.kind}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
          >
            <ActivityRow line={line} onOpen={onOpen} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
