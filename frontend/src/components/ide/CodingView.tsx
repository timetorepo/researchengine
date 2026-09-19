import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FolderGit2, Plus, Upload, Trash2, ChevronRight, ChevronDown, FileCode2, Save, Play, GitBranch,
  TerminalSquare, Sparkles, Loader2, AlertTriangle, Check, X, MessageSquareText, FolderPlus, RefreshCw, Code2,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { runChat, isStreamingChat, enqueuePrompt, stopStream } from '@/lib/chat/runChat'
import { Markdown } from '@/components/chat/Markdown'
import { ToolTraceChips, ExecApproval, QuestionnaireCard } from '@/components/chat/ToolUI'
import { fmt, timeAgo } from '@/lib/utils'
import type { ChatMessage } from '@/types'

interface ProjectInfo { name: string; files: number; size: number; mtime: number; git: boolean }
interface TreeNode { name: string; path: string; dir: boolean; children?: TreeNode[] }

/* ================================================================== */
/* Project list                                                        */
/* ================================================================== */
export function CodingView() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [demo, setDemo] = useState(false)
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const ui = useUI()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ide/projects')
      setProjects((await res.json()).projects ?? [])
    } catch { setProjects([]) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  // Other surfaces (AI file writes, terminal) announce changes here.
  useEffect(() => {
    const h = () => void refresh()
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [refresh])

  const create = async () => {
    const name = newName.trim().replace(/\s+/g, ' ')
    if (!name) { setErr('Enter a project name.'); return }
    if (name.length > 128) { setErr('Project names can be up to 128 characters.'); return }
    if (/[/\\\u0000]/.test(name) || name === '.' || name === '..') {
      setErr('Project names cannot contain path separators.'); return
    }
    setErr('')
    const res = await fetch('/api/ide/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, projectName: name, files: { 'README.md': `# ${name}\n\nCreated with Research Engine Coding.\n`, 'main.py': 'print("hello")\n' } }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not create the project.'); return }
    setCreating(false); setNewName(''); setOpen(name); void refresh()
  }

  const importArchive = async (file: File) => {
    const name = file.name.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '').replace(/[^a-zA-Z0-9 _.-]/g, '')
    if (file.size > 24 * 1024 * 1024) { ui.toast('Too large', 'Project archives are capped at 24 MB.', 'warning'); return }
    const dataBase64 = await new Promise<string>((resolve) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] ?? ''); r.readAsDataURL(file)
    })
    const res = await fetch('/api/ide/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, fileName: file.name, dataBase64 }),
    })
    const j = await res.json()
    if (!res.ok) { ui.toast('Import failed', j.error ?? 'Unknown error', 'danger'); return }
    ui.toast('Project imported', `${name} is ready — the AI can now read, fix and refine it.`, 'success')
    setOpen(name); void refresh()
  }

  const del = async (name: string) => {
    await fetch(`/api/ide/projects/${encodeURIComponent(name)}`, { method: 'DELETE' })
    void refresh()
  }

  if (open) return <IDE project={open} onClose={() => { setOpen(null); void refresh() }} />
  if (demo) return <DemoIDE onClose={() => setDemo(false)} />

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[880px] mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1.5">
          <FolderGit2 size={22} style={{ color: 'var(--primary)' }} />
          <h1 className="text-[22px] font-semibold tracking-tight">Coding</h1>
        </div>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>
          Local projects with an AI pair-programmer: edit code together, run guarded commands, use git — everything stays on this machine.
        </p>

        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <Plus size={14} /> New project
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}>
            <Upload size={14} /> Upload existing (.zip / .tar.gz)
          </button>
          <input ref={uploadRef} type="file" accept=".zip,.tar.gz,.tgz,.tar" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importArchive(f); e.target.value = '' }} />
        </div>

        <AnimatePresence>
          {creating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5">
              <div className="surface p-4 flex items-center gap-2">
                <FolderPlus size={15} style={{ color: 'var(--primary)' }} />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && create()}
                  maxLength={128}
                  placeholder="Name your project"
                  aria-label="Project name"
                  className="flex-1 px-3 py-1.5 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
                <button onClick={create} className="px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create</button>
                <button onClick={() => setCreating(false)} className="p-1.5 rounded-[10px]" style={{ color: 'var(--text-3)' }}><X size={14} /></button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Any name up to 128 characters; path separators are not allowed</p>
                <p className="text-[11px] tabular-nums" style={{ color: newName.length > 64 ? 'var(--danger)' : 'var(--text-3)' }}>{newName.length}/128</p>
              </div>
              {err && <p className="text-[12px] mt-1.5" style={{ color: 'var(--danger)' }}>{err}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {projects === null ? (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-3)' }}><Loader2 size={14} className="animate-spin" /> Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="surface p-8 text-center">
            <p className="text-[13.5px] mb-1">No projects yet.</p>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Create one, or upload a local project archive and let the AI fix or refine it.</p>
            <button onClick={() => setDemo(true)} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}><Code2 size={13} /> Preview the IDE</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div key={p.name} className="surface p-4 group relative">
                <button onClick={() => setOpen(p.name)} className="text-left w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderGit2 size={16} style={{ color: 'var(--primary)' }} />
                    <span className="font-medium text-[13.5px] truncate">{p.name}</span>
                    {p.git && <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>git</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.files} files · {fmt(p.size)} · {timeAgo(p.mtime)}</div>
                </button>
                <button onClick={() => del(p.name)} aria-label={`Delete ${p.name}`}
                  className="absolute top-3 right-3 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--danger)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/* IDE demo                                                            */
/* ================================================================== */
function DemoIDE({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState('src/App.tsx')
  const [code, setCode] = useState(`export function App() {\n  return <ResearchEngine />\n}\n`)
  const files = ['src/App.tsx', 'src/main.tsx', 'package.json', 'README.md']
  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--code-bg)' }}>
      <div className="h-12 shrink-0 flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        <button onClick={onClose} className="text-[12px]" style={{ color: 'var(--text-2)' }}>Back to projects</button>
        <span style={{ color: 'var(--text-3)' }}>/</span><span className="text-[13px] font-medium">IDE preview</span>
        <span className="ml-auto px-2 py-1 rounded-full text-[10px]" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>Read-only demo</span>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[210px_minmax(0,1fr)]">
        <aside className="p-3 overflow-y-auto" style={{ borderRight: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Explorer</div>
          {files.map((f) => <button key={f} onClick={() => setFile(f)} className="w-full flex items-center gap-2 px-2 py-2 rounded-[8px] text-left text-[12px] hover:bg-[var(--elevated)]" style={{ color: f === file ? 'var(--primary)' : 'var(--text-2)' }}><FileCode2 size={13} />{f}</button>)}
          <div className="mt-5 text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Source control</div><div className="text-[11px]" style={{ color: 'var(--text-3)' }}>No repository connected</div>
        </aside>
        <main className="min-w-0 flex flex-col">
          <div className="h-10 flex items-center px-4 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>{file}</div>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="flex-1 w-full resize-none p-5 outline-none font-mono text-[13px] leading-6" style={{ background: 'var(--code-bg)', color: 'var(--text)' }} aria-label="Demo code editor" />
          <div className="h-32 shrink-0 p-3 font-mono text-[11px]" style={{ borderTop: '1px solid var(--surface-border)', background: '#0b0d10', color: 'var(--text-3)' }}><div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-2)' }}><TerminalSquare size={13} /> Terminal</div><div>$ npm test</div><div style={{ color: 'var(--success)' }}>Demo preview: commands are disabled until you open a real project.</div></div>
        </main>
      </div>
    </div>
  )
}

/* ================================================================== */
/* IDE                                                                 */
/* ================================================================== */
function IDE({ project, onClose }: { project: string; onClose: () => void }) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [disk, setDisk] = useState('')
  const [newFile, setNewFile] = useState('')
  const [tab, setTab] = useState<'terminal' | 'git'>('terminal')
  const loadTree = useCallback(async () => {
    const res = await fetch(`/api/ide/tree?project=${encodeURIComponent(project)}`)
    if (res.ok) setTree((await res.json()).tree ?? [])
  }, [project])
  useEffect(() => { void loadTree() }, [loadTree])
  useEffect(() => {
    const h = () => void loadTree()
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [loadTree])

  const openFile = async (path: string) => {
    const res = await fetch(`/api/ide/file?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`)
    if (!res.ok) { useUI.getState().toast('Cannot open', (await res.json()).error ?? 'File error', 'danger'); return }
    const j = await res.json()
    setSel(path); setContent(j.content); setDisk(j.content)
  }

  const save = useCallback(async () => {
    if (!sel) return
    const res = await fetch('/api/ide/file', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, path: sel, content }),
    })
    if (res.ok) { setDisk(content); useUI.getState().toast('Saved', sel, 'success'); window.dispatchEvent(new CustomEvent('re:ide-changed')) }
  }, [project, sel, content])

  const addFile = async () => {
    const p = newFile.trim()
    if (!p) return
    await fetch('/api/ide/file', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, path: p, content: '' }),
    })
    setNewFile(''); void loadTree(); openFile(p)
  }

  const dirty = content !== disk

  return (
    <div className="h-full flex flex-col relative">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <button onClick={onClose} className="text-[12px] hover:underline" style={{ color: 'var(--text-2)' }}>Projects</button>
        <ChevronRight size={12} style={{ color: 'var(--text-3)' }} />
        <FolderGit2 size={14} style={{ color: 'var(--primary)' }} />
        <span className="text-[13px] font-medium">{project}</span>
        <div className="flex-1" />
        <span className="text-[11px] mr-1" style={{ color: dirty ? 'var(--warning)' : 'var(--text-3)' }}>{sel ? (dirty ? 'unsaved changes' : sel) : 'no file open'}</span>
        <button onClick={save} disabled={!sel || !dirty}
          className="flex items-center gap-1 px-2.5 py-1 rounded-[10px] text-[12px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Save size={12} /> Save
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* file tree */}
        <div className="w-56 shrink-0 overflow-y-auto py-2 pr-1" style={{ borderRight: '1px solid var(--surface-border)' }}>
          <div className="px-3 pb-1.5">
            <input value={newFile} onChange={(e) => setNewFile(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFile()}
              placeholder="new/file.tsx + Enter"
              className="w-full px-2 py-1 rounded-[8px] text-[11px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
          </div>
          <Tree nodes={tree} depth={0} sel={sel} onOpen={openFile} />
        </div>

        {/* editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void save() } }}
            spellCheck={false}
            placeholder={sel ? '' : 'Open a file from the tree — or ask the AI assistant to create one.'}
            className="flex-1 w-full p-4 bg-transparent outline-none resize-none font-mono text-[12.5px] leading-[1.55]"
            style={{ color: 'var(--text)', caretColor: 'var(--primary)' }}
          />
          {/* bottom panel: terminal + git */}
          <div className="h-52 shrink-0 flex flex-col" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <TabBtn active={tab === 'terminal'} onClick={() => setTab('terminal')} icon={<TerminalSquare size={12} />} label="Terminal" />
              <TabBtn active={tab === 'git'} onClick={() => setTab('git')} icon={<GitBranch size={12} />} label="Git" />
              <div className="flex-1" />
              <span className="text-[10px] px-2" style={{ color: 'var(--text-3)' }}>commands run inside the project folder · destructive commands are blocked · mutating ones need approval</span>
            </div>
            {tab === 'terminal' ? <TerminalPanel project={project} /> : <GitPanel project={project} />}
          </div>
        </div>

        {/* floating AI assistant */}
        <IDEChat project={project} tree={tree} />
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11.5px]"
      style={{ background: active ? 'var(--elevated)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)', border: '1px solid ' + (active ? 'var(--surface-border)' : 'transparent') }}>
      {icon} {label}
    </button>
  )
}

