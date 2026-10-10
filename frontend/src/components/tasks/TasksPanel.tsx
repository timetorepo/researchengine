import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Plus, ListChecks, Sparkles, Trash2, Pin } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { ShuffledPinnedList, tasksToPrompt } from '@/components/ui/watermelon/ShuffledPinnedList'
import { Button } from '@/components/ui/heroui/Button'
import { DUR, EASE, EASE_OUT } from '@/lib/ui/handoff'
import { smoothCaretProps } from '@/components/input/SmoothText'

/**
 * The task list, shared by Research and Coding.
 *
 * "Tasks for user" and "tasks for the AI" are the same list: pinning a task is
 * how you say *this is the main thing*, and pinned rows are handed to the model
 * ahead of everything else — in order. So the panel has two jobs and one shape:
 * write it down, pin what matters, then send it.
 */
export function TasksPanel() {
  const open = useUI((s) => s.tasksOpen)
  const tasks = useStore((s) => s.tasks)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')

  const close = () => useUI.setState({ tasksOpen: false })

  /**
   * Clicking out closes the panel — and it *animates* out while it does.
   *
   * This component used to return `null` before its own `AnimatePresence` was
   * ever rendered, so the exit branch was dead code: the panel vanished the
   * instant the flag changed. The list now stays mounted while it slides away,
   * which is also what lets the backdrop fade with it instead of blinking.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const add = (pinned = false) => {
    const t = title.trim()
    if (!t) return
    useStore.getState().addTask(t, { detail: detail.trim() || undefined, pinned, source: 'you' })
    setTitle('')
    setDetail('')
  }

  const sendToAI = (text: string) => {
    // The task text lands in whichever composer is open — the research one or
    // the coding one — through the shared seed channel.
    useUI.setState({ composerSeed: text, tasksOpen: false })
    useUI.getState().toast('Tasks handed to the AI', 'They are in the composer, pinned first — review and send.', 'success')
  }

  const copy = () => {
    const text = tasksToPrompt(tasks)
    if (!text) return
    void navigator.clipboard?.writeText(text)
    useUI.getState().toast('Checklist copied', 'Pinned tasks first, in order.', 'success')
  }

  const done = tasks.filter((t) => t.done).length
  const pinned = tasks.filter((t) => t.pinned && !t.done).length

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tasks-scrim"
          className="fixed inset-0 z-[59]"
          style={{ background: 'color-mix(in srgb, var(--scrim) 55%, transparent)', backdropFilter: 'blur(3px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT }}
          onClick={close}
          aria-hidden="true"
        />
      )}
      {open && (
      <motion.aside
        key="tasks"
        initial={{ x: 380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0 }}
        transition={{ duration: DUR.slow, ease: EASE }}
        className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[92vw] z-[60] flex flex-col"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--surface-border)', backdropFilter: 'blur(18px)' }}
        aria-label="Tasks"
        data-tasks-panel
      >
        <header className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <ListChecks size={16} style={{ color: 'var(--primary)' }} />
          <span className="text-[14px] font-medium flex-1">Tasks</span>
          {done > 0 && (
            <button onClick={() => useStore.getState().clearDoneTasks()} className="text-[11.5px] flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <Trash2 size={12} /> clear {done} done
            </button>
          )}
          <button onClick={close} className="p-1.5 rounded-[8px]" style={{ color: 'var(--text-3)' }} aria-label="Close tasks"><X size={15} /></button>
        </header>

        <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="relative">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(e.shiftKey); if (e.key === 'Escape') close() }}
              placeholder="What needs doing?  ⏎ adds · ⇧⏎ pins"
              className="w-full px-3 py-2 rounded-[10px] bg-transparent outline-none text-[13px]"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
              autoFocus
              {...smoothCaretProps()}
            />
            <button onClick={() => add(false)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px]" style={{ color: 'var(--primary)' }} aria-label="Add task">
              <Plus size={15} />
            </button>
          </div>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            className="w-full px-3 py-1.5 rounded-[10px] bg-transparent outline-none text-[12px]"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
            {...smoothCaretProps()}
          />
          <div className="flex items-center gap-2">
            <Button variant="flat" size="sm" startContent={<Pin size={12} />} onClick={() => add(true)} disabled={!title.trim()}>
              Add as main thing
            </Button>
            <Button variant="ghost" size="sm" startContent={<Sparkles size={12} />} onClick={copy} disabled={!tasks.length}>
              Copy checklist
            </Button>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {pinned ? <><b>{pinned}</b> pinned — the AI gets these first, in order. </> : null}
            Works in Research and Coding alike.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ShuffledPinnedList
            tasks={tasks}
            onPin={(id, p) => useStore.getState().pinTask(id, p)}
            onToggleDone={(id, d) => useStore.getState().toggleTask(id, d)}
            onReorder={(ids) => useStore.getState().reorderTasks(ids)}
            onDelete={(id) => useStore.getState().deleteTask(id)}
            onSendToAI={sendToAI}
            emptyHint="Nothing on the list yet. Add the first thing, then pin the one that matters most."
          />
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  )
}
