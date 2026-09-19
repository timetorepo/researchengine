import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderGit2, Plus, Upload, Trash2, ChevronRight, ChevronDown, FileCode2, Save, Play, GitBranch,
  TerminalSquare, Loader2, AlertTriangle, Check, X, FolderPlus, RefreshCw, Code2, MonitorUp,
  Files, Search as SearchIcon, Bug, GitCommitHorizontal, PanelRightClose, PanelRightOpen, FilePlus2,
  FolderOpen, Circle, Wand2, Terminal as TerminalIcon, ExternalLink,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { DesignStudio } from './DesignStudio'
import { AgentPanel, chatIdFor } from './AgentPanel'
import { CodeEditor } from './CodeEditor'
import type { ProjectInfo, TreeNode, OpenFile } from './types'
import { designSession, previewUrlFor } from '@/lib/ide/bridge'
import { previewStatus, ensurePreviewServer } from '@/lib/ide/preview'
import { isStreamingChat } from '@/lib/chat/runChat'
import { SAMPLE_PROJECT } from '@/lib/ide/sample'
import { fmt, timeAgo } from '@/lib/utils'

/* ================================================================== */
/* Coding entry — project list ⇄ workbench ⇄ design studio            */
/* ================================================================== */
export function CodingView() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [design, setDesign] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const uploadRef = useRef<HTMLInputElement>(null)
  const ui = useUI()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ide/projects')
      setProjects((await res.json()).projects ?? [])
    } catch { setProjects([]) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  // Keep the tree in sync with reality (AI edits files, terminal commands, …).
  const loadTree = useCallback(async (project: string) => {
    try {
      const res = await fetch(`/api/ide/tree?project=${encodeURIComponent(project)}`)
      if (res.ok) setTree((await res.json()).tree ?? [])
    } catch { /* tree stays as-is */ }
  }, [])
  useEffect(() => {
    if (!open) return
    void loadTree(open)
    const h = () => void loadTree(open)
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [open, loadTree])

  const create = async () => {
    const name = newName.trim().replace(/\s+/g, ' ')
    if (!name) { setErr('Enter a project name.'); return }
    if (name.length > 128) { setErr('Project names can be up to 128 characters.'); return }
    if (/[/\\\u0000]/.test(name) || name === '.' || name === '..') { setErr('Project names cannot contain path separators.'); return }
    setErr('')
    const res = await fetch('/api/ide/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, files: { 'README.md': `# ${name}\n\nCreated with Research Engine Coding.\n`, 'main.py': 'print("hello")\n' } }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not create the project.'); return }
    setCreating(false); setNewName(''); setOpen(name); void refresh()
  }

  const createSample = async () => {
    const name = 'sample-landing'
    const res = await fetch('/api/ide/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, files: SAMPLE_PROJECT }),
    })
    if (!res.ok) { ui.toast('Could not create the sample', (await res.json()).error ?? '', 'danger'); return }
    setOpen(name); setDesign(true); void refresh()
    ui.toast('Sample ready', 'Open Design mode — the AI can audit and fix this page live.', 'success')
  }

  const importArchive = async (file: File) => {
    const name = file.name.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '').replace(/[^a-zA-Z0-9 _.-]/g, '') || 'imported'
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
    setConfirmDelete(null)
    await fetch(`/api/ide/projects/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (open === name) setOpen(null)
    ui.toast('Project deleted', name, 'info')
    void refresh()
  }

  if (open && design) {
    return <DesignStudio project={open} tree={tree} onExit={() => setDesign(false)} />
  }
  if (open) {
    return (
      <Workbench
        project={open}
        tree={tree}
        onTreeRefresh={() => loadTree(open)}
        onBack={() => { setOpen(null); setDesign(false); void refresh() }}
        onDesign={() => setDesign(true)}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1.5">
          <FolderGit2 size={22} style={{ color: 'var(--primary)' }} />
          <h1 className="text-[22px] font-semibold tracking-tight">Coding</h1>
        </div>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>
          A real workbench for local projects: edit code, run guarded commands, use git — and switch to
          Design mode so the AI can see the running app, test it, and fix it. Everything stays on this machine.
        </p>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <Plus size={14} /> New project
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}>
            <Upload size={14} /> Upload .zip / .tar.gz
          </button>
          <button onClick={() => void createSample()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
            <Wand2 size={14} /> Try a sample app
          </button>
          <input ref={uploadRef} type="file" accept=".zip,.tar.gz,.tgz,.tar" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importArchive(f); e.target.value = '' }} />
        </div>

        <AnimatePresence>
          {creating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
              <div className="surface p-4 flex items-center gap-2">
                <FolderPlus size={15} style={{ color: 'var(--primary)' }} />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && create()} maxLength={128}
                  placeholder="Name your project" aria-label="Project name"
                  className="flex-1 px-3 py-1.5 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
                <button onClick={create} className="px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create</button>
                <button onClick={() => setCreating(false)} className="p-1.5 rounded-[10px]" style={{ color: 'var(--text-3)' }}><X size={14} /></button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Any name up to 128 characters; path separators are not allowed</p>
                <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{newName.length}/128</p>
              </div>
              {err && <p className="text-[12px] mt-1.5" style={{ color: 'var(--danger)' }}>{err}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {projects === null ? (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-3)' }}><Loader2 size={14} className="animate-spin" /> Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="surface p-8 text-center">
            <Code2 size={22} className="mx-auto mb-2" style={{ color: 'var(--primary)' }} />
            <p className="text-[13.5px] mb-1">No projects yet.</p>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-3)' }}>Create one, upload an archive — or drop in the sample app to see Design mode work end to end.</p>
            <button onClick={() => void createSample()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
              <Wand2 size={13} /> Create the sample app
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div key={p.name} className="surface p-4 group relative card-hover">
                <button onClick={() => setOpen(p.name)} className="text-left w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderGit2 size={16} style={{ color: 'var(--primary)' }} />
                    <span className="font-medium text-[13.5px] truncate">{p.name}</span>
                    {p.git && <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>git</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.files} files · {fmt(p.size)} · {timeAgo(p.mtime)}</div>
                </button>
                <button onClick={() => setConfirmDelete(p.name)} aria-label={`Delete ${p.name}`}
                  className="absolute top-3 right-3 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--danger)' }}>
                  <Trash2 size={13} />
                </button>
                {confirmDelete === p.name && (
                  <div className="absolute inset-0 rounded-[inherit] flex flex-col items-center justify-center gap-2 p-3 text-center"
                    style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)', backdropFilter: 'blur(6px)' }}>
                    <span className="text-[12px]">Delete <strong>{p.name}</strong>?</span>
                    <div className="flex gap-2">
                      <button onClick={() => void del(p.name)} className="px-2.5 py-1 rounded-full text-[11.5px]" style={{ background: 'var(--danger)', color: '#fff' }}>Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-1 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>Keep</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Workbench                                                          */
/* ================================================================== */
type Activity = 'explorer' | 'search' | 'git' | 'design'
type PanelTab = 'terminal' | 'problems' | 'git' | 'preview'

function Workbench({ project, tree, onTreeRefresh, onBack, onDesign }: {
  project: string
  tree: TreeNode[]
  onTreeRefresh: () => void
  onBack: () => void
  onDesign: () => void
}) {
  const ui = useUI()
  const [activity, setActivity] = useState<Activity>('explorer')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [agentOpen, setAgentOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 1180)
  const [files, setFiles] = useState<OpenFile[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [gotoLine, setGotoLine] = useState(0)
  const [panel, setPanel] = useState<PanelTab>('terminal')
  const [panelOpen, setPanelOpen] = useState(true)
  const [newFile, setNewFile] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<{ path: string; line: number; text: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<{ running: boolean; port?: number; kind?: string; ready?: boolean; error?: string | null }>({ running: false })
  const [starting, setStarting] = useState(false)
  const [confirmClose, setConfirmClose] = useState<string | null>(null)

  const chatId = useMemo(() => chatIdFor(project), [project])
  const streaming = isStreamingChat(chatId)
  const current = files.find((f) => f.path === active) ?? null
  const dirty = !!current && current.content !== current.disk
  const anyDirty = files.some((f) => f.content !== f.disk)

  /* ---------------- files ---------------- */
  const openFile = useCallback(async (path: string, line = 0) => {
    setGotoLine(line)
    const existing = files.find((f) => f.path === path)
    if (existing) { setActive(path); return }
    const res = await fetch(`/api/ide/file?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`)
    if (!res.ok) { ui.toast('Cannot open', (await res.json()).error ?? 'File error', 'danger'); return }
    const j = await res.json()
    setFiles((f) => [...f, { path, content: j.content, disk: j.content }])
    setActive(path)
  }, [files, project, ui])

  const closeFile = (path: string) => {
    const f = files.find((x) => x.path === path)
    if (f && f.content !== f.disk) { setConfirmClose(path); return }
    doClose(path)
  }
  const doClose = (path: string) => {
    setConfirmClose(null)
    setFiles((list) => {
      const next = list.filter((x) => x.path !== path)
      if (active === path) setActive(next.length ? next[next.length - 1].path : null)
      return next
    })
  }

  const save = useCallback(async (path?: string) => {
    const target = files.find((f) => f.path === (path ?? active))
    if (!target || target.content === target.disk) return
    const res = await fetch('/api/ide/file', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, path: target.path, content: target.content }),
    })
    if (res.ok) {
      setFiles((list) => list.map((f) => (f.path === target.path ? { ...f, disk: f.content } : f)))
      ui.toast('Saved', target.path, 'success')
      window.dispatchEvent(new CustomEvent('re:ide-changed'))
    } else {
      ui.toast('Save failed', (await res.json()).error ?? 'Unknown error', 'danger')
    }
  }, [active, files, project, ui])

  const addFile = async () => {
    const p = newFile.trim()
    if (!p) return
    const res = await fetch('/api/ide/file', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, path: p, content: '' }),
    })
    if (!res.ok) { ui.toast('Could not create file', (await res.json()).error ?? '', 'danger'); return }
    setNewFile(''); onTreeRefresh(); void openFile(p)
  }

  const deleteFile = async (path: string) => {
    await fetch(`/api/ide/file?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    doClose(path); onTreeRefresh()
  }

  /* ---------------- search ---------------- */
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/ide/search?project=${encodeURIComponent(project)}&q=${encodeURIComponent(q.trim())}`)
      const j = await res.json()
      setResults((j.results ?? []).filter((r: any) => r.line > 0))
    } finally { setSearching(false) }
  }, [project])

  useEffect(() => {
    const t = setTimeout(() => { if (activity === 'search') void runSearch(searchQ) }, 300)
    return () => clearTimeout(t)
  }, [searchQ, activity, runSearch])

  /* ---------------- preview ---------------- */
  const refreshPreview = useCallback(async () => {
    setPreview(await previewStatus(project))
  }, [project])
  useEffect(() => {
    void refreshPreview()
    const iv = setInterval(() => { void refreshPreview() }, 5000)
    return () => clearInterval(iv)
  }, [refreshPreview])

  const startPreview = async () => {
    setStarting(true)
    try {
      const info = await ensurePreviewServer(project)
      setPreview(info)
      if (info.error) ui.toast('Preview failed', info.error, 'danger')
      else { setPanel('preview'); setPanelOpen(true); void refreshPreview() }
    } finally { setStarting(false) }
  }

  // The AI (or a design tool) can ask for the preview pane at any time: switch
  // the workbench into Design mode, which owns the iframe and the bridge.
  useEffect(() => {
    designSession.onOpenRequest = (proj, done) => {
      if (proj !== project) { done(); return }
      onDesign()
      done()
    }
    return () => { designSession.onOpenRequest = null }
  }, [project, onDesign])

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 's') { e.preventDefault(); void save() }
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); setSidebarOpen((v) => !v) }
      if (e.key.toLowerCase() === 'j') { e.preventDefault(); setPanelOpen((v) => !v) }
      if (e.key === '`') { e.preventDefault(); setPanel('terminal'); setPanelOpen(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [save])

  const breadcrumb = current?.path.split('/') ?? []
  const previewLive = preview.running && preview.ready

  return (
    <div className="ide-shell h-full flex flex-col min-h-0">
      {/* ---------- title bar ---------- */}
      <div className="shrink-0 h-11 flex items-center gap-2 px-3" style={{ borderBottom: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
        <button onClick={onBack} className="ide-btn" title="Back to projects">
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Projects
        </button>
        <span className="w-px h-4" style={{ background: 'var(--ide-border)' }} />
        <FolderGit2 size={13} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[12.5px] font-medium truncate max-w-[240px]">{project}</span>
        {dirty && <span className="ide-badge warn">unsaved</span>}
        <div className="flex-1" />

        {/* preview + hand-off to Design mode, mirroring the reference's segmented bar */}
        <button onClick={() => void startPreview()} disabled={starting} className="ide-btn outlined"
          title={previewLive ? `Preview running on port ${preview.port}` : 'Run the project and start the preview'}>
          {starting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run
        </button>
        {previewLive && preview.port && (
          <button onClick={() => window.open(previewUrlFor(preview.port!, designSession.token), '_blank')}
            className="ide-icon-btn" title="Open the preview in a new tab">
            <ExternalLink size={12} />
          </button>
        )}
        <div className="ide-seg" role="tablist" aria-label="Workspace mode">
          <button data-active="true" role="tab" aria-selected="true" title="Edit the code">Code</button>
          <button className="design" data-active="false" role="tab" onClick={onDesign} title="Let the AI see and fix the running app">
            <span className="inline-flex items-center gap-1"><MonitorUp size={11} /> Design</span>
          </button>
        </div>
        <button onClick={() => void save()} disabled={!dirty} className="ide-btn primary" title="Save the active file (⌘S)">
          <Save size={12} /> Save
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* ---------- activity bar ---------- */}
        <div className="w-11 shrink-0 flex flex-col items-center py-2 gap-1" style={{ borderRight: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
          <ActivityBtn active={activity === 'explorer'} onClick={() => { setActivity('explorer'); setSidebarOpen(true) }} icon={<Files size={17} />} label="Explorer" />
          <ActivityBtn active={activity === 'search'} onClick={() => { setActivity('search'); setSidebarOpen(true) }} icon={<SearchIcon size={17} />} label="Search" />
          <ActivityBtn active={activity === 'git'} onClick={() => { setActivity('git'); setSidebarOpen(true); setPanel('git'); setPanelOpen(true) }} icon={<GitBranch size={17} />} label="Source control" />
          <ActivityBtn active={false} onClick={() => { setPanel('terminal'); setPanelOpen(true) }} icon={<TerminalIcon size={17} />} label="Terminal" />
          <ActivityBtn active={false} onClick={() => { setPanel('problems'); setPanelOpen(true) }} icon={<Bug size={17} />} label="Problems" />
          <div className="flex-1" />
          <ActivityBtn active={activity === 'design'} onClick={onDesign} icon={<MonitorUp size={17} />} label="Design mode" />
          <ActivityBtn active={agentOpen} onClick={() => setAgentOpen((v) => !v)} icon={agentOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />} label="AI assistant" />
        </div>

        {/* ---------- side bar ---------- */}
        {sidebarOpen && (
          <div className="w-[250px] shrink-0 min-h-0 flex flex-col" style={{ borderRight: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
            {activity === 'explorer' && (
              <>
                <div className="shrink-0 flex items-center gap-1 px-3 py-2">
                  <span className="ide-section flex-1">Explorer</span>
                  <button title="New file" onClick={() => setNewFile('src/')} className="ide-icon-btn" style={{ width: 22, height: 22 }}><FilePlus2 size={12} /></button>
                  <button title="Refresh the file tree" onClick={onTreeRefresh} className="ide-icon-btn" style={{ width: 22, height: 22 }}><RefreshCw size={12} /></button>
                </div>
                <div className="px-2 pb-1.5">
                  <input value={newFile} onChange={(e) => setNewFile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void addFile()}
                    placeholder="new/file.tsx + Enter" aria-label="New file path"
                    className="ide-input" style={{ fontSize: 11 }} />
                </div>
                <div className="flex-1 overflow-y-auto pb-3">
                  <Tree nodes={tree} depth={0} sel={active} onOpen={(p) => void openFile(p)} onDelete={deleteFile} />
                  {!tree.length && <p className="px-3 text-[11px]" style={{ color: 'var(--ide-faint)' }}>Empty project — create a file above.</p>}
                </div>
              </>
            )}

            {activity === 'search' && (
              <>
                <div className="shrink-0 px-3 py-2">
                  <div className="ide-section mb-1.5">Search in project</div>
                  <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} autoFocus
                    placeholder="text or file name…" aria-label="Search project" className="ide-input" />
                </div>
                <div className="flex-1 overflow-y-auto px-1.5">
                  {searching && <div className="flex items-center gap-2 px-2 text-[11px]" style={{ color: 'var(--ide-faint)' }}><Loader2 size={11} className="animate-spin" /> searching…</div>}
                  {!searching && searchQ.trim().length > 1 && !results.length && <p className="px-2 text-[11px]" style={{ color: 'var(--ide-faint)' }}>No matches.</p>}
                  {results.map((r, i) => (
                    <button key={i} onClick={() => void openFile(r.path, r.line)}
                      className="w-full text-left px-2 py-1.5 rounded-[6px] mb-0.5 hover:bg-[var(--ide-hover)]">
                      <span className="block text-[10.5px] font-mono truncate" style={{ color: 'var(--ide-accent)' }}>{r.path}:{r.line}</span>
                      <span className="block text-[10.5px] truncate" style={{ color: 'var(--ide-dim)' }}>{r.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activity === 'git' && <GitSidebar project={project} />}
          </div>
        )}

        {/* ---------- editor column ---------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* tabs */}
          <div className="shrink-0 flex items-stretch overflow-x-auto" style={{ borderBottom: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
            {files.map((f) => (
              <div key={f.path} className="ide-tab group" data-active={f.path === active}>
                <button onClick={() => { setActive(f.path); setGotoLine(0) }} className="flex items-center gap-1.5">
                  <FileCode2 size={11} />
                  {f.path.split('/').pop()}
                  {f.content !== f.disk && <Circle size={6} fill="currentColor" className="name-dirty" />}
                </button>
                <button onClick={() => closeFile(f.path)} aria-label={`Close ${f.path}`}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100" style={{ color: 'var(--ide-faint)' }}>
                  <X size={11} />
                </button>
              </div>
            ))}
            {!files.length && <div className="flex items-center px-3 h-8 text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>No file open</div>}
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-1 px-2">
              {!!breadcrumb.length && (
                <span className="text-[10.5px] font-mono" style={{ color: 'var(--ide-faint)' }}>{breadcrumb.join(' › ')}</span>
              )}
            </div>
          </div>

          {/* editor */}
          {current ? (
            <CodeEditor
              path={current.path}
              value={current.content}
              gotoLine={gotoLine}
              onChange={(v) => setFiles((list) => list.map((f) => (f.path === current.path ? { ...f, content: v } : f)))}
              onSave={() => void save()}
            />
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: 'var(--ide-code-bg)' }}>
              <div className="text-center">
                <FileCode2 size={26} className="mx-auto mb-2" style={{ color: 'var(--ide-faint)' }} />
                <p className="text-[12.5px]" style={{ color: 'var(--ide-dim)' }}>Open a file from the explorer — or ask the AI to create one.</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--ide-faint)' }}>
                  Press <span className="ide-badge">⌘B</span> explorer · <span className="ide-badge">⌘J</span> panel · <span className="ide-badge">⌘S</span> save
                </p>
              </div>
            </div>
          )}

          {/* bottom panel */}
          <div className="ide-panel-strip shrink-0 flex flex-col" style={{ height: panelOpen ? 220 : undefined }}>
            <div className="flex items-center gap-1 px-2 py-1 shrink-0">
              <PanelTabBtn active={panel === 'terminal'} onClick={() => { setPanel('terminal'); setPanelOpen(true) }} icon={<TerminalSquare size={12} />} label="Terminal" />
              <PanelTabBtn active={panel === 'problems'} onClick={() => { setPanel('problems'); setPanelOpen(true) }} icon={<Bug size={12} />} label="Problems" />
              <PanelTabBtn active={panel === 'git'} onClick={() => { setPanel('git'); setPanelOpen(true) }} icon={<GitCommitHorizontal size={12} />} label="Git" />
              <PanelTabBtn active={panel === 'preview'} onClick={() => { setPanel('preview'); setPanelOpen(true) }} icon={<MonitorUp size={12} />} label="Preview" />
              <div className="flex-1" />
              <span className="text-[10px] hidden lg:block" style={{ color: 'var(--ide-faint)' }}>commands run inside the project folder · destructive commands are blocked · mutating ones need approval</span>
              <button onClick={() => setPanelOpen((v) => !v)} className="ide-icon-btn" style={{ width: 22, height: 22 }} aria-label="Toggle panel">
                <ChevronDown size={12} style={{ transform: panelOpen ? undefined : 'rotate(180deg)' }} />
              </button>
            </div>
            {panelOpen && (
              <div className="flex-1 min-h-0">
                {panel === 'terminal' && <TerminalPanel project={project} />}
                {panel === 'git' && <GitPanel project={project} />}
                {panel === 'problems' && <ProblemsPanel project={project} onDesign={onDesign} />}
                {panel === 'preview' && <PreviewLogPanel project={project} preview={preview} onStart={() => void startPreview()} starting={starting} onDesign={onDesign} />}
              </div>
            )}
          </div>
        </div>

        {/* ---------- AI dock ---------- */}
        <AnimatePresence initial={false}>
          {agentOpen && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 384, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="shrink-0 min-h-0 overflow-hidden" style={{ borderLeft: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
              <div className="w-[384px] h-full">
                <AgentPanel project={project} tree={tree} onClose={() => setAgentOpen(false)} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ---------- status bar ---------- */}
      <div className="shrink-0 h-[26px] flex items-center gap-3 px-3 text-[10.5px]" style={{ borderTop: '1px solid var(--ide-border)', background: 'var(--ide-panel)', color: 'var(--ide-faint)' }}>
        <button onClick={onBack} className="flex items-center gap-1 hover:text-[var(--ide-dim)]"><FolderOpen size={10} /> {project}</button>
        <span className="flex items-center gap-1"><GitBranch size={10} /> local</span>
        {current && <span className="font-mono" style={{ color: 'var(--ide-dim)' }}>{current.path}</span>}
        {dirty && <span className="flex items-center gap-1" style={{ color: 'var(--ide-warn)' }}><Circle size={6} fill="currentColor" /> unsaved</span>}
        {anyDirty && files.filter((f) => f.content !== f.disk).length > 1 && <span>{files.filter((f) => f.content !== f.disk).length} files unsaved</span>}
        <div className="flex-1" />
        {streaming && <span className="flex items-center gap-1" style={{ color: 'var(--ide-accent)' }}><span className="re-orb re-orb-sm" /> AI working</span>}
        <span className="flex items-center gap-1" style={{ color: previewLive ? 'var(--ide-accent)' : undefined }}>
          <Circle size={6} fill="currentColor" />
          {previewLive ? `preview :${preview.port}` : preview.running ? 'preview booting' : 'preview stopped'}
        </span>
        <span>{files.length} open</span>
      </div>

      {/* unsaved-changes guard */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-4 max-w-[380px] rounded-[12px]" style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border-strong)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: 'var(--ide-warn)' }} />
              <span className="text-[13px] font-medium">Discard unsaved changes?</span>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--ide-dim)' }}><span className="font-mono">{confirmClose}</span> has edits that are not saved.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { const p = confirmClose; doClose(p) }} className="ide-btn outlined" style={{ color: 'var(--ide-danger)' }}>Discard</button>
              <button onClick={() => { void save(confirmClose); doClose(confirmClose) }} className="ide-btn primary">Save</button>
              <button onClick={() => setConfirmClose(null)} className="ide-btn outlined">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* small building blocks                                              */
/* ================================================================== */
function ActivityBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="relative w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors"
      style={{ background: active ? 'var(--ide-active)' : 'transparent', color: active ? 'var(--ide-accent)' : 'var(--ide-faint)' }}>
      {icon}
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: 'var(--ide-accent)' }} />}
    </button>
  )
}

function PanelTabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[11.5px]"
      style={{ background: active ? 'var(--ide-active)' : 'transparent', color: active ? 'var(--ide-text)' : 'var(--ide-faint)' }}>
      {icon}{label}
    </button>
  )
}

function Tree({ nodes, depth, sel, onOpen, onDelete, onParent }: {
  nodes: TreeNode[]; depth: number; sel: string | null
  onOpen: (p: string) => void; onDelete?: (p: string) => void; onParent?: string
}) {
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({})
  useEffect(() => { if (depth === 0) setOpenDirs((d) => (Object.keys(d).length ? d : { src: true })) }, [depth])
  return (
    <div>
      {nodes.map((n) => {
        const dirOpen = openDirs[n.path] ?? depth === 0
        return (
          <div key={n.path}>
            <div className="group flex items-center" style={{ paddingLeft: 6 + depth * 11 }}>
              <button
                onClick={() => n.dir ? setOpenDirs((d) => ({ ...d, [n.path]: !dirOpen })) : onOpen(n.path)}
                className="flex-1 min-w-0 flex items-center gap-1 py-[3px] pr-1 text-left text-[11.5px] rounded-[5px] hover:bg-[var(--ide-hover)]"
                style={{ color: sel === n.path ? 'var(--ide-accent)' : 'var(--ide-dim)' }}>
                {n.dir ? (dirOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <FileCode2 size={11} style={{ opacity: 0.7 }} />}
                <span className="truncate">{n.name}</span>
              </button>
              {!n.dir && onDelete && (
                <button onClick={() => onDelete(n.path)} title={`Delete ${n.path}`}
                  className="p-1 rounded opacity-0 group-hover:opacity-100" style={{ color: 'var(--ide-faint)' }}>
                  <Trash2 size={10} />
                </button>
              )}
            </div>
            {n.dir && dirOpen && n.children && (
              <Tree nodes={n.children} depth={depth + 1} sel={sel} onOpen={onOpen} onDelete={onDelete} onParent={n.path} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/* Terminal                                                           */
/* ================================================================== */
function TerminalPanel({ project }: { project: string }) {
  const [lines, setLines] = useState<{ kind: 'cmd' | 'out' | 'err' | 'info'; text: string }[]>([
    { kind: 'info', text: 'Guarded terminal — commands run only inside this project, with secrets stripped from the environment.' },
  ])
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ command: string } | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth' }) }, [lines])

  const run = async (command: string, confirmed = false) => {
    setBusy(true)
    setLines((l) => [...l, { kind: 'cmd', text: `$ ${command}` }])
    setHistory((h) => (h[h.length - 1] === command ? h : [...h, command]))
    try {
      const res = await fetch('/api/ide/exec', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, command, confirmed }),
      })
      const j = await res.json()
      if (j.blocked) { setLines((l) => [...l, { kind: 'err', text: `BLOCKED: ${j.reason}` }]); return }
      if (j.requiresConfirm && !confirmed) { setConfirm({ command }); setLines((l) => [...l, { kind: 'info', text: 'This command needs your approval below.' }]); return }
      if (j.stdout) setLines((l) => [...l, { kind: 'out', text: String(j.stdout).slice(0, 20000) }])
      if (j.stderr) setLines((l) => [...l, { kind: 'err', text: String(j.stderr).slice(0, 8000) }])
      setLines((l) => [...l, { kind: 'info', text: `exit ${j.exit} · ${j.ms}ms${j.timedOut ? ' · TIMED OUT' : ''}` }])
      window.dispatchEvent(new CustomEvent('re:ide-changed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed" style={{ background: 'var(--ide-code-bg)' }}>
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap" style={{ color: l.kind === 'cmd' ? 'var(--ide-accent)' : l.kind === 'err' ? 'var(--ide-danger)' : l.kind === 'info' ? 'var(--ide-faint)' : 'var(--ide-text)' }}>{l.text}</div>
        ))}
        {confirm && (
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle size={13} style={{ color: 'var(--ide-warn)' }} />
            <span className="text-[11px]" style={{ color: 'var(--ide-dim)' }}>Approve “{confirm.command}”?</span>
            <button onClick={() => { const c = confirm.command; setConfirm(null); void run(c, true) }} className="ide-btn primary" style={{ height: 20 }}>
              <Check size={11} /> Run
            </button>
            <button onClick={() => setConfirm(null)} className="ide-btn outlined" style={{ height: 20 }}>
              <X size={11} /> Skip
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderTop: '1px solid var(--ide-border)' }}>
        <span className="font-mono text-[11.5px]" style={{ color: 'var(--ide-accent)' }}>$</span>
        <input value={cmd} onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && cmd.trim() && !busy) { const c = cmd.trim(); setCmd(''); setHistIdx(-1); void run(c) }
            if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); const i = Math.min(history.length - 1, histIdx + 1); setHistIdx(i); setCmd(history[history.length - 1 - i]) }
            if (e.key === 'ArrowDown' && histIdx >= 0) { e.preventDefault(); const i = histIdx - 1; setHistIdx(i); setCmd(i < 0 ? '' : history[history.length - 1 - i]) }
          }}
          disabled={busy}
          placeholder={busy ? 'running…' : 'npm test, git status, ls — Enter to run'}
          aria-label="Terminal command"
          className="flex-1 bg-transparent outline-none font-mono text-[11.5px]" style={{ color: 'var(--ide-text)' }} />
        {busy && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--ide-faint)' }} />}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Git                                                                */
/* ================================================================== */
function useGit(project: string) {
  const [status, setStatus] = useState('')
  const [log, setLog] = useState('')
  const [isRepo, setIsRepo] = useState(true)
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await fetch(`/api/ide/git?project=${encodeURIComponent(project)}&op=status`)
      const sj = await s.json()
      if (sj.norepo) { setIsRepo(false); return }
      setIsRepo(true)
      setStatus(sj.stdout ?? '')
      const l = await fetch(`/api/ide/git?project=${encodeURIComponent(project)}&op=log`)
      setLog((await l.json()).stdout ?? '')
    } catch { /* offline */ }
  }, [project])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const h = () => void refresh()
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [refresh])

  const git = useCallback(async (op: string, message?: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/ide/git', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, op, message, confirmed: true }),
      })
      const j = await res.json()
      setOut(j.stderr || j.stdout || j.error || '')
      await refresh()
      window.dispatchEvent(new CustomEvent('re:ide-changed'))
      return j
    } finally { setBusy(false) }
  }, [project, refresh])

  return { status, log, isRepo, out, busy, refresh, git, setOut }
}

function GitSidebar({ project }: { project: string }) {
  const { status, isRepo, refresh, git, busy } = useGit(project)
  const [msg, setMsg] = useState('')
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-1 px-3 py-2">
        <span className="ide-section flex-1">Source control</span>
        <button onClick={() => void refresh()} className="ide-icon-btn" style={{ width: 22, height: 22 }} title="Refresh git status"><RefreshCw size={12} /></button>
      </div>
      {!isRepo ? (
        <div className="px-3 flex flex-col gap-2">
          <p className="text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>Not a git repository yet.</p>
          <button onClick={() => void git('init')} className="ide-btn primary" style={{ justifyContent: 'center' }}>
            <GitBranch size={12} /> git init
          </button>
        </div>
      ) : (
        <>
          <div className="px-3 pb-2">
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} placeholder="Commit message…"
              className="w-full p-2 rounded-[6px] text-[11.5px] outline-none resize-none"
              style={{ background: '#0c1110', border: '1px solid var(--ide-border)', color: 'var(--ide-text)' }} />
            <button onClick={async () => { if (!msg.trim()) return; await git('commit', msg.trim()); setMsg('') }}
              disabled={busy || !msg.trim()}
              className="ide-btn primary mt-1.5" style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Commit all
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 font-mono text-[10.5px] leading-relaxed">
            <div className="ide-section mb-1">changes</div>
            <div className="whitespace-pre-wrap" style={{ color: 'var(--ide-dim)' }}>{status || 'working tree clean'}</div>
          </div>
        </>
      )}
    </div>
  )
}