function Tree({ nodes, depth, sel, onOpen }: { nodes: TreeNode[]; depth: number; sel: string | null; onOpen: (p: string) => void }) {
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({})
  return (
    <div>
      {nodes.map((n) => (
        <div key={n.path}>
          <button
            onClick={() => n.dir ? setOpenDirs((d) => ({ ...d, [n.path]: !d[n.path] })) : onOpen(n.path)}
            className="w-full flex items-center gap-1 px-2 py-[3px] text-left text-[11.5px] hover:bg-[var(--surface)] transition-colors"
            style={{ paddingLeft: 8 + depth * 12, color: sel === n.path ? 'var(--primary)' : 'var(--text-2)', background: sel === n.path ? 'var(--elevated)' : undefined }}>
            {n.dir ? (openDirs[n.path] ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <FileCode2 size={11} style={{ opacity: 0.7 }} />}
            <span className="truncate">{n.name}</span>
          </button>
          {n.dir && openDirs[n.path] && n.children && <Tree nodes={n.children} depth={depth + 1} sel={sel} onOpen={onOpen} />}
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/* Terminal (guarded)                                                  */
/* ================================================================== */
function TerminalPanel({ project }: { project: string }) {
  const [lines, setLines] = useState<{ kind: 'cmd' | 'out' | 'err' | 'info'; text: string }[]>([
    { kind: 'info', text: 'Guarded terminal — commands run only inside this project, with secrets stripped from the environment.' },
  ])
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ command: string } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const run = async (command: string, confirmed = false) => {
    setBusy(true)
    setLines((l) => [...l, { kind: 'cmd', text: `$ ${command}` }])
    try {
      const res = await fetch('/api/ide/exec', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, command, confirmed }),
      })
      const j = await res.json()
      if (j.blocked) { setLines((l) => [...l, { kind: 'err', text: `BLOCKED: ${j.reason}` }]); return }
      if (j.requiresConfirm && !confirmed) { setConfirm({ command }); setLines((l) => [...l, { kind: 'info', text: 'This command needs your approval below.' }]); return }
      if (j.stdout) setLines((l) => [...l, { kind: 'out', text: j.stdout.slice(0, 20000) }])
      if (j.stderr) setLines((l) => [...l, { kind: 'err', text: j.stderr.slice(0, 8000) }])
      setLines((l) => [...l, { kind: 'info', text: `exit ${j.exit} · ${j.ms}ms${j.timedOut ? ' · TIMED OUT' : ''}` }])
      window.dispatchEvent(new CustomEvent('re:ide-changed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap" style={{ color: l.kind === 'cmd' ? 'var(--primary)' : l.kind === 'err' ? 'var(--danger)' : l.kind === 'info' ? 'var(--text-3)' : 'var(--text)' }}>{l.text}</div>
        ))}
        {confirm && (
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>Approve “{confirm.command}”?</span>
            <button onClick={() => { const c = confirm.command; setConfirm(null); void run(c, true) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]" style={{ background: 'var(--success)', color: '#fff' }}><Check size={11} /> Run</button>
            <button onClick={() => setConfirm(null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}><X size={11} /> Skip</button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
        <span className="font-mono text-[11.5px]" style={{ color: 'var(--primary)' }}>$</span>
        <input value={cmd} onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && cmd.trim() && !busy) { const c = cmd.trim(); setCmd(''); void run(c) } }}
          disabled={busy}
          placeholder={busy ? 'running…' : 'npm test, git status, ls — Enter to run'}
          className="flex-1 bg-transparent outline-none font-mono text-[11.5px]"
          style={{ color: 'var(--text)' }} />
        {busy && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Git panel                                                           */
/* ================================================================== */
function GitPanel({ project }: { project: string }) {
  const [status, setStatus] = useState('')
  const [log, setLog] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [isRepo, setIsRepo] = useState(true)
  const [out, setOut] = useState('')

  const refresh = useCallback(async () => {
    const s = await fetch(`/api/ide/git?project=${encodeURIComponent(project)}&op=status`)
    const sj = await s.json()
    if (sj.norepo) { setIsRepo(false); return }
    setIsRepo(true)
    setStatus(sj.stdout ?? '')
    const l = await fetch(`/api/ide/git?project=${encodeURIComponent(project)}&op=log`)
    setLog((await l.json()).stdout ?? '')
  }, [project])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const h = () => void refresh()
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [refresh])

  const commit = async () => {
    if (!msg.trim()) return
    setBusy(true)
    const res = await fetch('/api/ide/git', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, op: 'commit', message: msg.trim(), confirmed: true }),
    })
    const j = await res.json()
    setOut(j.stderr || j.stdout || '')
    setMsg(''); setBusy(false); void refresh()
  }

  if (!isRepo) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3">
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Not a git repository yet.</span>
        <button onClick={async () => { await fetch('/api/ide/git', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project, op: 'init' }) }); void refresh() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
          <GitBranch size={13} /> git init
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-0">
      <div className="overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed" style={{ borderRight: '1px solid var(--surface-border)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-1 font-sans" style={{ color: 'var(--text-3)' }}>status</div>
        <div className="whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{status || 'working tree clean'}</div>
        <div className="text-[10px] uppercase tracking-wider mt-3 mb-1 font-sans" style={{ color: 'var(--text-3)' }}>log</div>
        <div className="whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{log || 'no commits yet'}</div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Commit message…"
          className="w-full p-2 rounded-[10px] text-[12px] outline-none resize-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
        <button onClick={commit} disabled={busy || !msg.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Stage all &amp; commit
        </button>
        {out && <div className="text-[10.5px] font-mono" style={{ color: 'var(--text-3)' }}>{out.slice(0, 400)}</div>}
        <button onClick={() => void refresh()} className="flex items-center gap-1 text-[11px] self-start" style={{ color: 'var(--text-3)' }}>
          <RefreshCw size={11} /> refresh
        </button>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Floating AI assistant (morphed chatbox)                             */
/* ================================================================== */
function IDEChat({ project, tree }: { project: string; tree: TreeNode[] }) {
  const ui = useUI()
  const [open, setOpen] = useState(true)
  const [chatId, setChatId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [, force] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const store = useStore.getState()
    const title = `Coding · ${project}`
    const existing = [...store.chats].reverse().find((c) => c.title === title)
    if (existing) { setChatId(existing.id); return }
    const id = store.newChat()
    store.renameChat(id, title)
    setChatId(id)
  }, [project])

  const chat = useStore((s) => s.chats.find((c) => c.id === chatId))
  const streaming = chatId ? isStreamingChat(chatId) : false
  useEffect(() => {
    const iv = setInterval(() => { if (chatId && isStreamingChat(chatId)) force((n) => n + 1) }, 300)
    return () => clearInterval(iv)
  }, [chatId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat?.messages.length, streaming])

  const treeText = tree.map((n) => (n.dir ? `${n.name}/` : n.name)).join('\n')

  const send = (prompt: string) => {
    if (!chatId || !prompt.trim()) return
    const opts = { project, projectTree: treeText }
    if (isStreamingChat(chatId)) { enqueuePrompt(chatId, prompt.trim(), {}, opts); return }
    runChat({ chatId, prompt, mode: {}, ...opts })
  }

  const askToFix = () => send(
    `Interview me about what I want to fix or refine in this project. Call the ask_user tool with 3-5 focused questions you generate from the project's actual files and stack (do not use canned questions). After I answer, inspect the relevant files and propose a concrete plan before changing anything.`,
  )

  return (
    <div className="absolute bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {open && chat && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="glass-chat flex flex-col mb-2 overflow-hidden"
            style={{ borderRadius: 18, height: 'min(58vh, 520px)', boxShadow: '0 24px 64px -20px rgba(0,0,0,0.55)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <Sparkles size={14} style={{ color: 'var(--primary)' }} />
              <span className="text-[12.5px] font-medium flex-1 truncate">AI pair-programmer · {project}</span>
              <button onClick={askToFix} title="The AI will interview you about what to fix"
                className="text-[10.5px] px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
                What should we fix?
              </button>
              <button onClick={() => setOpen(false)} aria-label="Collapse assistant" className="p-1 rounded-md" style={{ color: 'var(--text-3)' }}><X size={13} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chat.messages.length === 0 && (
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  I can read and edit this project's files, run commands (with your approval), check git, and interview you about what to improve. Try “What should we fix?”
                </p>
              )}
              {chat.messages.map((m: ChatMessage) => (
                <div key={m.id}>
                  {m.role === 'user' ? (
                    <div className="ml-auto max-w-[88%] px-3 py-2 rounded-[12px] text-[12.5px] whitespace-pre-wrap"
                      style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--text)', width: 'fit-content' }}>
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[95%]">
                      <ToolTraceChips msg={m} />
                      <ExecApproval chatId={chat.id} msg={m} />
                      <QuestionnaireCard chatId={chat.id} msg={m} />
                      {m.error ? (
                        <div className="text-[12px] p-2.5 rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{m.error}</div>
                      ) : (
                        <div className="text-[12.5px]"><Markdown content={m.content} streaming={streaming && m.id === chat.messages[chat.messages.length - 1]?.id} /></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { const t = text.trim(); setText(''); send(t) } }}
                placeholder={streaming ? 'Type to queue another question…' : 'Ask the AI about this project…'}
                className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: 'var(--text)' }} />
              {streaming ? (
                <button onClick={() => stopStream(chat.id)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--danger)', color: '#fff' }} aria-label="Stop">
                  <X size={12} />
                </button>
              ) : (
                <button onClick={() => { if (text.trim()) { const t = text.trim(); setText(''); send(t) } }} disabled={!text.trim()}
                  className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }} aria-label="Send">
                  <Play size={11} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!open && (
        <motion.button initial={{ scale: 0.9 }} animate={{ scale: 1 }}
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 px-3.5 py-2.5 rounded-full glass-chat"
          style={{ boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)' }}>
          <MessageSquareText size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-[12px] font-medium">AI assistant</span>
        </motion.button>
      )}
    </div>
  )
}
