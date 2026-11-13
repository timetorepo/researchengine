import { WorkspaceEffect } from '@/components/ui/bencho/WorkspaceEffects'
import { Create } from '@/components/ui/bencho/liq-create/Create'
import '@/components/ui/bencho/liq-create/Create.css'
import { ActionNode } from '@/components/ui/bencho/action-node/ActionNode'
import '@/components/ui/bencho/action-node/ActionNode.css'
import { SlideConfirm } from '@/components/ui/bencho/slide-confirm/SlideConfirm'
import '@/components/ui/bencho/slide-confirm/SlideConfirm.css'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { Share2, Square, FileText, Folder, LayoutTemplate } from 'lucide-react'
// Workflows home: your workflows, one-click run, and the template gallery.
import React, { useEffect, useRef, useState } from 'react'
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
  const [completed, setCompleted] = useState<string | null>(null)
  useEffect(() => { if (!completed) return; const timer = window.setTimeout(() => setCompleted(null), 4000); return () => window.clearTimeout(timer) }, [completed])
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null)
  const executor = useRef<WorkflowExecutor | null>(null)
  useEffect(() => () => executor.current?.stop(), [])
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
        setRunningId(null); executor.current = null
        useStore.getState().addWorkflowRun(rec)
        useStore.setState((s: any) => ({
          workflows: s.workflows.map((w: Workflow) => (w.id === wf.id
            ? { ...w, lastRun: { status: rec.status === 'error' ? 'error' : rec.status === 'stopped' ? 'stopped' : 'ok', at: Date.now(), ms: (rec.finishedAt ?? Date.now()) - rec.startedAt } }
            : w)),
        }))
        if (rec.status === 'ok') { setCompleted(wf.name); useUI.getState().toast('Workflow finished', `${wf.name} completed.`, 'success') }
        else if (rec.status === 'stopped') useUI.getState().toast('Workflow stopped', wf.name, 'info')
        else useUI.getState().toast('Workflow failed', rec.error ?? 'Check the editor log for details.', 'danger')
      },
    })
    executor.current = ex
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
          <div className="re-bencho re-create-workflow"><Create items={[
            { label: 'Blank workflow', icon: FileText, onSelect: createBlank },
            { label: 'Import workflow', icon: Folder, onSelect: importFile },
            ...WORKFLOW_TEMPLATES.slice(0, 2).map((template, index) => ({ label: template.name, icon: LayoutTemplate, onSelect: () => createFromTemplate(index) })),
          ]} /></div>
        </motion.div>

        {/* My workflows: one table. A row is a workflow; its actions sit at the
            right, and the last run is a status mark, not a sentence. */}
        <section className="mb-10" aria-label="Your automations">
          {!workflows.length && <p className="surface p-6 text-sm">No workflows yet. Create a blank canvas or pick a template below.</p>}
          <div className="re-bencho grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 pt-12 px-3">
            {workflows.map((wf) => <div key={wf.id} className="min-w-0">
              <ActionNode title={wf.name} description={`${wf.nodes.length} steps · ${wf.lastRun ? `Last run: ${wf.lastRun.status}` : 'Not run yet'}`} actions={[
                { id: 'export', label: `Export ${wf.name}`, Icon: Download, onSelect: () => download(wf) },
                { id: 'share', label: `Share ${wf.name}`, Icon: Share2, onSelect: () => { void (async () => {
                  try { if (navigator.share) await navigator.share({ title: wf.name, text: exportWorkflow(wf) }); else { await navigator.clipboard.writeText(exportWorkflow(wf)); useUI.getState().toast('Workflow copied', 'Paste it only where you intend to share its configuration.') } }
                  catch (error) { if ((error as Error).name !== 'AbortError') useUI.getState().toast('Could not share workflow', 'Use Export to save a JSON file instead.', 'warning') }
                })() } },
                { id: 'start', label: `Start ${wf.name}`, Icon: Play, disabled: !!runningId, onSelect: () => runNow(wf) },
                { id: 'stop', label: `Stop ${wf.name}`, Icon: Square, disabled: runningId !== wf.id, onSelect: () => executor.current?.stop() },
              ]} />
              <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                <button className="underline py-2" onClick={() => navigate(`/workflows/${wf.id}`)}>Open editor</button>
                <button className="py-2" disabled={runningId === wf.id} onClick={() => setDeleteTarget(wf)} aria-label={`Delete ${wf.name}`}>Delete</button>
              </div>
            </div>)}
          </div>
        </section>
        <Modal isOpen={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <ModalContent>
            <ModalHeader>Delete {deleteTarget?.name}?</ModalHeader>
            <ModalBody><p className="text-sm">This removes the workflow and its saved run history. It cannot be undone.</p>
              <div className="re-bencho"><SlideConfirm width={240} onConfirm={() => { if (deleteTarget) useStore.getState().deleteWorkflow(deleteTarget.id); setDeleteTarget(null) }} /></div>
            </ModalBody>
            <ModalFooter><button onClick={() => setDeleteTarget(null)}>Cancel</button><button className="ml-4 text-[var(--danger)]" onClick={() => { if (deleteTarget) useStore.getState().deleteWorkflow(deleteTarget.id); setDeleteTarget(null) }}>Confirm deletion</button></ModalFooter>
          </ModalContent>
        </Modal>

        {completed && <section aria-label="Workflow completion" className="mb-4"><p role="status" className="text-sm">{completed} finished.</p><WorkspaceEffect kind="particles" /></section>}
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
