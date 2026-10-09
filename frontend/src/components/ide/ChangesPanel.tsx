import { useCallback, useEffect, useState } from 'react'
import { GitCommitHorizontal, RefreshCw } from 'lucide-react'

/**
 * The uncommitted-changes rail: git status as a file list, a unified diff per
 * file (green adds, red drops, like a source client), and a one-line commit.
 * Read-only git plus an explicit commit; nothing pushes or rewrites history.
 */
type StatusFile = { st: string; file: string }

const ST_COLOR: Record<string, string> = { M: 'var(--warning)', A: 'var(--success)', D: 'var(--danger)', '??': 'var(--ide-accent)' }

export function ChangesPanel({ project }: { project: string }) {
  const [files, setFiles] = useState<StatusFile[]>([])
  const [repo, setRepo] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const j = await fetch(`/api/ide/git/status?project=${encodeURIComponent(project)}`).then((r) => r.json()).catch(() => null)
    if (!j) return
    setRepo(j.repo !== false)
    setFiles(j.files ?? [])
    if (sel && !(j.files ?? []).some((f: StatusFile) => f.file === sel)) { setSel(null); setDiff('') }
  }, [project, sel])

  useEffect(() => { void load() }, [load])

  const openFile = async (file: string) => {
    setSel(file)
    const j = await fetch(`/api/ide/git/diff?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`).then((r) => r.json()).catch(() => null)
    setDiff(j?.diff ?? '')
  }

  const commit = async () => {
    if (!msg.trim()) return
    setBusy(true); setNote('')
    const j = await fetch('/api/ide/git/commit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, message: msg.trim() }),
    }).then((r) => r.json()).catch(() => null)
    if (j?.ok) { setMsg(''); setNote(j.out || 'committed'); void load() }
    else setNote(j?.error ?? 'commit failed')
    setBusy(false)
  }

  if (!repo) {
    return <p className="px-3 py-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
      This project is not a git repository yet, so there is nothing to diff. The AI's file edits still show under Activity.
    </p>
  }

  return (
    <div className="h-full flex flex-col min-h-0 text-[10.5px]">
      <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <span className="font-medium" style={{ color: 'var(--ide-text)' }}>Uncommitted changes</span>
        <span className="re-tab-count">{files.length}</span>
        <button className="ml-auto opacity-70 hover:opacity-100" onClick={() => void load()} title="Refresh status"><RefreshCw size={11} /></button>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="Commit message…" className="ide-input flex-1" />
        <button disabled={busy || !msg.trim()} onClick={() => void commit()}
          className="flex items-center gap-1 px-2 py-1 rounded-[6px] font-medium disabled:opacity-40"
          style={{ background: 'var(--ide-accent)', color: '#fff' }}>
          <GitCommitHorizontal size={11} /> Commit
        </button>
      </div>
      {note && <div className="px-2.5 py-1" style={{ color: 'var(--ide-faint)' }}>{note}</div>}
      <div className="flex-1 min-h-0 flex">
        <div className="w-[132px] shrink-0 overflow-y-auto py-1" style={{ borderRight: '1px solid var(--ide-border)' }}>
          {files.length === 0 && <p className="px-2 py-2" style={{ color: 'var(--ide-faint)' }}>Working tree clean.</p>}
          {files.map((f) => (
            <button key={f.file} onClick={() => void openFile(f.file)}
              className="w-full flex items-center gap-1 px-2 py-1 text-left truncate hover:bg-[var(--ide-hover)]"
              style={{ background: sel === f.file ? 'var(--ide-hover)' : 'transparent', color: 'var(--ide-text)' }}>
              <span className="font-mono w-4 shrink-0" style={{ color: ST_COLOR[f.st] ?? 'var(--ide-faint)' }}>{f.st}</span>
              <span className="truncate">{f.file}</span>
            </button>
          ))}
        </div>
        <pre className="flex-1 overflow-auto px-2 py-1.5 font-mono text-[9.5px] leading-[1.5] whitespace-pre-wrap" style={{ color: 'var(--ide-dim)' }}>
          {sel ? diff.split('\n').map((l, i) => (
            <div key={i} style={{
              color: l.startsWith('+') ? 'var(--success)' : l.startsWith('-') ? 'var(--danger)' : l.startsWith('@@') ? 'var(--ide-accent)' : undefined,
              background: l.startsWith('+') ? 'color-mix(in srgb, var(--success) 10%, transparent)' : l.startsWith('-') ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : undefined,
            }}>{l || ' '}</div>
          )) : <span style={{ color: 'var(--ide-faint)' }}>Pick a file to see its diff.</span>}
        </pre>
      </div>
    </div>
  )
}
