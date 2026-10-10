/**
 * The agent pool.
 *
 * Codex's parallel agents, with the two things that make them safe to run at
 * once: every task works in its own copy of the project (so two agents never
 * write the same file), and the hand-back is a review — you see the files each
 * agent touched, how much it changed, and merge per file. Devin's /handoff
 * lives here too: a task can be started on a local model or handed to a cloud
 * one, and the chip on the task says which.
 */
import React, { useMemo, useState } from 'react'
import { AgentGlyph, ReviewBar, useElapsed } from './IdeChrome'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bot, Plus, Loader2, Check, X, GitMerge, Trash2, AlertTriangle, Cpu, Cloud,
  ChevronDown, ChevronRight, FileText, Play, Sparkles, Circle,
} from 'lucide-react'
import { useAgents, type AgentTask } from '@/lib/ide/agents'
import { ActivityRow } from './AgentTimeline'
import { useStore } from '@/stores/useStore'

const STATUS_TONE: Record<AgentTask['status'], string> = {
  forking: 'var(--ide-faint)',
  running: 'var(--ide-accent)',
  ready: 'var(--ide-ok, var(--success))',
  merged: 'var(--ide-ok, var(--success))',
  conflict: 'var(--ide-warn, var(--warning))',
  failed: 'var(--ide-danger, var(--danger))',
  discarded: 'var(--ide-faint)',
}

const STATUS_LABEL: Record<AgentTask['status'], string> = {
  forking: 'preparing a copy',
  running: 'working',
  ready: 'ready to merge',
  merged: 'merged',
  conflict: 'conflict',
  failed: 'failed',
  discarded: 'discarded',
}

