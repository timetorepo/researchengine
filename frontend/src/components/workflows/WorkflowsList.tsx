// Workflows home: your workflows, one-click run, and the template gallery.
import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Workflow as WorkflowIcon, Plus, Upload, Play, Trash2, Download, Pencil, CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import type { Workflow } from '@/lib/workflows/types'
import { WORKFLOW_TEMPLATES, fromTemplate, blankWorkflow, exportWorkflow, importWorkflow } from '@/lib/workflows/templates'
import { WorkflowExecutor } from '@/lib/workflows/executor'

export function WorkflowsList() {
  const navigate = useNavigate()
  const workflows = useStore((s) => s.workflows)
  const [runningId, setRunningId] = useState<string | null>(null)

  const createBlank = () => {
    const wf = blankWorkflow()
    useStore.getState().addWorkflow(wf)
    navigate(`/workflows/${wf.id}`)
  }

  const createFromTemplate = (i: number) => {
    const wf = fromTemplate(i)
    useStore.getState().addWorkflow(wf)
    navigate(`/workflows/${wf.id}`)
  }

  const runNow = (wf: Workflow) => {
    if (runningId) return
    setRunningId(wf.id)
    const ex = new WorkflowExecutor(wf, {
      onNodeStart: () => {}, onNodeEnd: () => {}, onEdge: () => {}, onLog: () => {},
      onDone: (rec) => {
        setRunningId(null)
        useStore.getState().addWorkflowRun(rec)
        useStore.setState((s: any) => ({
          workflows: s.workflows.map((w: Workflow) => (w.id === wf.id
            ? { ...w, lastRun: { status: rec.status === 'error' ? 'error' : rec.status === 'stopped' ? 'stopped' : 'ok', at: Date.now(), ms: (rec.finishedAt ?? Date.now()) - rec.startedAt } }
            : w)),
        }))
        if (rec.status === 'ok') useUI.getState().toast('Workflow finished', `${wf.name} completed.`, 'success')
        else useUI.getState().toast('Workflow failed', rec.error ?? 'Check the editor log for details.', 'danger')
      },
    })
    ex.start()
  }

  const importFile = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json,application/json'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      try {
        const wf = importWorkflow(await f.text())
        useStore.getState().addWorkflow(wf)
        useUI.getState().toast('Workflow imported', wf.name, 'success')
      } catch (e: any) {
        useUI.getState().toast('Import failed', e.message ?? 'Invalid file.', 'danger')
      }
    }
    inp.click()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-5 pt-7 pb-16">
        {/* Header: the title, a count, and the two ways to add a workflow. */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-baseline gap-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C8EEF, #A78BFA)' }}>
                <WorkflowIcon size={14} color="#fff" />
              </span>
              <h1 className="text-[20px] font-semibold tracking-tight">Workflows</h1>
            </div>
            <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>{workflows.length} {workflows.length === 1 ? 'workflow' : 'workflows'} · run against real systems</span>
          </div>
          <div className="flex gap-2">
            <button onClick={importFile} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              <Upload size={13} /> Import
            </button>
            <button onClick={createBlank} className="press-tap flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
              <Plus size={13} /> New workflow
            </button>
          </div>
        </motion.div>

        {/* My workflows: one table. A row is a workflow; its actions sit at the
            right, and the last run is a status mark, not a sentence. */}
        <section className="mb-10">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="grid items-center gap-3 px-3 h-8 text-[10.5px] uppercase tracking-wider md:grid-cols-[minmax(0,1fr)_110px_170px_150px] grid-cols-[minmax(0,1fr)_150px]"
              style={{ color: 'var(--text-3)', background: 'var(--elevated)' }} aria-hidden="true">
              <span>Name</span>
              <span className="hidden md:block">Size</span>
              <span className="hidden md:block">Last run</span>
              <span className="text-right">Actions</span>
            </div>
            {workflows.length === 0 && (
              <div className="px-4 py-10 text-center" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <p className="text-[13.5px]" style={{ color: 'var(--text-2)' }}>No workflows yet.</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Start from a blank canvas or pick a template below.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {workflows.map((wf) => (
                <motion.div key={wf.id} layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="group grid items-center gap-3 px-3 h-[46px] hover:bg-[var(--elevated)] transition-colors md:grid-cols-[minmax(0,1fr)_110px_170px_150px] grid-cols-[minmax(0,1fr)_150px]"
                  style={{ borderTop: '1px solid var(--surface-border)' }}>
                  <WorkflowName wf={wf} running={runningId === wf.id} onOpen={() => navigate(`/workflows/${wf.id}`)} />
                  <span className="hidden md:block text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>{wf.nodes.length} nodes · {wf.edges.length} links</span>
                  <span className="hidden md:flex items-center gap-1.5 text-[12px] min-w-0" style={{ color: 'var(--text-3)' }}>
                    <LastRunMark last={wf.lastRun} />
                    <span className="truncate">{wf.lastRun ? `${wf.lastRun.status === 'ok' ? 'Succeeded' : wf.lastRun.status === 'error' ? 'Failed' : 'Stopped'} ${relTime(wf.lastRun.at)}` : 'Never run'}</span>
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    <button onClick={() => runNow(wf)} disabled={runningId !== null} aria-label={`Run ${wf.name}`} title="Run"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11.5px] font-medium disabled:opacity-50"
                      style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                      {runningId === wf.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      {runningId === wf.id ? 'Running' : 'Run'}
                    </button>
                    <IconBtn label="Open editor" onClick={() => navigate(`/workflows/${wf.id}`)}><Pencil size={13} /></IconBtn>
                    <IconBtn label="Export" onClick={() => download(wf)}><Download size={13} /></IconBtn>
                    <IconBtn label="Delete" danger onClick={() => useStore.getState().deleteWorkflow(wf.id)}><Trash2 size={13} /></IconBtn>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Templates: a denser grid than before, one line of description each. */}
        <h2 className="text-[11.5px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-10">
          {WORKFLOW_TEMPLATES.map((t, i) => (
            <motion.button key={t.name} onClick={() => createFromTemplate(i)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + Math.min(i, 8) * 0.03, duration: 0.2 }}
              whileTap={{ scale: 0.99 }}
              className="re-wf-card group text-left rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <span className="mt-0.5 w-6 h-6 rounded-[7px] shrink-0 grid place-items-center" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
                <WorkflowIcon size={12} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold truncate">{t.name}</span>
                  <span className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--primary)' }}>Use →</span>
                </span>
                <span className="block text-[11.5px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }}>{t.description}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The workflow's name, which opens the editor. Its own component so the row stays a plain layout. */
function WorkflowName({ wf, running, onOpen }: { wf: Workflow; running: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-2.5 min-w-0 text-left">
      <motion.span className="re-wf-icon shrink-0 w-6 h-6 rounded-[7px] grid place-items-center"
        animate={running ? { rotate: [0, 8, -6, 0] } : { rotate: 0 }}
        transition={{ duration: 1.4, repeat: running ? Infinity : 0, ease: 'easeInOut' }}
        style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
        <WorkflowIcon size={12} />
      </motion.span>
      <span className="text-[13.5px] font-medium truncate">{wf.name}</span>
    </button>
  )
}

function LastRunMark({ last }: { last?: Workflow['lastRun'] }) {
  if (last?.status === 'ok') return <CircleCheck size={13} className="shrink-0" style={{ color: 'var(--success)' }} />
  if (last?.status === 'error') return <CircleX size={13} className="shrink-0" style={{ color: 'var(--danger)' }} />
  return <span className="inline-block w-[13px] h-[13px] shrink-0 rounded-full" style={{ border: '1.5px solid var(--surface-border)' }} />
}

function IconBtn({ children, label, onClick, danger = false }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="p-1.5 rounded-[9px] hover:bg-[var(--elevated)]"
      style={{ color: danger ? 'var(--danger)' : 'var(--text-3)' }}>
      {children}
    </button>
  )
}

function download(wf: Workflow) {
  const blob = new Blob([exportWorkflow(wf)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${wf.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'workflow'}.workflow.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function relTime(t: number): string {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'moments ago'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
