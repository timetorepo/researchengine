/**
 * Idea to Production — the last directive, and the only one that touches the
 * outside world, so it asks first.
 *
 * It writes the host's config files into the project (real files, reviewable in
 * the editor afterwards), shows exactly what will be written before writing it,
 * and lists what only a person can do — connect the repository, set the
 * environment variables, press deploy. Nothing deploys from here: the signal is
 * the user's, and this panel says so on its face.
 */
import React, { useMemo, useState } from 'react'
import { Rocket, Check, FileCode2, ClipboardCopy, AlertTriangle } from 'lucide-react'
import { SHIP_TARGETS, shipChecklist, shipFiles, type ShipTargetId } from '@/lib/design/directives'
import { FRAMEWORKS, detectFramework } from '@/lib/design/frameworks'

export function ShipPanel({ project, files }: { project: string; files: string[] }) {
  const detected = useMemo(() => detectFramework(files), [files])
  const [framework, setFramework] = useState(detected?.id ?? 'react-vite')
  const [target, setTarget] = useState<ShipTargetId>('vercel')
  const [written, setWritten] = useState<{ path: string; ok: boolean; note: string }[] | null>(null)
  const [busy, setBusy] = useState(false)

  const ctx = { target, framework }
  const planned = useMemo(() => shipFiles(ctx), [target, framework])
  const t = SHIP_TARGETS.find((x) => x.id === target)!
  const checklist = shipChecklist(ctx)

  const write = async () => {
    setBusy(true)
    const results: { path: string; ok: boolean; note: string }[] = []
    for (const f of planned) {
      try {
        const res = await fetch('/api/ide/file', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project, path: f.path, content: f.content }),
        })
        const json = await res.json().catch(() => ({}))
        results.push({ path: f.path, ok: res.ok, note: res.ok ? `+${json.added ?? 0} lines` : (json.error ?? `HTTP ${res.status}`) })
      } catch (e) {
        results.push({ path: f.path, ok: false, note: String((e as any)?.message ?? e) })
      }
    }
    setWritten(results)
    setBusy(false)
  }

  const copyManual = async () => {
    const text = [
      `${t.name} — what is left for you:`,
      ...t.manual.map((m, i) => `${i + 1}. ${m}`),
      '',
      'Checklist before you press deploy:',
      ...checklist.map((c) => `- ${c}`),
    ].join('\n')
    try { await navigator.clipboard.writeText(text) } catch { /* blocked */ }
  }

  return (
    <div className="flex flex-col gap-3 min-h-0" data-ship-panel>
      <div className="flex flex-wrap items-center gap-2">
        <Rocket size={12} style={{ color: 'var(--ide-dim, var(--text-3))' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Idea to Production</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>prepares the repo — you press deploy</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Framework</label>
        <select value={framework} onChange={(e) => setFramework(e.target.value)} className="ide-input text-[11.5px] py-1" data-ship-framework>
          {FRAMEWORKS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {detected && (
          <span className="text-[10.5px]" style={{ color: detected.id === framework ? 'var(--success)' : 'var(--ide-faint, var(--text-3))' }}>
            {detected.id === framework ? `detected in ${project}` : `project looks like ${detected.name}`}
          </span>
        )}
        <label className="text-[11px] ml-2" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Host</label>
        <div className="flex flex-wrap gap-1">
          {SHIP_TARGETS.map((s) => (
            <button key={s.id} onClick={() => setTarget(s.id)}
              className="px-2 py-1 rounded-[8px] text-[11px]"
              style={{
                background: target === s.id ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--ide-hover, var(--elevated))',
                color: target === s.id ? 'var(--primary)' : 'var(--ide-dim, var(--text-2))',
              }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11.5px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{t.summary}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
        <div className="flex flex-col gap-1.5 min-h-0">
          <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            Will be written into {project || 'the project'}
          </span>
          {planned.map((f) => (
            <div key={f.path} className="rounded-[9px] overflow-hidden" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono" style={{ color: 'var(--ide-text, var(--text))' }}>
                <FileCode2 size={11} /> {f.path}
                {written && (
                  written.find((w) => w.path === f.path)?.ok
                    ? <span className="ml-auto inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--success)' }}>
                        <Check size={10} /> {written.find((w) => w.path === f.path)?.note}
                      </span>
                    : written.find((w) => w.path === f.path)
                      ? <span className="ml-auto inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--danger)' }}>
                          <AlertTriangle size={10} /> {written.find((w) => w.path === f.path)?.note}
                        </span>
                      : null
                )}
              </div>
              <pre className="px-2 pb-2 text-[10px] font-mono overflow-x-auto max-h-[180px]"
                style={{ color: 'var(--ide-dim, var(--text-2))' }}>{f.content || '(empty file)'}</pre>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            Only you can do these
          </span>
          <ol className="flex flex-col gap-1">
            {t.manual.map((m, i) => (
              <li key={i} className="flex gap-2 text-[11.5px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>
                <span className="shrink-0 w-[16px] h-[16px] rounded-full grid place-items-center text-[10px]"
                  style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-faint, var(--text-3))' }}>{i + 1}</span>
                {m}
              </li>
            ))}
          </ol>
          <span className="text-[10.5px] uppercase tracking-wide mt-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            Before you press deploy
          </span>
          <ul className="flex flex-col gap-1">
            {checklist.map((c, i) => (
              <li key={i} className="flex gap-2 text-[11.5px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>
                <Check size={11} className="mt-[3px] shrink-0" style={{ color: 'var(--ide-faint, var(--text-3))' }} /> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={write} disabled={busy || !project}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11.5px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
          <Rocket size={11} /> {busy ? 'Writing…' : planned.length === 1 ? 'Write the config file' : `Write ${planned.length} files`}
        </button>
        <button onClick={copyManual} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11.5px]"
          style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
          <ClipboardCopy size={11} /> Copy the checklist
        </button>
        {!project && <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Open a project first.</span>}
      </div>

      <p className="text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
        Nothing here deploys anything. The deploy is yours to press, on the host you chose — this only makes the
        repository ready for it.
      </p>
    </div>
  )
}