export function AgentsDock({ project, onOpenFile, onOpenChat, seedPrompt = '' }: {
  project: string
  onOpenFile: (path: string, line?: number) => void
  onOpenChat: (chatId: string) => void
  seedPrompt?: string
}) {
  const tasks = useAgents((s) => s.tasks)
  const spawn = useAgents((s) => s.spawn)
  const merge = useAgents((s) => s.merge)
  const discard = useAgents((s) => s.discard)
  const stop = useAgents((s) => s.stop)
  const clearFinished = useAgents((s) => s.clearFinished)
  const models = useStore((s) => s.settings.providerModels)
  const providers = useStore((s) => s.settings.providers)
  const defaultModel = useStore((s) => s.settings.defaultModel)

  const [open, setOpen] = useState(true)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState(seedPrompt)
  const [claim, setClaim] = useState('')
  const [handoff, setHandoff] = useState<'local' | 'cloud'>('local')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)

  // Cloud handoff only lists providers that are actually configured with a key.
  const cloudModels = useMemo(() => {
    const out: { id: string; label: string }[] = []
    for (const [providerId, list] of Object.entries(models ?? {})) {
      const enabled = providers?.[providerId]?.enabled !== false
      if (!enabled) continue
      for (const m of list ?? []) out.push({ id: `${providerId}:${m}`, label: m })
    }
    return out.slice(0, 60)
  }, [models, providers])

  const active = tasks.filter((t) => t.project === project)
  const running = active.filter((t) => t.status === 'running' || t.status === 'forking')
  // A claim is a file two agents would both want; the pool shows the overlap
  // instead of hiding it, because that is what needs a human decision.
  const overlaps = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const t of running) for (const f of t.claim) map.set(f, [...(map.get(f) ?? []), t.title])
    return [...map.entries()].filter(([, who]) => who.length > 1)
  }, [running])

  const start = async () => {
    const p = prompt.trim()
    if (!p || busy) return
    setBusy(true)
    await spawn({
      title: title.trim() || p.slice(0, 48),
      prompt: p,
      project,
      claim: claim.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
      model: model || undefined,
      handoff,
    })
    setBusy(false); setTitle(''); setPrompt(''); setClaim('')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <Bot size={13} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[12px] font-medium flex-1">Agents</span>
        {running.length > 0 && (
          <span className="re-chip" data-tone="run"><span className="re-pulse-dot" /> {running.length} running</span>
        )}
        <button onClick={clearFinished} className="ide-icon-btn" style={{ width: 22, height: 22 }} title="Clear finished tasks">
          <Trash2 size={11} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* spawn */}
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--ide-border)' }}>
          <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--ide-dim)' }}>
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Start another agent
            <span className="flex-1" />
            <span style={{ color: 'var(--ide-faint)' }}>own working copy</span>
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-1.5">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="task name — e.g. fix login redirect"
                    aria-label="Task name" className="ide-input w-full" style={{ fontSize: 11.5 }} />
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                    placeholder="what should this agent do? Be specific — it runs on its own copy and reports back."
                    aria-label="Task prompt" className="ide-input w-full resize-y" style={{ fontSize: 11.5, lineHeight: 1.5 }} />
                  <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="files it will touch (optional) — src/api.ts, src/auth.ts"
                    aria-label="Claimed files" className="ide-input w-full" style={{ fontSize: 11 }} />

                  <div className="flex items-center gap-1.5">
                    <div className="re-seg" role="group" aria-label="Where the task runs">
                      <button data-active={handoff === 'local'} onClick={() => setHandoff('local')} title="Run on this machine's model">
                        <Cpu size={10} /> local
                      </button>
                      <button data-active={handoff === 'cloud'} onClick={() => setHandoff('cloud')} title="Hand the task to a cloud model">
                        <Cloud size={10} /> cloud
                      </button>
                    </div>
                    <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model"
                      className="ide-input flex-1 min-w-0" style={{ fontSize: 11, padding: '4px 6px' }}>
                      <option value="">{handoff === 'cloud' ? 'cloud default' : `local default${defaultModel ? ` · ${defaultModel}` : ''}`}</option>
                      {(handoff === 'cloud' ? cloudModels : []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <button onClick={() => void start()} disabled={!prompt.trim() || busy} className="ide-btn primary" style={{ height: 26 }}>
                      {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Spawn
                    </button>
                  </div>

                  {overlaps.length > 0 && (
                    <p className="text-[10.5px] flex items-start gap-1.5" style={{ color: 'var(--ide-warn, var(--warning))' }}>
                      <AlertTriangle size={11} className="mt-[1px] shrink-0" />
                      <span>Two agents claim the same file ({overlaps.map(([f]) => f).join(', ')}). They still cannot collide — each has its own copy — but only one version merges; the other is kept aside for you to compare.</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!active.length && (
          <div className="px-3 py-6 text-center text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>
            No agents yet. Spawn two with different briefs and watch them work in parallel — they will not touch each other's files.
          </div>
        )}

        {active.map((task) => <TaskCard key={task.id} task={task} onOpenFile={onOpenFile} onOpenChat={onOpenChat}
          onMerge={() => void merge(task.id)} onDiscard={() => void discard(task.id)} onStop={() => stop(task.id)} />)}
      </div>
    </div>
  )
}

function TaskCard({ task, onOpenFile, onOpenChat, onMerge, onDiscard, onStop }: {
  task: AgentTask
  onOpenFile: (path: string, line?: number) => void
  onOpenChat: (chatId: string) => void
  onMerge: () => void
  onDiscard: () => void
  onStop: () => void
}) {
  const toggleAccepted = useAgents((s) => s.toggleAccepted)
  const refreshChanges = useAgents((s) => s.refreshChanges)
  const [showDiff, setShowDiff] = useState(true)
  const tone = STATUS_TONE[task.status]
  const busy = task.status === 'running' || task.status === 'forking'
  const elapsed = useElapsed(task.startedAt, busy)
  const glyphState: 'working' | 'ready' | 'blocked' | 'idle' =
    busy ? 'working'
      : task.status === 'ready' ? 'ready'
        : task.status === 'conflict' || task.status === 'failed' ? 'blocked'
          : 'idle'
  const accepted = task.changes.filter((c) => c.accepted)
  const totalAdded = task.changes.reduce((a, c) => a + (c.added ?? 0), 0)
  const totalRemoved = task.changes.reduce((a, c) => a + (c.removed ?? 0), 0)

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="re-task" data-status={task.status}>
      {/* Cursor 3's agent row: the state is a glyph, the work has a timer, and
          the repo it is working in is a chip rather than a sentence. */}
      <div className="re-task-head">
        <AgentGlyph state={glyphState} />
        <button className="min-w-0 flex-1 text-left" onClick={() => onOpenChat(task.chatId)} title="Open this agent's conversation">
          <span className="re-task-title">{task.title}</span>
        </button>
        <span className="re-chip" data-tone={task.handoff}>{task.handoff === 'cloud' ? <Cloud size={9} /> : <Cpu size={9} />} {task.handoff}</span>
        <span className="re-chip" style={{ color: tone }}>{STATUS_LABEL[task.status]}</span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--ide-faint)' }} title={busy ? 'Working for' : 'Finished in'}>{elapsed}</span>
        <span className="re-task-id">{task.id.replace('agent-', '')}</span>
      </div>

      {task.claim.length > 0 && (
        <div className="re-task-claim">
          {(task.claim ?? []).map((f) => <span key={f} className="re-filechip" title={`${f} — this agent's copy`}>{f}</span>)}
        </div>
      )}

      {task.activity.length > 0 && (
        <div className="re-task-activity">
          {task.activity.slice(-4).map((line) => <ActivityRow key={line.id} line={line} onOpen={onOpenFile} compact />)}
        </div>
      )}

      {task.error && <p className="px-2.5 pb-2 text-[11px]" style={{ color: 'var(--ide-danger, var(--danger))' }}>{task.error}</p>}

      {(task.changes.length > 0 || task.summary) && (
        <div className="re-task-changes">
          <button onClick={() => setShowDiff((v) => !v)} className="re-task-changes-head">
            {showDiff ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <FileText size={11} />
            <span className="flex-1 text-left">{task.summary ?? `${task.changes.length} file(s)`}</span>
            <span className="re-diff-count add">+{totalAdded}</span>
            <span className="re-diff-count del">−{totalRemoved}</span>
          </button>
          <AnimatePresence initial={false}>
            {showDiff && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                {(task.changes ?? []).map((c) => (
                  <div key={c.path} className="re-file-row">
                    <button className="re-file-toggle" data-on={c.accepted ? 'true' : 'false'}
                      onClick={() => toggleAccepted(task.id, c.path)}
                      aria-pressed={c.accepted}
                      title={c.accepted ? 'Included in the merge' : 'Left out of the merge'}>
                      {c.accepted ? <Check size={9} /> : <X size={9} />}
                    </button>
                    <button className="re-file-name" onClick={() => onOpenFile(c.path)} title={`Open ${c.path}`}>
                      {c.path}
                      <span className="re-file-kind" data-kind={c.kind}>{c.kind}</span>
                    </button>
                    <span className="re-diff-count add">+{c.added}</span>
                    <span className="re-diff-count del">−{c.removed}</span>
                  </div>
                ))}
                {!task.changes.length && <p className="px-2.5 py-2 text-[11px]" style={{ color: 'var(--ide-faint)' }}>The agent finished without touching a file.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* A finished agent ends in the bottom action row rather than a toolbar:
          what changed, then the three things you can do about it. A running one
          gets the two controls that make sense while it runs. */}
      {busy ? (
        <div className="re-task-actions">
          <button onClick={onStop} className="ide-btn outlined" style={{ height: 22 }}><X size={10} /> Stop</button>
          <button onClick={() => void refreshChanges(task.id)} className="ide-btn" style={{ height: 22 }} title="Check what has been written so far">
            <Sparkles size={10} /> Check
          </button>
        </div>
      ) : (
        <div className="px-2.5 pb-2.5">
          <ReviewBar
            files={task.changes.length}
            included={accepted.length}
            added={totalAdded}
            removed={totalRemoved}
            onReview={() => setShowDiff(true)}
            onDiscard={() => onDiscard()}
            onMerge={accepted.length ? () => onMerge() : undefined}
            busy={false}
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button onClick={() => void refreshChanges(task.id)} className="ide-btn" style={{ height: 22 }}><Sparkles size={10} /> Re-check</button>
            <button onClick={() => onOpenChat(task.chatId)} className="ide-btn" style={{ height: 22 }}><Play size={10} /> Transcript</button>
            <span className="text-[10px]" style={{ color: 'var(--ide-faint)' }}>
              {accepted.length}/{task.changes.length} file{task.changes.length === 1 ? '' : 's'} included
            </span>
          </div>
        </div>
      )}

      {task.status === 'conflict' && (
        <p className="px-2.5 pb-2 text-[10.5px] flex items-start gap-1.5" style={{ color: 'var(--ide-warn, var(--warning))' }}>
          <AlertTriangle size={11} className="mt-[1px] shrink-0" />
          <span>Some files were changed here after this agent forked, so they were not overwritten — the agent's versions sit next to yours as <span className="font-mono">*.agent-conflict-*</span>.</span>
        </p>
      )}
      {task.status === 'merged' && (
        <p className="px-2.5 pb-2 text-[10.5px] flex items-center gap-1.5" style={{ color: 'var(--ide-ok, var(--success))' }}>
          <Check size={11} /> Merged into the project — the files above were applied and the tree reloaded.
        </p>
      )}
      {task.status === 'ready' && !task.changes.length && (
        <p className="px-2.5 pb-2 text-[10.5] flex items-center gap-1.5" style={{ color: 'var(--ide-faint)' }}>
          <Circle size={7} fill="currentColor" /> Finished with no file changes.
        </p>
      )}
    </motion.div>
  )
}
