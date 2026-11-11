import React, { useMemo, useState } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import { Check, GripVertical, Pin, PinOff, Shuffle, Trash2, Sparkles, ListChecks } from 'lucide-react'
import { clsx } from 'clsx'
import { shuffled } from '@/lib/ui/skins'
import type { Task } from '@/types'

/**
 * Shuffled Pinned List — rebuilt from Watermelon UI's `shuffle-pinned-item`
 * against this app's tokens, and pointed at the thing the app was missing:
 * a list of tasks where pinning is how you say "this one first".
 *
 * Behaviour kept from the original: pinned rows are pulled to the top with a
 * layout animation (so the promotion is visible rather than a jump), the
 * remaining rows re-deal in a stagger, and a shuffle button reorders the
 * unpinned tail without ever moving a pinned item.
 *
 * Behaviour added for ResearchEngine: rows drag to reorder (pinned and unpinned
 * alike), a pinned row paints the primary tone and shows its pin, done rows
 * settle down and stop competing for attention, and the whole list is the input
 * for "send these to the AI" — which is what makes a task list relevant in
 * Research *and* Coding mode.
 */
export interface ShuffledPinnedListProps {
  tasks: Task[]
  /** Promote/demote. */
  onPin?: (id: string, pinned: boolean) => void
  onToggleDone?: (id: string, done: boolean) => void
  onReorder?: (ids: string[]) => void
  onDelete?: (id: string) => void
  /** Send the pinned tasks to the composer as an instruction block. */
  onSendToAI?: (text: string) => void
  emptyHint?: string
  className?: string
}

export function taskToPrompt(task: Task): string {
  return `- ${task.title}${task.detail ? `: ${task.detail}` : ''}`
}

/** The instruction block the AI receives — pinned first, in list order. */
export function tasksToPrompt(tasks: Task[]): string {
  const live = tasks.filter((t) => !t.done)
  const pinned = live.filter((t) => t.pinned)
  const rest = live.filter((t) => !t.pinned)
  const lines: string[] = []
  if (pinned.length) {
    lines.push('Tackle these first, in this order:', ...pinned.map(taskToPrompt), '')
  }
  if (rest.length) {
    lines.push('Then, if there is time:', ...rest.map(taskToPrompt))
  }
  return lines.join('\n').trim()
}

