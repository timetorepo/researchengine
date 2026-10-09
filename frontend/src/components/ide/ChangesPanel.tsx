import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, GitCommitHorizontal, RefreshCw, Undo2 } from 'lucide-react'

/**
 * The changes rail: what is changed and what is staged, a line-numbered diff
 * per file with added lines in green, and the three moves a person makes with
 * it (stage all, revert all, commit). Git runs locally. Revert needs a second
 * click, because it discards work.
 */
export type FileRow = { st: string; file: string; staged: boolean; unstaged: boolean; add: number; del: number }
export type DiffRow = { kind: 'hunk' | 'add' | 'del' | 'ctx' | 'note'; text: string; oldNo?: number; newNo?: number }

/** Unified diff to rows with old and new line numbers. */
export function parseUnifiedDiff(diff: string): DiffRow[] {
  const out: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ') || raw.startsWith('\\ No newline')) continue
    const h = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (h) { oldNo = Number(h[1]); newNo = Number(h[2]); out.push({ kind: 'hunk', text: raw }); continue }
    if (raw.startsWith('+')) { out.push({ kind: 'add', text: raw.slice(1), newNo: newNo++ }); continue }
    if (raw.startsWith('-')) { out.push({ kind: 'del', text: raw.slice(1), oldNo: oldNo++ }); continue }
    if (raw.startsWith(' ')) { out.push({ kind: 'ctx', text: raw.slice(1), oldNo: oldNo++, newNo: newNo++ }); continue }
    if (raw === '') continue
    out.push({ kind: 'note', text: raw })
  }
  // A very large diff would be thousands of rows; cap it so scrolling stays smooth.
  const MAX = 1500
  return out.length > MAX
    ? [...out.slice(0, MAX), { kind: 'note', text: `… ${out.length - MAX} more lines. Open the file to see them all.` }]
    : out
}

const ST_COLOR: Record<string, string> = { M: 'var(--warning)', A: 'var(--success)', D: 'var(--danger)', R: 'var(--ide-accent)', '??': 'var(--ide-accent)' }

function DiffLine({ row }: { row: DiffRow }) {
  if (row.kind === 'hunk') {
    return <div className="px-3 py-0.5 whitespace-pre" style={{ color: 'var(--ide-accent)', background: 'var(--ide-hover)' }}>{row.text}</div>
  }
  if (row.kind === 'note') {
    return <div className="px-3 py-0.5 whitespace-pre" style={{ color: 'var(--ide-faint)' }}>{row.text}</div>
  }
  const add = row.kind === 'add'
  const del = row.kind === 'del'
  return (
    <div className="flex" style={{
      background: add ? 'color-mix(in srgb, var(--success) 14%, transparent)' : del ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : undefined,
    }}>
      <span className="w-9 shrink-0 text-right pr-2 select-none" style={{ color: 'var(--ide-faint)' }}>{row.oldNo ?? ''}</span>
      <span className="w-9 shrink-0 text-right pr-2 select-none" style={{ color: 'var(--ide-faint)' }}>{row.newNo ?? ''}</span>
      <span className="w-3 shrink-0 select-none" style={{ color: add ? 'var(--success)' : del ? 'var(--danger)' : 'transparent' }}>{add ? '+' : del ? '-' : ' '}</span>
      <span className="whitespace-pre pr-3" style={{ color: 'var(--ide-text)' }}>{row.text || ' '}</span>
    </div>
  )
}