function GitPanel({ project }: { project: string }) {
  const { status, log, isRepo, out, busy, refresh, git } = useGit(project)
  const [msg, setMsg] = useState('')
  if (!isRepo) {
    return (
      <div className="h-full flex items-center justify-center gap-3">
        <span className="text-[12px]" style={{ color: 'var(--ide-faint)' }}>Not a git repository yet.</span>
        <button onClick={() => void git('init')} className="ide-btn primary">
          <GitBranch size={13} /> git init
        </button>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 grid grid-cols-2">
      <div className="overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed" style={{ borderRight: '1px solid var(--ide-border)' }}>
        <div className="ide-section mb-1">status</div>
        <div className="whitespace-pre-wrap" style={{ color: 'var(--ide-dim)' }}>{status || 'working tree clean'}</div>
        <div className="ide-section mt-3 mb-1">log</div>
        <div className="whitespace-pre-wrap" style={{ color: 'var(--ide-dim)' }}>{log || 'no commits yet'}</div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Commit message…"
          className="w-full p-2 rounded-[6px] text-[12px] outline-none resize-none"
          style={{ background: '#0c1110', border: '1px solid var(--ide-border)', color: 'var(--ide-text)' }} />
        <button onClick={async () => { if (!msg.trim()) return; await git('commit', msg.trim()); setMsg('') }} disabled={busy || !msg.trim()}
          className="ide-btn primary" style={{ justifyContent: 'center' }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Stage all &amp; commit
        </button>
        {out && <div className="text-[10.5px] font-mono" style={{ color: 'var(--ide-faint)' }}>{out.slice(0, 400)}</div>}
        <button onClick={() => void refresh()} className="ide-btn self-start">
          <RefreshCw size={11} /> refresh
        </button>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Problems + preview log                                             */
/* ================================================================== */
function ProblemsPanel({ project, onDesign }: { project: string; onDesign: () => void }) {
  const [findings, setFindings] = useState<{ kind: string; msg: string; sel: string }[] | null>(null)
  const [consoleErrs, setConsoleErrs] = useState<{ level: string; text: string }[]>([])
  const [loading, setLoading] = useState(false)

  const scan = useCallback(async () => {
    setLoading(true)
    try {
      await ensurePreviewServer(project)
      const [audit, cons] = await Promise.all([
        designSession.call('audit', {}, 12_000),
        designSession.call('console', {}, 8000),
      ])
      setFindings(audit.findings ?? [])
      setConsoleErrs((cons.entries ?? []).filter((e: any) => e.level === 'error' || e.level === 'warn'))
    } catch (e: any) {
      setFindings([{ kind: 'preview', msg: `Preview not reachable: ${e?.message ?? e}`, sel: '' }])
    } finally { setLoading(false) }
  }, [project])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
        <span className="text-[11px] flex-1" style={{ color: 'var(--ide-faint)' }}>
          Scan the running app for layout, contrast, accessibility and console problems.
        </span>
        <button onClick={() => void scan()} disabled={loading} className="ide-btn outlined">
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Bug size={11} />} scan
        </button>
        <button onClick={onDesign} className="ide-btn outlined" style={{ color: 'var(--ide-accent)' }}>
          <MonitorUp size={11} /> open design mode
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {findings === null && <p className="text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>Press scan to look at the running app.</p>}
        {findings?.length === 0 && <p className="text-[11.5px]" style={{ color: 'var(--ide-accent)' }}>No problems found.</p>}
        {findings?.map((f, i) => (
          <div key={i} className="flex items-start gap-2 py-1 text-[11.5px]">
            <AlertTriangle size={12} className="mt-[2px] shrink-0" style={{ color: f.kind === 'console' || f.kind === 'network' ? 'var(--ide-danger)' : 'var(--ide-warn)' }} />
            <div className="min-w-0">
              <div style={{ color: 'var(--ide-dim)' }}>{f.msg}</div>
              {f.sel && <div className="font-mono text-[10px]" style={{ color: 'var(--ide-faint)' }}>{f.sel}</div>}
            </div>
          </div>
        ))}
        {!!consoleErrs.length && (
          <>
            <div className="ide-section mt-2 mb-1">console</div>
            {consoleErrs.map((c, i) => (
              <div key={i} className="font-mono text-[10.5px] py-0.5 break-words" style={{ color: c.level === 'error' ? 'var(--ide-danger)' : 'var(--ide-warn)' }}>{c.text}</div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function PreviewLogPanel({ project, preview, onStart, starting, onDesign }: {
  project: string
  preview: { running: boolean; port?: number; kind?: string; ready?: boolean }
  onStart: () => void
  starting: boolean
  onDesign: () => void
}) {
  const [logs, setLogs] = useState<string[]>([])
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/ide/preview/logs?project=${encodeURIComponent(project)}`)
        setLogs((await res.json()).logs ?? [])
      } catch { /* ignore */ }
    }
    void load()
    const iv = setInterval(load, 2500)
    return () => clearInterval(iv)
  }, [project])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 text-[11px]" style={{ color: 'var(--ide-faint)' }}>
        <span className="flex-1">
          {preview.running
            ? `running (${preview.kind}) on port ${preview.port ?? '—'}${preview.ready ? '' : ' · booting'}`
            : 'no preview running for this project'}
        </span>
        <button onClick={onStart} disabled={starting || preview.running} className="ide-btn outlined">
          {starting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} start
        </button>
        <button onClick={onDesign} className="ide-btn outlined" style={{ color: 'var(--ide-accent)' }}>
          <MonitorUp size={11} /> design mode
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2 font-mono text-[10.5px] leading-relaxed" style={{ background: 'var(--ide-code-bg)', color: 'var(--ide-dim)' }}>
        {logs.slice(-80).map((l, i) => <div key={i} className="whitespace-pre-wrap break-words">{l}</div>)}
        {!logs.length && <div>no output yet — the dev server's stdout and stderr land here</div>}
      </div>
    </div>
  )
}