export function ShuffledPinnedList({
  tasks, onPin, onToggleDone, onReorder, onDelete, onSendToAI, emptyHint = 'No tasks yet — add one above.', className,
}: ShuffledPinnedListProps) {
  const [seed, setSeed] = useState(0)

  const { pinned, rest, done } = useMemo(() => {
    const live = tasks.filter((t) => !t.done)
    return {
      pinned: live.filter((t) => t.pinned),
      // The shuffle only ever touches the unpinned tail, and it is stable for a
      // given seed so re-renders do not reshuffle under the pointer.
      rest: seed ? shuffled(live.filter((t) => !t.pinned), seed) : live.filter((t) => !t.pinned),
      done: tasks.filter((t) => t.done),
    }
  }, [tasks, seed])

  const ordered = [...pinned, ...rest]
  const pinnedIds = pinned.map((t) => t.id)

  const handleReorder = (next: Task[]) => {
    if (!onReorder) return
    // Reordering a partly-shuffled view must still write a stable global order:
    // keep done rows where they are and record the visible order verbatim.
    onReorder([...next.map((t) => t.id), ...done.map((t) => t.id)])
  }

  const promote = (id: string) => {
    if (onPin) {
      onPin(id, true)
      return
    }
    if (!onReorder) return
    const task = ordered.find((t) => t.id === id)
    if (!task) return
    handleReorder([task, ...ordered.filter((t) => t.id !== id)])
  }

  const send = () => {
    const text = tasksToPrompt(tasks)
    if (!text) return
    onSendToAI?.(text)
  }

  const Row = ({ task, index }: { task: Task; index: number }) => {
    const controls = useDragControls()
    return (
      <Reorder.Item
        value={task}
        id={task.id}
        dragListener={false}
        dragControls={controls}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: task.done ? 0.55 : 1, y: 0 }}
        exit={{ opacity: 0, x: -12, height: 0, marginBottom: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34, delay: Math.min(index * 0.02, 0.16) }}
        className={clsx('surface group flex items-start gap-2 p-2.5 mb-2 last:mb-0')}
        style={{
          borderColor: task.pinned ? 'color-mix(in srgb, var(--primary) 45%, var(--surface-border))' : 'var(--surface-border)',
          background: task.pinned ? 'color-mix(in srgb, var(--primary) 7%, var(--surface))' : undefined,
        }}
      >
        <button
          onPointerDown={(e) => controls.start(e)}
          className="mt-0.5 p-1 rounded-[7px] cursor-grab active:cursor-grabbing shrink-0"
          style={{ color: 'var(--text-3)' }}
          aria-label={`Reorder ${task.title}`}
        >
          <GripVertical size={13} />
        </button>

        <button
          onClick={() => onToggleDone?.(task.id, !task.done)}
          aria-pressed={!!task.done}
          aria-label={task.done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
          className="mt-0.5 shrink-0 w-4 h-4 rounded-[6px] flex items-center justify-center"
          style={{
            border: `1.5px solid ${task.done ? 'var(--success)' : 'var(--surface-border)'}`,
            background: task.done ? 'var(--success)' : 'transparent',
          }}
        >
          <AnimatePresence>
            {task.done && (
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                <Check size={10} color="#fff" strokeWidth={3.4} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="flex-1 min-w-0">
          <div className={clsx('text-[13px] leading-snug', task.done && 'line-through')} style={{ color: task.done ? 'var(--text-3)' : 'var(--text)' }}>
            {task.pinned && <Pin size={10} className="inline mr-1 -mt-0.5" style={{ color: 'var(--primary)' }} />}
            {task.title}
          </div>
          {task.detail && <div className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }}>{task.detail}</div>}
          {task.source && (
            <span className="inline-block mt-1 text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
              {task.source}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => promote(task.id)}
            className="p-1.5 rounded-[8px]"
            title={task.pinned ? 'Already pinned as the main thing' : 'Pin as the main thing'}
            style={{ color: task.pinned ? 'var(--primary)' : 'var(--text-3)' }}
            aria-label={task.pinned ? 'Pinned' : `Pin ${task.title}`}
          >
            <Pin size={13} />
          </button>
          {task.pinned && onPin && (
            <button onClick={() => onPin(task.id, false)} className="p-1.5 rounded-[8px]" style={{ color: 'var(--text-3)' }} aria-label={`Unpin ${task.title}`}>
              <PinOff size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-[8px]" style={{ color: 'var(--text-3)' }} aria-label={`Delete ${task.title}`}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </Reorder.Item>
    )
  }

  return (
    <div className={className} data-shuffled-pinned-list>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
          <ListChecks size={13} /> {pinned.length ? `${pinned.length} pinned` : 'nothing pinned'} · {tasks.filter((t) => !t.done).length} open
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11.5px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
            title="Shuffle the unpinned tasks"
          >
            <Shuffle size={12} /> Shuffle
          </button>
          {onSendToAI && tasks.some((t) => !t.done) && (
            <button
              onClick={send}
              className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11.5px]"
              style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}
              title="Send the pinned tasks to the AI, in order"
            >
              <Sparkles size={12} /> Send to AI
            </button>
          )}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="text-[12.5px] py-6 text-center rounded-[12px]" style={{ color: 'var(--text-3)', border: '1px dashed var(--surface-border)' }}>
          {emptyHint}
        </div>
      )}

      {onReorder ? (
        <Reorder.Group axis="y" values={ordered} onReorder={handleReorder} as="div" className="list-none p-0 m-0">
          <AnimatePresence initial={false}>
            {ordered.map((t, i) => <Row key={t.id} task={t} index={i} />)}
          </AnimatePresence>
        </Reorder.Group>
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {ordered.map((t, i) => <Row key={t.id} task={t} index={i} />)}
          </AnimatePresence>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>Done · {done.length}</div>
          <div className="flex flex-wrap gap-1.5">
            {done.map((t) => (
              <button
                key={t.id}
                onClick={() => onToggleDone?.(t.id, false)}
                className="text-[11px] px-2 py-0.5 rounded-full line-through"
                style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}
                title="Mark as not done"
              >{t.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