export function ChangesPanel({ project }: { project: string }) {
  const [files, setFiles] = useState<FileRow[]>([])
  const [branch, setBranch] = useState('')
  const [repo, setRepo] = useState(true)
  const [tab, setTab] = useState<'unstaged' | 'staged'>('unstaged')
  const [open, setOpen] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<Record<string, DiffRow[]>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [armed, setArmed] = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    const j = await fetch(`/api/ide/git/status?project=${encodeURIComponent(project)}`).then((r) => r.json()).catch(() => null)
    if (!j) return
    setRepo(j.repo !== false)
    setFiles(j.files ?? [])
    setBranch(j.branch ?? '')
  }, [project])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setOpen(null); setDiffs({}) }, [project])
  // Like the reference: the first change arrives already open, once per project.
  const autoOpened = useRef<string | null>(null)

  const unstaged = files.filter((f) => f.unstaged)
  const staged = files.filter((f) => f.staged)
  const list = tab === 'unstaged' ? unstaged : staged
  const q = filter.trim().toLowerCase()
  const shown = list.filter((f) => !q || f.file.toLowerCase().includes(q))
  const add = files.reduce((n, f) => n + f.add, 0)
  const del = files.reduce((n, f) => n + f.del, 0)

  const toggle = async (f: FileRow) => {
    const isStaged = tab === 'staged'
    const key = `${tab}|${f.file}`
    if (open === key) { setOpen(null); return }
    setOpen(key)
    if (!diffs[key]) {
      const j = await fetch(`/api/ide/git/diff?project=${encodeURIComponent(project)}&file=${encodeURIComponent(f.file)}&staged=${isStaged ? 1 : 0}`)
        .then((r) => r.json()).catch(() => null)
      setDiffs((d) => ({ ...d, [key]: parseUnifiedDiff(j?.diff ?? '') }))
    }
  }

  useEffect(() => {
    if (autoOpened.current === project || files.length === 0) return
    const first = files.find((f) => f.unstaged)
    if (!first) return
    autoOpened.current = project
    void toggle(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, project])

  const act = async (path: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setNote('')
    const j = await fetch(`/api/ide/git/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, ...body }),
    }).then((r) => r.json()).catch(() => null)
    setBusy(false)
    if (j?.ok) { setDiffs({}); setOpen(null); void load(); return true }
    setNote(j?.error ?? 'That did not work.')
    return false
  }

  const commit = async () => {
    if (!msg.trim()) return
    if (await act('commit', { message: msg.trim() })) setMsg('')
  }

  const revertAll = async () => {
    if (!armed) {
      setArmed(true)
      setTimeout(() => setArmed(false), 3000)
      return
    }
    setArmed(false)
    await act('revert', { confirm: true })
  }

  if (!repo) {
    return (
      <p className="px-3 py-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        This project is not a git repository yet, so there is nothing to diff. The AI's file edits still show under Activity.
      </p>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 text-[11px]">
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <span className="font-medium text-[12px]" style={{ color: 'var(--ide-text)' }}>Uncommitted changes</span>
        <span className="font-mono text-[10.5px]" style={{ color: 'var(--success)' }}>+{add}</span>
        <span className="font-mono text-[10.5px]" style={{ color: 'var(--danger)' }}>-{del}</span>
        <button onClick={() => void load()} className="ml-auto opacity-70 hover:opacity-100" title="Refresh status"><RefreshCw size={11} /></button>
      </div>

      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        {(['unstaged', 'staged'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setOpen(null) }}
            className="px-2.5 py-1 rounded-[7px] text-[10.5px] font-medium"
            style={{ background: tab === t ? 'var(--ide-hover)' : 'transparent', color: tab === t ? 'var(--ide-text)' : 'var(--ide-faint)' }}>
            {t === 'unstaged' ? 'Unstaged' : 'Staged'} · {t === 'unstaged' ? unstaged.length : staged.length}
          </button>
        ))}
        {branch && <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--ide-faint)' }}>{branch}</span>}
      </div>

      <div className="px-3 py-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…" className="ide-input w-full" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {shown.length === 0 && (
          <p className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
            {tab === 'unstaged' ? 'Nothing waiting to be staged.' : 'Nothing staged yet. Stage all, or stage from the file list.'}
          </p>
        )}
        {shown.map((f) => {
          const key = `${tab}|${f.file}`
          const isOpen = open === key
          return (
            <div key={key} style={{ borderBottom: '1px solid var(--ide-border)' }}>
              <button onClick={() => void toggle(f)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--ide-hover)]">
                {isOpen ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />}
                <span className="font-mono text-[10px] w-5 shrink-0" style={{ color: ST_COLOR[f.st] ?? 'var(--ide-faint)' }}>{f.st}</span>
                <span className="flex-1 min-w-0 truncate font-mono text-[10.5px]" style={{ color: 'var(--ide-text)' }}>{f.file}</span>
                <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--success)' }}>+{f.add}</span>
                <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--danger)' }}>-{f.del}</span>
              </button>
              {isOpen && (
                <div className="font-mono text-[10px] leading-[1.6] overflow-x-auto pb-1.5">
                  {(diffs[key] ?? []).length === 0
                    ? <div className="px-3 py-1" style={{ color: 'var(--ide-faint)' }}>No textual changes.</div>
                    : (diffs[key] ?? []).map((row, i) => <DiffLine key={i} row={row} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(staged.length > 0 || unstaged.length > 0) && (
        <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderTop: '1px solid var(--ide-border)' }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void commit()}
            placeholder={`Commit to ${branch || 'this branch'}`} className="ide-input flex-1 min-w-0" />
          <button disabled={busy || !msg.trim()} onClick={() => void commit()}
            className="flex items-center gap-1 px-2 py-1 rounded-[6px] font-medium disabled:opacity-40 shrink-0"
            style={{ background: 'var(--ide-accent)', color: '#fff' }}>
            <GitCommitHorizontal size={11} /> Commit
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid var(--ide-border)' }}>
        <button onClick={() => void revertAll()} disabled={busy || files.length === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[10.5px] disabled:opacity-40"
          style={{ color: armed ? '#fff' : 'var(--ide-dim)', background: armed ? 'var(--danger)' : 'var(--ide-hover)' }}>
          <Undo2 size={11} /> {armed ? 'Confirm revert' : 'Revert all'}
        </button>
        <button onClick={() => void act('stage', {})} disabled={busy || unstaged.length === 0}
          className="ml-auto px-2.5 py-1.5 rounded-[8px] text-[10.5px] font-medium disabled:opacity-40"
          style={{ background: 'var(--ide-accent)', color: '#fff' }}>
          Stage all
        </button>
      </div>
      {note && <div className="px-3 pb-2 text-[10px]" style={{ color: 'var(--ide-warn)' }}>{note}</div>}
    </div>
  )
}
