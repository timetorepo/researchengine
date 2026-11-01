import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ToolChip } from '@/components/ui/easeui/tool-chip'
import { Check, ChevronDown, ChevronRight, GitFork, AlertTriangle, Terminal } from 'lucide-react'
import { Markdown } from '@/components/chat/Markdown'
import { clipOutput, summarizeArgs, type Item, type ToolItem } from '@/lib/codersa/timeline'
import type { Outcome } from './useCodersa'

const TOOL_LABEL: Record<string, string> = {
  bash: 'Command',
  str_replace_editor: 'Edit',
  read_file: 'Read',
  list_files: 'List',
}

/** How close to the bottom counts as "reading the end", so new output keeps the view there. */
const STICK_PX = 96

interface ThreadProps {
  items: Item[]
  hidden: number
  busy: boolean
  outcome: Outcome | null
  onFork: (at: number) => void
  canFork: boolean
  sessionKey: string | null
}

export function Thread({ items, hidden, busy, outcome, onFork, canFork, sessionKey }: ThreadProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // A new session starts at the bottom, and the view follows new output while the reader is there.
  useLayoutEffect(() => { stick.current = true }, [sessionKey])
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [items, busy, sessionKey])

  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
  }

  return (
    <div ref={scroller} onScroll={onScroll} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions"
      className="codersa-scroll flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-6 py-6 space-y-5">
        {hidden > 0 && (
          <p className="text-center text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {hidden} earlier {hidden === 1 ? 'item is' : 'items are'} kept in the session log. The latest {items.length} are shown.
          </p>
        )}
        {items.map((item) => (
          <ItemView key={item.id} item={item} canFork={canFork} onFork={onFork} />
        ))}
        {busy && <WorkingLine />}
        {!busy && outcome && <OutcomeLine outcome={outcome} />}
      </div>
    </div>
  )
}

const ItemView = memo(function ItemView({ item, canFork, onFork }: { item: Item; canFork: boolean; onFork: (at: number) => void }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="codersa-item codersa-enter flex justify-end">
          <div className="max-w-[78%] rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {item.text}
          </div>
        </div>
      )
    case 'assistant':
      return (
        <div className="codersa-item codersa-enter group relative text-[14px] leading-relaxed" style={{ color: 'var(--text)' }}>
          <Markdown content={item.text} />
          {canFork && item.at !== undefined && (
            <button onClick={() => onFork(item.at!)} aria-label="Fork a new session from here"
              className="absolute -bottom-5 left-0 flex items-center gap-1 text-[11px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              style={{ color: 'var(--text-3)' }}>
              <GitFork size={11} /> Fork from here
            </button>
          )}
        </div>
      )
    case 'tool':
      return <ToolCard item={item} />
    case 'error':
      return (
        <div className="codersa-item codersa-enter flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13px]"
          role="alert" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--text)' }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <span className="break-words min-w-0">{item.text}</span>
        </div>
      )
    case 'stopped':
      return <p className="codersa-item text-[12px]" style={{ color: 'var(--text-3)' }}>Stopped.</p>
  }
})

const ToolCard = memo(function ToolCard({ item }: { item: ToolItem }) {
  const [open, setOpen] = useState(false)
  const clipped = useMemo(() => clipOutput(item.output ?? ''), [item.output])
  const summary = summarizeArgs(item.name, item.args)
  const label = TOOL_LABEL[item.name] ?? item.name
  // ToolChip shows the state as a crossfading mark; a refused call keeps its own shield icon.
  const chipStatus = item.status === 'running' ? 'running' : item.status === 'refused' ? 'error' : 'done'

  return (
    <div className="codersa-item codersa-enter rounded-[14px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left min-w-0 hover:bg-[var(--elevated)] transition-colors">
        <span className="shrink-0"><ToolChip label={label} status={chipStatus} /></span>
        <span className="flex-1 min-w-0 truncate font-mono text-[12px]" style={{ color: 'var(--text-2)' }}>{summary || '—'}</span>
        {open ? <ChevronDown size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
          {item.name === 'bash' && (
            <pre className="codersa-scroll font-mono text-[12px] whitespace-pre-wrap break-all rounded-[10px] p-2.5 max-h-[120px] overflow-auto"
              style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
              <span style={{ color: 'var(--primary)' }}><Terminal size={11} className="inline mr-1" />$ </span>{summary}
            </pre>
          )}
          {item.status === 'refused' && (
            <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
              Codersa was not allowed to do this. {item.output?.startsWith('Shell is off') ? 'Turn on “Run commands” below to allow it for this message.' : ''}
            </p>
          )}
          {item.output !== undefined && (
            <pre className="codersa-scroll font-mono text-[11.5px] whitespace-pre-wrap break-all rounded-[10px] p-2.5 max-h-[280px] overflow-auto"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              {clipped.text || '(no output)'}
            </pre>
          )}
        </div>
      )}
    </div>
  )
})

function WorkingLine() {
  return (
    <div className="flex items-center gap-2 text-[12.5px]" role="status" style={{ color: 'var(--text-3)' }}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: 'var(--primary)' }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--primary)' }} />
      </span>
      Codersa is working…
    </div>
  )
}

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  // An error has its own line, and a stop is already written as a "Stopped." item.
  if (outcome.outcome === 'error' || outcome.outcome === 'stopped') return null
  const text = outcome.outcome === 'done'
    ? `Finished in ${outcome.steps} ${outcome.steps === 1 ? 'step' : 'steps'}.`
    : outcome.outcome === 'step-limit'
      ? `Reached the step limit (${outcome.steps}). Send a follow-up to keep going.`
      : 'Stopped.'
  return <p className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>{outcome.outcome === 'done' && <Check size={12} />}{text}</p>
}
