// Workflows home: your workflows, one-click run, and the template gallery.
import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="max-w-[1080px] mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C8EEF, #A78BFA)' }}>
            <WorkflowIcon size={18} color="#fff" />
          </span>
          <h1 className="text-[22px] font-semibold" style={{ letterSpacing: '-0.02em' }}>Workflows</h1>
        </div>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-3)' }}>
          Chain triggers, AI steps, logic and outputs into automations that run against real systems.
        </p>

        <div className="flex gap-2 mb-7">
          <button onClick={createBlank} className="flex items-center gap-1.5 px-4 py-2 rounded-[11px] text-[13px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
            <Plus size={14} /> New workflow
          </button>
          <button onClick={importFile} className="flex items-center gap-1.5 px-4 py-2 rounded-[11px] text-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
            <Upload size={14} /> Import .workflow.json
          </button>
        </div>

        {/* my workflows */}
        {workflows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {workflows.map((wf) => <WorkflowCard key={wf.id} wf={wf} running={runningId === wf.id}
              onOpen={() => navigate(`/workflows/${wf.id}`)} onRun={() => runNow(wf)}
              onExport={() => download(wf)} onDelete={() => { useStore.getState().deleteWorkflow(wf.id) }} />)}
          </div>
        )}
        {workflows.length === 0 && (
          <div className="rounded-[16px] p-8 text-center mb-10" style={{ border: '1px dashed var(--surface-border)' }}>
            <p className="text-[13.5px]" style={{ color: 'var(--text-2)' }}>No workflows yet.</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Start from a blank canvas or pick a template below.</p>
          </div>
        )}

        {/* templates */}
        <h2 className="text-[14px] font-semibold mb-3">Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pb-10">
          {WORKFLOW_TEMPLATES.map((t, i) => (
            <button key={t.name} onClick={() => createFromTemplate(i)}
              className="text-left rounded-[16px] p-4 transition-transform hover:-translate-y-0.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="text-[13px] font-semibold mb-1">{t.name}</div>
              <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t.description}</div>
              <div className="text-[11px] mt-2.5 font-medium" style={{ color: 'var(--primary)' }}>Use template</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function WorkflowCard({ wf, running, onOpen, onRun, onExport, onDelete }: {
  wf: Workflow; running: boolean; onOpen: () => void; onRun: () => void; onExport: () => void; onDelete: () => void
}) {
  const last = wf.lastRun
  return (
    <div className="rounded-[16px] p-4 flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <button onClick={onOpen} className="text-left mb-1">
        <div className="text-[14px] font-semibold truncate">{wf.name}</div>
      </button>
      <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
        {wf.nodes.length} nodes · {wf.edges.length} links
        {last && <> · last run {last.status === 'ok' ? 'succeeded' : last.status === 'error' ? 'failed' : 'stopped'} {relTime(last.at)}</>}
      </div>
      <div className="flex items-center gap-1.5 mt-auto">
        <button onClick={onRun} disabled={running}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[9px] text-[12px] font-medium disabled:opacity-60"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} {running ? 'Running' : 'Run'}
        </button>
        <IconBtn label="Open editor" onClick={onOpen}><Pencil size={13} /></IconBtn>
        <IconBtn label="Export" onClick={onExport}><Download size={13} /></IconBtn>
        <IconBtn label="Delete" danger onClick={onDelete}><Trash2 size={13} /></IconBtn>
        <div className="flex-1" />
        {last?.status === 'ok' && <CircleCheck size={14} style={{ color: 'var(--success)' }} />}
        {last?.status === 'error' && <CircleX size={14} style={{ color: 'var(--danger)' }} />}
      </div>
    </div>
  )
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
