// Workflow editor: canvas + run controls + history + log/data panels.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Play, Square, Pause, StepForward, RotateCcw, LayoutGrid, Magnet,
  Plus, Minus, Maximize2, Undo2, Redo2, ChevronDown, Terminal, Braces, Download, Upload,
  CircleCheck, CircleX, CircleAlert, X,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import type { Workflow, WorkflowNode, NodeRunStatus, WorkflowRunRecord } from '@/lib/workflows/types'
import { NODE_W } from '@/lib/workflows/types'
import { NODE_H } from './wf/NodeCard'
import { Canvas, type CanvasHandle } from './wf/Canvas'
import { NodePicker } from './wf/NodePicker'
import { ConfigPanel } from './wf/ConfigPanel'
import { nodeDef, type NodeDef } from '@/lib/workflows/library'
import { WorkflowExecutor } from '@/lib/workflows/executor'
import { exportWorkflow, importWorkflow, blankWorkflow } from '@/lib/workflows/templates'
import { nanoid } from 'nanoid'
import { toDisplay } from '@/lib/workflows/vars'

interface Snapshot { nodes: WorkflowNode[]; edges: Workflow['edges'] }

export function WorkflowEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const stored = useStore((s) => s.workflows.find((w) => w.id === id))
  const updateWorkflow = useStore((s) => s.updateWorkflow)
  const addWorkflowRun = useStore((s) => s.addWorkflowRun)
  const runs = useStore((s) => s.workflowRuns.filter((r) => r.workflowId === id))

  const [wf, setWf] = useState<Workflow | null>(stored ?? null)
  const wfRef = useRef(wf); wfRef.current = wf
  const canvasRef = useRef<CanvasHandle>(null)

  // editor UI state
  const [selected, setSelected] = useState<string[]>([])
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [openConfig, setOpenConfig] = useState<string | null>(null)
  const [picker, setPicker] = useState<null | { mode: 'add' | 'insert'; edgeId?: string; x: number; y: number }>(null)
  const [snap, setSnap] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // execution state
  const executorRef = useRef<WorkflowExecutor | null>(null)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [stepMode, setStepMode] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeRunStatus>>({})
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set())
  const [lastRun, setLastRun] = useState<WorkflowRunRecord | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // undo/redo
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const [, bumpHist] = useState(0)

  useEffect(() => { setWf(stored ?? null) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ persistence ------------------------------ */
  const commit = useCallback((next: Workflow, pushHistory = true) => {
    const cur = wfRef.current
    if (pushHistory && cur) {
      past.current.push({ nodes: cur.nodes, edges: cur.edges })
      if (past.current.length > 60) past.current.shift()
      future.current = []
      bumpHist((n) => n + 1)
    }
    setWf(next)
    updateWorkflow(next.id, { nodes: next.nodes, edges: next.edges })
  }, [updateWorkflow])

  const undo = useCallback(() => {
    const cur = wfRef.current
    const prev = past.current.pop()
    if (!cur || !prev) return
    future.current.push({ nodes: cur.nodes, edges: cur.edges })
    const next = { ...cur, nodes: prev.nodes, edges: prev.edges }
    setWf(next); updateWorkflow(next.id, { nodes: next.nodes, edges: next.edges })
    bumpHist((n) => n + 1)
  }, [updateWorkflow])

  const redo = useCallback(() => {
    const cur = wfRef.current
    const nxt = future.current.pop()
    if (!cur || !nxt) return
    past.current.push({ nodes: cur.nodes, edges: cur.edges })
    const next = { ...cur, nodes: nxt.nodes, edges: nxt.edges }
    setWf(next); updateWorkflow(next.id, { nodes: next.nodes, edges: next.edges })
    bumpHist((n) => n + 1)
  }, [updateWorkflow])

  /* ------------------------------- mutations ------------------------------- */
  const moveNodes = useCallback((moves: Record<string, { x: number; y: number }>) => {
    setWf((w) => w ? { ...w, nodes: w.nodes.map((n) => (moves[n.id] ? { ...n, ...moves[n.id] } : n)) } : w)
  }, [])

  // commit positions to store + history once a drag settles (called by canvas pointerup via debounce)
  const dragCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!wf) return
    if (dragCommitTimer.current) clearTimeout(dragCommitTimer.current)
    dragCommitTimer.current = setTimeout(() => {
      const storedNow = useStore.getState().workflows.find((w) => w.id === wf.id)
      if (storedNow && JSON.stringify(storedNow.nodes) !== JSON.stringify(wf.nodes)) {
        updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges })
      }
    }, 400)
  }, [wf?.nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const addNode = useCallback((def: NodeDef, at: { x: number; y: number }) => {
    const cur = wfRef.current
    if (!cur) return
    const label = uniqueLabel(cur.nodes, def.name)
    const node: WorkflowNode = { id: nanoid(6), kind: def.kind, type: def.type, label, x: at.x, y: at.y, config: { ...def.defaults } }
    commit({ ...cur, nodes: [...cur.nodes, node], edges: cur.edges })
    setOpenConfig(node.id)
  }, [commit])

  const insertOnEdge = useCallback((def: NodeDef, edgeId: string, x: number, y: number) => {
    const cur = wfRef.current
    if (!cur) return
    const edge = cur.edges.find((e) => e.id === edgeId)
    if (!edge) return
    const label = uniqueLabel(cur.nodes, def.name)
    const node: WorkflowNode = { id: nanoid(6), kind: def.kind, type: def.type, label, x: x - NODE_W / 2, y: y - NODE_H / 2, config: { ...def.defaults } }
    const edges = cur.edges.flatMap((e) => (e.id === edgeId
      ? [{ ...e, to: node.id }, { id: nanoid(6), from: node.id, to: edge.to }]
      : [e]))
    commit({ ...cur, nodes: [...cur.nodes, node], edges })
    setOpenConfig(node.id)
  }, [commit])

  const duplicateNode = useCallback((nid: string) => {
    const cur = wfRef.current
    if (!cur) return
    const src = cur.nodes.find((n) => n.id === nid)
    if (!src) return
    const copy: WorkflowNode = { ...src, id: nanoid(6), x: src.x + 40, y: src.y + 40, label: uniqueLabel(cur.nodes, src.label), config: { ...src.config } }
    commit({ ...cur, nodes: [...cur.nodes, copy], edges: cur.edges })
  }, [commit])

  const toggleDisable = useCallback((nid: string) => {
    const cur = wfRef.current
    if (!cur) return
    commit({ ...cur, nodes: cur.nodes.map((n) => (n.id === nid ? { ...n, disabled: !n.disabled } : n)) })
  }, [commit])

  const deleteNodes = useCallback((ids: string[]) => {
    const cur = wfRef.current
    if (!cur || ids.length === 0) return
    const idSet = new Set(ids)
    commit({
      ...cur,
      nodes: cur.nodes.filter((n) => !idSet.has(n.id)),
      edges: cur.edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to)),
    })
    setSelected([])
    if (openConfig && idSet.has(openConfig)) setOpenConfig(null)
  }, [commit, openConfig])

  const patchNode = useCallback((nid: string, patch: Partial<WorkflowNode>) => {
    const cur = wfRef.current
    if (!cur) return
    commit({ ...cur, nodes: cur.nodes.map((n) => (n.id === nid ? { ...n, ...patch } : n)) })
  }, [commit])

  /* ------------------------------ auto-layout ------------------------------ */
  const autoLayout = useCallback(() => {
    const cur = wfRef.current
    if (!cur) return
    // BFS depth from triggers; children of different handles get separate columns
    const depth = new Map<string, number>()
    const trigger = cur.nodes.find((n) => n.kind === 'trigger')
    if (!trigger) return
    depth.set(trigger.id, 0)
    const q = [trigger.id]
    while (q.length) {
      const id = q.shift()!
      for (const e of cur.edges.filter((e) => e.from === id)) {
        if (!depth.has(e.to)) { depth.set(e.to, (depth.get(id) ?? 0) + 1); q.push(e.to) }
      }
    }
    // place orphans
    for (const n of cur.nodes) if (!depth.has(n.id)) depth.set(n.id, 0)
    const byDepth = new Map<number, WorkflowNode[]>()
    for (const n of cur.nodes) {
      const d = depth.get(n.id)!
      byDepth.set(d, [...(byDepth.get(d) ?? []), n])
    }
    const nodes = cur.nodes.map((n) => {
      const d = depth.get(n.id)!
      const row = byDepth.get(d)!
      const idx = row.indexOf(n)
      return { ...n, x: 120 + idx * (NODE_W + 80), y: 80 + d * 180 }
    })
    commit({ ...cur, nodes })
    setTimeout(() => canvasRef.current?.fitView(), 50)
  }, [commit])

  /* -------------------------------- running -------------------------------- */
  const stopRun = () => {
    executorRef.current?.stop()
    setRunning(false); setPaused(false)
  }

  const startRun = (mode: 'run' | 'step') => {
    const cur = wfRef.current
    if (!cur || running) return
    setRunning(true); setPaused(false); setStepMode(mode === 'step')
    setNodeStatus({}); setActiveEdges(new Set()); setLogs([])
    setLogOpen(true)
    const ex = new WorkflowExecutor(cur, {
      onNodeStart: (nid) => setNodeStatus((s) => ({ ...s, [nid]: 'running' })),
      onNodeEnd: (nid, run) => setNodeStatus((s) => ({ ...s, [nid]: run.status })),
      onEdge: (eid) => {
        setActiveEdges((s) => { const n = new Set(s); n.add(eid); return n })
        setTimeout(() => setActiveEdges((s) => { const n = new Set(s); n.delete(eid); return n }), 1100)
      },
      onLog: (l) => setLogs((ls) => [...ls, l]),
      onDone: (rec) => {
        setRunning(false); setPaused(false)
        setLastRun(rec)
        addWorkflowRun(rec)
        useStore.setState((s: any) => ({
          workflows: s.workflows.map((w: Workflow) => (w.id === cur.id
            ? { ...w, lastRun: { status: rec.status === 'error' ? 'error' : rec.status === 'stopped' ? 'stopped' : 'ok', at: Date.now(), ms: (rec.finishedAt ?? Date.now()) - rec.startedAt } }
            : w)),
        }))
        if (rec.status === 'error') {
          useUI.getState().toast('Workflow failed', rec.error ?? 'A node threw an error.', 'danger')
          const errNode = Object.values(rec.nodes).find((r) => r.status === 'error')
          if (errNode) setOpenConfig(errNode.nodeId)
        } else if (rec.status === 'ok') {
          useUI.getState().toast('Workflow finished', `${cur.name} completed in ${Math.round(((rec.finishedAt ?? Date.now()) - rec.startedAt) / 100) / 10}s.`, 'success')
        }
      },
    }, { mode })
    executorRef.current = ex
    ex.start()
  }

  useEffect(() => () => { executorRef.current?.stop() }, [id])
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs.length])

  /* ------------------------------ import/export ----------------------------- */
  const doExport = () => {
    const cur = wfRef.current
    if (!cur) return
    const blob = new Blob([exportWorkflow(cur)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${cur.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'workflow'}.workflow.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  const doImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json,application/json'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      try {
        const wf2 = importWorkflow(await f.text())
        useStore.getState().addWorkflow(wf2)
        navigate(`/workflows/${wf2.id}`)
      } catch (e: any) {
        useUI.getState().toast('Import failed', e.message ?? 'Invalid file.', 'danger')
      }
    }
    inp.click()
  }

  /* -------------------------------- keyboard -------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement
      if (tgt?.matches('input,textarea,select,[contenteditable]')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (selected[0]) duplicateNode(selected[0]); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selected.length) { e.preventDefault(); deleteNodes(selected) } return }
      if (e.key.toLowerCase() === 'a' && !mod) { e.preventDefault(); setPicker({ mode: 'add', x: 200, y: 150 }) }
      if (e.key.toLowerCase() === 's' && !mod) { e.preventDefault(); setSnap((s) => !s) }
      if (e.key.toLowerCase() === 'l' && !mod) { e.preventDefault(); autoLayout() }
      if (e.key === 'Escape') { setOpenConfig(null); setPicker(null); setSelected([]); setSelectedEdge(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, undo, redo, duplicateNode, deleteNodes, autoLayout])

  const runStats = useMemo(() => {
    const done = runs.filter((r) => r.status === 'ok' || r.status === 'error')
    if (done.length === 0) return null
    const avg = done.reduce((a, r) => a + ((r.finishedAt ?? r.startedAt) - r.startedAt), 0) / done.length
    const tokens = done.reduce((a, r) => a + (r.tokensUsed ?? 0), 0)
    return { avgMs: Math.round(avg), tokens }
  }, [runs])

  if (!wf) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-[14px] mb-3" style={{ color: 'var(--text-2)' }}>This workflow no longer exists.</p>
          <button onClick={() => navigate('/workflows')} className="px-4 py-2 rounded-full text-[13px]" style={{ background: 'var(--primary)', color: '#fff' }}>Back to workflows</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 z-30" style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--base)' }}>
        <button onClick={() => navigate('/workflows')} className="p-1.5 rounded-[9px] hover:bg-[var(--surface)]" aria-label="Back"><ArrowLeft size={16} style={{ color: 'var(--text-2)' }} /></button>
        <input
          value={wf.name}
          onChange={(e) => { const v = e.target.value; setWf({ ...wf, name: v }); updateWorkflow(wf.id, { name: v }) }}
          className="text-[14.5px] font-semibold bg-transparent outline-none min-w-0 flex-shrink"
          style={{ color: 'var(--text-1)', width: `${Math.max(8, wf.name.length)}ch` }}
          aria-label="Workflow name"
        />
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{wf.nodes.length} nodes · {wf.edges.length} links</span>
        <div className="flex-1" />

        {/* run controls */}
        <div className="flex items-center gap-1.5">
          {running ? (
            <>
              {!stepMode && (
                <button onClick={() => { paused ? executorRef.current?.resume() : executorRef.current?.pause(); setPaused(!paused) }}
                  className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', color: 'var(--text-2)' }} title={paused ? 'Resume' : 'Pause'}>
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                </button>
              )}
              {stepMode && <button onClick={() => executorRef.current?.stepOnce()} className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', color: 'var(--text-2)' }} title="Step"><StepForward size={14} /></button>}
              <button onClick={stopRun} className="p-2 rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--danger) 16%, transparent)', color: 'var(--danger)' }} title="Stop"><Square size={14} /></button>
            </>
          ) : (
            <>
              <button onClick={() => startRun('run')} className="press-tap flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] text-[12.5px] font-semibold"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <Play size={13} /> Run
              </button>
              <button onClick={() => startRun('step')} className="press-tap flex items-center gap-1.5 px-3 py-2 rounded-[11px] text-[12.5px]"
                style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }} title="Run one node at a time">
                <StepForward size={13} /> Step
              </button>
            </>
          )}
          {/* history dropdown */}
          <div className="relative">
            <button onClick={() => setHistoryOpen((h) => !h)} className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Run history">
              <RotateCcw size={14} />
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-11 z-50 w-64 rounded-[14px] py-1.5 max-h-72 overflow-y-auto"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.55)' }}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Run history</div>
                {runs.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>No runs yet.</div>}
                {runs.slice(0, 20).map((r) => (
                  <button key={r.id} onClick={() => { setLastRun(r); setHistoryOpen(false); setLogOpen(true); setNodeStatus(Object.fromEntries(Object.entries(r.nodes).map(([k, v]) => [k, v.status]))) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface)]">
                    {r.status === 'ok' ? <CircleCheck size={13} style={{ color: 'var(--success)' }} />
                      : r.status === 'error' ? <CircleX size={13} style={{ color: 'var(--danger)' }} />
                      : <CircleAlert size={13} style={{ color: 'var(--text-3)' }} />}
                    <span className="text-[12px] flex-1" style={{ color: 'var(--text-2)' }}>{new Date(r.startedAt).toLocaleTimeString()}</span>
                    <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{Math.round(((r.finishedAt ?? r.startedAt) - r.startedAt) / 100) / 10}s</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: 'var(--surface-border)' }} />
          <button onClick={undo} disabled={past.current.length === 0} className="p-2 rounded-[10px] disabled:opacity-30" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Undo"><Undo2 size={14} /></button>
          <button onClick={redo} disabled={future.current.length === 0} className="p-2 rounded-[10px] disabled:opacity-30" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Redo"><Redo2 size={14} /></button>
          <div className="w-px h-5 mx-1" style={{ background: 'var(--surface-border)' }} />
          <button onClick={autoLayout} className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Auto-layout (L)"><LayoutGrid size={14} /></button>
          <button onClick={doExport} className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Export .workflow.json"><Download size={14} /></button>
          <button onClick={doImport} className="p-2 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }} title="Import"><Upload size={14} /></button>
        </div>
      </div>

      {/* canvas area */}
      <div className="flex-1 relative min-h-0">
        <Canvas
          ref={canvasRef} wf={wf} snap={snap} showMinimap={showMinimap}
          nodeStatus={nodeStatus} activeEdges={activeEdges}
          selected={selected} onSelect={setSelected}
          onMoveNodes={moveNodes}
          onOpenConfig={setOpenConfig}
          onDuplicate={duplicateNode} onToggleDisable={toggleDisable} onDeleteNode={(nid) => deleteNodes([nid])}
          onInsertAtEdge={(edgeId, x, y) => setPicker({ mode: 'insert', edgeId, x, y })}
          onCanvasClick={() => { setOpenConfig(null); setSelectedEdge(null) }}
          selectedEdge={selectedEdge} onSelectEdge={setSelectedEdge}
        />

        {/* add-node button */}
        <button onClick={() => setPicker({ mode: 'add', x: 200, y: 150 })}
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-2 rounded-[11px] text-[12.5px] font-medium"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)', boxShadow: '0 4px 16px -6px rgba(0,0,0,0.4)' }}>
          <Plus size={14} /> Add node <kbd className="text-[9.5px] px-1 rounded ml-0.5" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>A</kbd>
        </button>

        {/* floating bottom bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-[14px]"
          style={{ background: 'color-mix(in srgb, var(--elevated) 94%, transparent)', border: '1px solid var(--surface-border)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 28px -10px rgba(0,0,0,0.45)' }}>
          <button onClick={() => canvasRef.current?.zoomBy(1 / 1.2)} className="p-1.5 rounded-[8px] hover:bg-[var(--surface)]" aria-label="Zoom out"><Minus size={14} style={{ color: 'var(--text-2)' }} /></button>
          <button onClick={() => canvasRef.current?.zoomBy(1.2)} className="p-1.5 rounded-[8px] hover:bg-[var(--surface)]" aria-label="Zoom in"><Plus size={14} style={{ color: 'var(--text-2)' }} /></button>
          <button onClick={() => canvasRef.current?.fitView()} className="p-1.5 rounded-[8px] hover:bg-[var(--surface)]" aria-label="Fit view"><Maximize2 size={13} style={{ color: 'var(--text-2)' }} /></button>
          <button onClick={() => setShowMinimap((m) => !m)} className="p-1.5 rounded-[8px]" style={{ background: showMinimap ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent' }} aria-label="Toggle minimap"><LayoutGrid size={13} style={{ color: showMinimap ? 'var(--primary)' : 'var(--text-3)' }} /></button>
          <button onClick={() => setSnap((s) => !s)} className="p-1.5 rounded-[8px]" style={{ background: snap ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent' }} aria-label="Toggle snap" title="Snap to grid (S)"><Magnet size={13} style={{ color: snap ? 'var(--primary)' : 'var(--text-3)' }} /></button>
          <div className="w-px h-4 mx-1" style={{ background: 'var(--surface-border)' }} />
          <button onClick={() => setLogOpen((l) => !l)} className="p-1.5 rounded-[8px]" style={{ background: logOpen ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent' }} aria-label="Toggle log"><Terminal size={13} style={{ color: logOpen ? 'var(--primary)' : 'var(--text-3)' }} /></button>
          <button onClick={() => setInspectorOpen((i) => !i)} className="p-1.5 rounded-[8px]" style={{ background: inspectorOpen ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent' }} aria-label="Toggle data inspector"><Braces size={13} style={{ color: inspectorOpen ? 'var(--primary)' : 'var(--text-3)' }} /></button>
          {runStats && (
            <span className="text-[10.5px] pl-2 pr-1" style={{ color: 'var(--text-3)' }}>
              avg {Math.round(runStats.avgMs / 100) / 10}s · {runStats.tokens.toLocaleString()} tok
            </span>
          )}
        </div>

        {/* log panel */}
        {logOpen && (
          <div className="absolute left-3 bottom-16 z-20 w-[380px] max-h-[38vh] rounded-[14px] flex flex-col overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--elevated) 96%, transparent)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center px-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <Terminal size={12} style={{ color: 'var(--text-3)' }} />
              <span className="text-[11px] font-semibold ml-1.5 flex-1" style={{ color: 'var(--text-2)' }}>Execution log</span>
              <button onClick={() => setLogs([])} className="text-[10.5px] mr-2" style={{ color: 'var(--text-3)' }}>Clear</button>
              <button onClick={() => setLogOpen(false)} aria-label="Close log"><X size={13} style={{ color: 'var(--text-3)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {logs.length === 0 && <span style={{ color: 'var(--text-3)' }}>Run the workflow to see live output.</span>}
              {logs.map((l, i) => <div key={i} className="whitespace-pre-wrap break-words">{l}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* data inspector */}
        {inspectorOpen && (
          <div className="absolute right-3 bottom-16 z-20 w-[380px] max-h-[46vh] rounded-[14px] flex flex-col overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--elevated) 96%, transparent)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center px-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <Braces size={12} style={{ color: 'var(--text-3)' }} />
              <span className="text-[11px] font-semibold ml-1.5 flex-1" style={{ color: 'var(--text-2)' }}>Data inspector</span>
              <button
                onClick={() => { if (lastRun) navigator.clipboard.writeText(JSON.stringify({ output: lastRun.output, nodes: lastRun.nodes }, null, 2)) }}
                className="text-[10.5px] mr-2" style={{ color: 'var(--text-3)' }}>Copy</button>
              <button onClick={() => setInspectorOpen(false)} aria-label="Close inspector"><X size={13} style={{ color: 'var(--text-3)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {lastRun ? (
                <div className="space-y-2">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Final output</div>
                  <pre className="text-[10.5px] whitespace-pre-wrap break-words font-mono p-2 rounded-[9px]" style={{ background: 'var(--surface)', color: 'var(--text-2)' }}>{toDisplay(lastRun.output)}</pre>
                  {Object.entries(lastRun.nodes).map(([nid, r]) => {
                    const n = wf.nodes.find((nn) => nn.id === nid)
                    return (
                      <details key={nid} className="rounded-[9px] overflow-hidden" style={{ background: 'var(--surface)' }}>
                        <summary className="px-2.5 py-1.5 text-[11px] cursor-pointer flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                          {r.status === 'ok' ? <CircleCheck size={11} style={{ color: 'var(--success)' }} /> : r.status === 'error' ? <CircleX size={11} style={{ color: 'var(--danger)' }} /> : null}
                          {n?.label ?? nid} <span style={{ color: 'var(--text-3)' }}>{r.ms}ms</span>
                        </summary>
                        <pre className="px-2.5 pb-2 text-[10px] whitespace-pre-wrap break-words font-mono" style={{ color: 'var(--text-3)' }}>{r.error ? `Error: ${r.error}` : toDisplay(r.output)}</pre>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Run the workflow to inspect node outputs.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* overlays */}
      <NodePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.mode === 'insert' ? 'Insert a node on this connector' : 'Add a node'}
        onPick={(def) => {
          if (!picker) return
          if (picker.mode === 'insert' && picker.edgeId) insertOnEdge(def, picker.edgeId, picker.x, picker.y)
          else addNode(def, { x: picker.x + Math.random() * 60, y: picker.y + Math.random() * 40 })
        }}
      />
      <ConfigPanel wf={wf} nodeId={openConfig} onClose={() => setOpenConfig(null)} onChange={patchNode} />
    </div>
  )
}

function uniqueLabel(nodes: WorkflowNode[], base: string): string {
  const taken = new Set(nodes.map((n) => n.label))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base} ${i}`)) i++
  return `${base} ${i}`
}

export { blankWorkflow }
