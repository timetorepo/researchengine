import React, { useEffect, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import {
  Play, RefreshCw, MousePointerClick, Type as TypeIcon, Link2, CheckCircle2, XCircle, MinusCircle,
  Loader2, RotateCcw, ListChecks, AlertTriangle, Filter,
} from 'lucide-react'
import type { ControlInfo } from '@/lib/ide/bridge'
import { testStore, testControl, replayRun, runSteps, type TestRun, type TestStep } from '@/lib/ide/tests'

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
  if (status === 'fail') return <XCircle size={12} style={{ color: 'var(--danger)' }} />
  if (status === 'running') return <Loader2 size={12} className="animate-spin" style={{ color: 'var(--primary)' }} />
  return <MinusCircle size={12} style={{ color: 'var(--text-3)' }} />
}

function useRuns(): TestRun[] {
  return useSyncExternalStore(testStore.subscribe, testStore.get, testStore.get)
}

function RunCard({ run, compact = false }: { run: TestRun; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const passed = run.steps.filter((s) => s.status === 'pass').length
  const failed = run.steps.filter((s) => s.status === 'fail').length
  const done = passed + failed
  const tone = run.status === 'passed' ? 'var(--ide-accent)' : run.status === 'failed' ? 'var(--ide-danger)' : run.status === 'running' ? 'var(--ide-cyan)' : 'var(--ide-faint)'
  const pill = run.status === 'passed' ? 'accent' : run.status === 'failed' ? 'danger' : run.status === 'running' ? 'cyan' : ''
  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: `1px solid ${failed ? 'color-mix(in srgb, var(--ide-danger) 35%, transparent)' : 'var(--ide-border)'}`, background: 'var(--ide-elevated)' }}>
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <ListChecks size={12} style={{ color: tone }} />
        <span className="text-[11.5px] font-medium truncate flex-1">{run.name}</span>
        <span className={`ide-badge ${pill}`}>{run.status === 'running' ? 'running' : run.status === 'passed' ? 'done' : run.status === 'failed' ? 'review' : 'idle'}</span>
        <span className="text-[10px] tabular-nums" style={{ color: tone }}>{passed}/{run.steps.length}</span>
        <button
          onClick={async () => { setBusy(true); try { await replayRun(run) } finally { setBusy(false) } }}
          disabled={busy || run.status === 'running'}
          title="Replay this test"
          className="ide-icon-btn disabled:opacity-40" style={{ width: 20, height: 20 }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
        </button>
      </div>

      {/* Kodeo-style segmented progress */}
      <div className="px-2.5 pt-2">
        <div className="ide-progress">
          {run.steps.map((_, i) => <i key={i} className={i < done || (run.status === 'running' && run.steps[i]?.status === 'running') ? 'on' : ''} />)}
        </div>
      </div>

      <div className={compact ? 'max-h-40 overflow-y-auto' : ''}>
        {run.steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2 px-2.5 py-1.5"
            style={{ borderTop: i ? '1px solid var(--ide-border)' : undefined }}>
            <span className="mt-[2px]"><StatusIcon status={s.status} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] leading-snug" style={{ color: 'var(--ide-text)' }}>{s.label}</div>
              {s.detail && s.detail !== 'queued' && (
                <div className="text-[10.5px] leading-snug mt-0.5 break-words" style={{ color: s.status === 'fail' ? 'var(--ide-danger)' : 'var(--ide-faint)' }}>{s.detail}</div>
              )}
            </div>
            <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--ide-faint)' }}>{s.ms ? `${s.ms}ms` : ''}</span>
            <button
              title="Run this step on its own"
              onClick={() => { const step = run.spec[i]; if (step) void runSteps([step], `step: ${s.label}`) }}
              className="ide-icon-btn shrink-0" style={{ width: 20, height: 20 }}>
              <Play size={10} />
            </button>
          </div>
        ))}
        {failed > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px]" style={{ borderTop: '1px solid var(--ide-border)', color: 'var(--ide-danger)' }}>
            <AlertTriangle size={11} /> {failed} step{failed > 1 ? 's' : ''} failed — ask the AI to fix and re-run
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The Test panel: every control discovered in the live preview becomes a
 * one-click client tool call, and every run (yours or the AI's) is listed with
 * per-step pass/fail and replay.
 */
export function TestPanel({
  controls, loading, onRefresh, onHighlight, project,
}: {
  controls: ControlInfo[]
  loading: boolean
  onRefresh: () => void
  onHighlight: (sel: string) => void
  project: string
}) {
  const runs = useRuns()
  const [filter, setFilter] = useState('')
  const [runningUid, setRunningUid] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q ? controls.filter((c) => c.name.toLowerCase().includes(q) || (c.testid ?? '').toLowerCase().includes(q)) : controls
    return list.slice(0, 60)
  }, [controls, filter])

  const byKind = useMemo(() => ({
    button: shown.filter((c) => c.kind === 'button'),
    link: shown.filter((c) => c.kind === 'link'),
    input: shown.filter((c) => c.kind === 'input'),
  }), [shown])

  const runOne = async (c: ControlInfo) => {
    setRunningUid(c.uid)
    try { await testControl(c) } finally { setRunningUid(null) }
  }

  const runAll = async () => {
    setRunningAll(true)
    try {
      for (const c of shown.slice(0, 12)) {
        setRunningUid(c.uid)
        await testControl(c)
      }
    } finally { setRunningUid(null); setRunningAll(false) }
  }

  const icon = (kind: string) => kind === 'input' ? <TypeIcon size={11} /> : kind === 'link' ? <Link2 size={11} /> : <MousePointerClick size={11} />

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${controls.length} control(s)…`}
          className="ide-input flex-1" />
        <button onClick={onRefresh} title="Re-scan the page" className="ide-icon-btn" style={{ width: 26, height: 26 }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
        <button onClick={() => void runAll()} disabled={runningAll || !shown.length} className="ide-btn primary">
          {runningAll ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run all
        </button>
      </div>

      <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        Every button below is a real click on the running app — the same client tool calls the AI uses. Results appear as pass/fail steps with a replayable script.
      </p>

      {(['button', 'link', 'input'] as const).map((kind) => byKind[kind].length ? (
        <div key={kind} className="flex flex-col gap-1">
          <div className="ide-section px-0.5">{kind}s · {byKind[kind].length}</div>
          {byKind[kind].map((c) => (
            <div key={c.uid} className="group flex items-center gap-2 px-2 py-1.5 rounded-[8px]"
              style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border)' }}>
              <span style={{ color: 'var(--ide-accent)' }}>{icon(c.kind)}</span>
              <button onClick={() => onHighlight(c.sel)} title={`Highlight in preview · ${c.sel}`}
                className="text-left text-[11.5px] truncate flex-1" style={{ color: c.disabled ? 'var(--ide-faint)' : 'var(--ide-text)' }}>
                {c.name}
                {c.testid && <span className="ml-1.5 text-[9.5px] px-1 rounded" style={{ background: 'var(--ide-bg)', color: 'var(--ide-faint)' }}>{c.testid}</span>}
              </button>
              <span className="text-[9.5px] tabular-nums shrink-0" style={{ color: 'var(--ide-faint)' }}>{c.rect.w}×{c.rect.h}</span>
              <button onClick={() => void runOne(c)} disabled={!!runningUid || c.disabled}
                title="Click it and check the console"
                className="ide-icon-btn shrink-0 opacity-60 group-hover:opacity-100 disabled:opacity-30"
                style={{ width: 22, height: 22, color: 'var(--ide-accent)' }}>
                {runningUid === c.uid ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              </button>
            </div>
          ))}
        </div>
      ) : null)}

      {!controls.length && !loading && (
        <div className="text-[11.5px] p-3 rounded-[10px]" style={{ background: 'var(--ide-elevated)', color: 'var(--ide-faint)', border: '1px solid var(--ide-border)' }}>
          No controls found yet. Start the preview and refresh — or navigate the preview to a screen with buttons.
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="ide-section">Runs · {runs.length}</span>
        {runs.length > 0 && (
          <button onClick={() => testStore.clear()} className="ide-btn" style={{ height: 20 }}>clear</button>
        )}
      </div>
      {runs.length === 0 && (
        <div className="text-[11px] px-1" style={{ color: 'var(--ide-faint)' }}>
          Runs appear here — yours from the buttons above, the AI's from <code style={{ fontFamily: 'var(--font-mono)' }}>run_ui_test</code>.
          {' '}You are in <strong>{project}</strong>.
        </div>
      )}
      {runs.map((r) => <RunCard key={r.id} run={r} />)}
    </div>
  )
}
