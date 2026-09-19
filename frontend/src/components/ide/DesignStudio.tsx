import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import {
  MonitorUp, Play, RefreshCw, Square, ExternalLink, Crosshair, Camera, Smartphone, Tablet, Monitor,
  Maximize2, ChevronRight, Search, AlertTriangle, CheckCircle2, XCircle, Loader2, Terminal, Bug,
  Image as ImageIcon, Send, Sparkles, Download, X, Layers, ListChecks, Activity,
} from 'lucide-react'
import { AgentPanel } from './AgentPanel'
import { AIFloat, FocusButton } from './AIFloat'
import { TestPanel } from './TestPanel'
import {
  designSession, captureStore, attachmentTray, previewUrlFor, type Snapshot, type ControlInfo, type Finding, type Capture,
} from '@/lib/ide/bridge'
import { DEVICE_PRESETS, ensurePreviewServer, previewStatus, stopPreview, type PreviewState, type DeviceId } from '@/lib/ide/preview'
import type { TreeNode } from './types'

type Tab = 'assistant' | 'inspect' | 'tests' | 'console' | 'captures'

const KIND_TONE: Record<string, string> = {
  a11y: 'var(--warning)', layout: 'var(--primary)', console: 'var(--danger)',
  network: 'var(--danger)', touch: 'var(--warning)', ux: 'var(--text-3)', assets: 'var(--danger)',
}

function useCaptures(): Capture[] {
  return useSyncExternalStore(captureStore.subscribe, captureStore.get, captureStore.get)
}

export function DesignStudio({ project, tree, onExit }: { project: string; tree: TreeNode[]; onExit: () => void }) {
  const [state, setState] = useState<PreviewState | null>(null)
  const [starting, setStarting] = useState(false)
  const [device, setDevice] = useState<DeviceId>('fill')
  const [size, setSize] = useState({ w: 1440, h: 900 })
  const [zoom, setZoom] = useState(1)
  const [tab, setTab] = useState<Tab>('assistant')
  const [picking, setPicking] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [controls, setControls] = useState<ControlInfo[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [inspectFilter, setInspectFilter] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [banner, setBanner] = useState('')
  const [pathDraft, setPathDraft] = useState('')
  // Prefer embedding the preview on its own port; if the host refuses to embed
  // that origin (some sandboxes do), fall back to serving it through the app's
  // own origin so the pane still works.
  const [originFallback, setOriginFallback] = useState(false)
  // Full-screen mode: the canvas takes the window and the chat collapses into
  // the floating pill (still draggable, still the same conversation).
  const [focus, setFocus] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const captures = useCaptures()

  const port = state?.port ?? 0
  const frameSrc = useMemo(() => {
    if (!port) return ''
    if (originFallback) return `/api/ide/preview/site?project=${encodeURIComponent(project)}&path=/#re-token=${designSession.token}`
    return previewUrlFor(port, designSession.token)
  }, [port, originFallback, project])

  /* ---------------- preview lifecycle ---------------- */
  const refreshStatus = useCallback(async () => {
    const s = await previewStatus(project)
    setState(s)
    return s
  }, [project])

  const start = useCallback(async (restart = false) => {
    setStarting(true); setBanner('')
    try {
      const info = await ensurePreviewServer(project, restart)
      setState(info)
      if (info.error) setBanner(info.error)
    } catch (e: any) {
      setBanner(String(e?.message ?? e))
    } finally { setStarting(false) }
  }, [project])

  useEffect(() => { void start(false) }, [start])

  useEffect(() => {
    const iv = setInterval(() => { void refreshStatus() }, 4000)
    const onChanged = () => { void refreshStatus() }
    window.addEventListener('re:ide-changed', onChanged)
    return () => { clearInterval(iv); window.removeEventListener('re:ide-changed', onChanged) }
  }, [refreshStatus])

  // Attach the bridge whenever the pane (re)mounts. detach() on unmount so the
  // chat tools stop talking to a preview that is no longer on screen.
  useEffect(() => {
    designSession.attach(frameRef.current)
    return () => designSession.attach(null)
  }, [frameSrc])

  useEffect(() => {
    designSession.onResize = (w, h) => { setDevice('fill'); setSize({ w, h }) }
    return () => { designSession.onResize = null }
  }, [])

  // Connection watchdog: if the bridge has not announced itself shortly after
  // the pane loads, try the same-origin route once before telling the user.
  useEffect(() => {
    if (!frameSrc || !port) return
    const started = Date.now()
    const iv = setInterval(() => {
      if (designSession.status === 'ready') { clearInterval(iv); return }
      const waited = Date.now() - started
      if (waited > 9000) {
        clearInterval(iv)
        if (!originFallback && (state?.kind === 'static')) {
          setOriginFallback(true)
          setBanner('Serving the preview through the app origin — this host would not embed a second port.')
        } else {
          setBanner('The preview has not connected. If the pane is blank, open it in a new tab, or restart the preview.')
        }
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [frameSrc, port, originFallback, state?.kind])

  /* ---------------- reads from the screen ---------------- */
  const readScreen = useCallback(async () => {
    try {
      const [snap, map] = await Promise.all([
        designSession.call('snapshot', { maxNodes: 120 }, 15_000),
        designSession.call('controls', {}, 10_000),
      ])
      setSnapshot(snap)
      setControls(map.controls ?? [])
      setBanner('')
    } catch (e: any) {
      setBanner(String(e?.message ?? e))
    }
  }, [])

  useEffect(() => {
    const off = designSession.on((e) => {
      if (e.type === 'ready') { void readScreen(); setPicking(false) }
      if (e.type === 'idle' && e.payload?.findings) {
        setSnapshot((s) => (s ? { ...s, findings: e.payload.findings } : s))
      }
      if (e.type === 'picked') {
        setPicking(false)
        setSelected(e.payload)
        setTab('inspect')
      }
      if (e.type === 'unloading') { setSnapshot(null); setControls([]) }
    })
    return off
  }, [readScreen])

  // A static preview has no file watcher — reload the frame when files change.
  useEffect(() => {
    const h = () => { if (state?.kind === 'static' && frameRef.current) frameRef.current.src = `${frameSrc}${frameSrc.includes('#') ? '' : '#'}r=${Date.now()}` }
    window.addEventListener('re:ide-changed', h)
    return () => window.removeEventListener('re:ide-changed', h)
  }, [state?.kind, frameSrc])

  /* ---------------- actions ---------------- */
  const call = async (name: string, fn: () => Promise<any>) => {
    setBusy(name)
    try { return await fn() } catch (e: any) { setBanner(String(e?.message ?? e)); return null } finally { setBusy(null) }
  }

  const capture = (full: boolean) => call('capture', async () => {
    const shot = await designSession.call('screenshot', { full, format: 'jpeg', quality: 0.85 }, 25_000)
    if (!shot?.ok) { setBanner(shot?.error ?? 'Capture failed'); return null }
    const cap: Capture = { id: `c${Date.now()}`, dataUrl: shot.dataUrl, w: shot.width, h: shot.height, at: Date.now(), url: shot.url, label: full ? 'Full page' : 'Viewport' }
    captureStore.add(cap)
    setTab('captures')
    return cap
  })

  const sendScreenToAI = () => call('shot', async () => {
    const shot = await designSession.call('screenshot', { full: false, format: 'jpeg', quality: 0.85 }, 25_000)
    if (!shot?.ok) return
    captureStore.add({ id: `c${Date.now()}`, dataUrl: shot.dataUrl, w: shot.width, h: shot.height, at: Date.now(), url: shot.url, label: 'Sent to AI' })
    attachmentTray.add({ type: 'image', name: `screen-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.jpg`, dataUrl: shot.dataUrl })
    setTab('assistant')
    setBanner('Screenshot attached — send your next message and the AI will see it.')
  })

  const togglePick = () => call('pick', async () => {
    const out = await designSession.call('pick', { on: !picking }, 8000)
    setPicking(!!out?.picking)
  })

  const highlight = (sel: string) => call('hl', async () => {
    const out = await designSession.call('highlight', { target: sel, keep: true }, 8000)
    if (out?.rect) setSnapshot((s) => s) // rect flash is drawn in the page
  })

  const navigate = () => call('nav', async () => {
    const url = pathDraft.trim()
    if (!url) return
    await designSession.call('navigate', { url }, 8000).catch(() => null)
    await designSession.waitForReady(15_000).catch(() => null)
    setPathDraft('')
    await readScreen()
  })

  const findings: Finding[] = snapshot?.findings ?? []
  const consoleEntries = snapshot?.console ?? []
  const errorCount = consoleEntries.filter((c) => c.level === 'error').length + (snapshot?.network?.length ?? 0)

  const filteredElements = useMemo(() => {
    const list: any[] = []
    if (selected) list.push(selected)
    const q = inspectFilter.trim().toLowerCase()
    for (const el of snapshot?.elements ?? []) {
      if (selected && el.uid === selected.uid) continue
      if (q && !(`${el.sel} ${el.name} ${el.text ?? ''} ${el.role}`.toLowerCase().includes(q))) continue
      list.push(el)
    }
    return list
  }, [snapshot, selected, inspectFilter])

  const deviceIcon = (id: string) => id === 'phone' ? <Smartphone size={12} /> : id === 'tablet' ? <Tablet size={12} /> : id === 'fill' ? <Maximize2 size={12} /> : <Monitor size={12} />

  /* ---------------- render ---------------- */
  // ⌘⇧F / Ctrl⇧F toggles full screen; the right rail folds into the float pill.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFocus((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ide-shell h-full flex flex-col min-h-0">
      {/* ---- header ---- */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-11" style={{ borderBottom: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
        <button onClick={onExit} className="ide-btn" title="Back to the code">
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Code
        </button>
        <span className="w-px h-4" style={{ background: 'var(--ide-border)' }} />
        <MonitorUp size={13} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[12.5px] font-medium truncate max-w-[200px]">Design · {project}</span>

        <span className={state?.ready ? 'ide-badge accent' : state?.running ? 'ide-badge warn' : 'ide-badge'}>
          {starting || (state?.running && !state.ready)
            ? <Loader2 size={10} className="animate-spin" />
            : <span style={{ width: 6, height: 6, borderRadius: 99, background: 'currentColor' }} />}
          {starting ? 'starting…' : state?.ready ? `live · :${state.port}` : state?.running ? 'booting' : 'offline'}
        </span>
        {state?.kind && <span className="ide-badge">{state.kind}</span>}

        <div className="flex-1" />

        {/* the reference's segmented [Preview | Code] + Design switch */}
        <div className="ide-seg" role="tablist" aria-label="Workspace mode">
          <button data-active="true" role="tab" aria-selected="true">Preview</button>
          <button data-active="false" role="tab" onClick={onExit}>Code</button>
          <button className="design" data-active="true" role="tab" aria-selected="true">
            <span className="inline-flex items-center gap-1"><MonitorUp size={11} /> Design</span>
          </button>
        </div>

        <button onClick={() => void call('reload', async () => { await designSession.call('reload', {}, 4000).catch(() => null) })}
          disabled={!state?.ready} title="Reload the preview" className="ide-icon-btn">
          <RefreshCw size={13} />
        </button>
        <button onClick={() => void start(true)} disabled={starting} title="Restart the dev server (picks up code changes)" className="ide-icon-btn">
          {starting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </button>
        {state?.running && (
          <button onClick={() => void call('stop', async () => { await stopPreview(project); await refreshStatus() })}
            title="Stop the preview" className="ide-icon-btn">
            <Square size={12} />
          </button>
        )}
        <FocusButton focus={focus} onToggle={() => setFocus((v) => !v)} />
        <button onClick={() => port && window.open(previewUrlFor(port, designSession.token), '_blank')} disabled={!port}
          title="Open the preview in a new tab" className="ide-btn primary">
          <ExternalLink size={11} /> Open
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* ---- preview column ---- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* address + device bar */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 flex-wrap" style={{ borderBottom: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
            <div className="flex items-center gap-1.5 flex-1 min-w-[180px] px-2 py-1 rounded-[6px]"
              style={{ background: 'color-mix(in srgb, var(--bg) 65%, var(--surface))', border: '1px solid var(--ide-border)' }}>
              <span className="text-[10.5px] shrink-0" style={{ color: designSession.lastUrl ? 'var(--ide-accent)' : 'var(--ide-faint)' }}>
                {designSession.lastUrl ? '●' : '○'}
              </span>
              <input value={pathDraft} onChange={(e) => setPathDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void navigate() }}
                placeholder={designSession.lastUrl || 'path — e.g. /settings'}
                aria-label="Preview path"
                className="flex-1 min-w-0 bg-transparent outline-none text-[11.5px] font-mono" style={{ color: 'var(--ide-text)' }} />
              {pathDraft && <button onClick={() => void navigate()} className="text-[10.5px] px-1.5 rounded" style={{ background: 'var(--ide-accent-soft)', color: 'var(--ide-accent)' }}>Go</button>}
            </div>

            {/* device presets */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-[8px]" style={{ background: 'color-mix(in srgb, var(--bg) 65%, var(--surface))', border: '1px solid var(--ide-border)' }}>
              {DEVICE_PRESETS.map((d) => (
                <button key={d.id} onClick={() => { setDevice(d.id); if (d.w) setSize({ w: d.w, h: d.h }) }}
                  title={`${d.label}${d.w ? ` · ${d.w}×${d.h}` : ''}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10.5px]"
                  style={{ background: device === d.id ? 'var(--ide-active)' : 'transparent', color: device === d.id ? 'var(--ide-accent)' : 'var(--ide-faint)' }}>
                  {deviceIcon(d.id)}<span className="hidden xl:inline">{d.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
              {(['fill', 'desktop', 'phone'] as DeviceId[]).includes(device) && device === 'fill' ? null : (
                <>
                  <input type="number" value={size.w} onChange={(e) => setSize((s) => ({ ...s, w: Number(e.target.value) || 0 }))}
                    aria-label="Viewport width" className="ide-input tabular-nums" style={{ width: 58, padding: '4px 6px' }} />
                  <span>×</span>
                  <input type="number" value={size.h} onChange={(e) => setSize((s) => ({ ...s, h: Number(e.target.value) || 0 }))}
                    className="w-14 px-1.5 py-1 rounded-[6px] tabular-nums outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
                </>
              )}
              <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom"
                className="ide-input" style={{ width: 70, padding: '4px 6px' }}>
                {[0.5, 0.75, 1, 1.25].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
              </select>
            </div>

            <button onClick={() => void togglePick()} title="Pick an element from the screen"
              className={picking ? 'ide-btn primary' : 'ide-btn outlined'}>
              <Crosshair size={11} /> Pick
            </button>
            <button onClick={() => void capture(false)} disabled={!state?.ready} title="Capture the visible screen" className="ide-btn outlined">
              {busy === 'capture' ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />} Shot
            </button>
            <button onClick={() => void sendScreenToAI()} disabled={!state?.ready} title="Capture and attach the screen to your next message"
              className="ide-btn primary">
              <Send size={11} /> Send to AI
            </button>
          </div>

          {/* the screen */}
          <div className="flex-1 min-h-0 overflow-auto p-4 grid place-items-center" style={{ background: 'var(--ide-bg)' }}>
            {!port ? (
              <div className="max-w-[420px] text-center flex flex-col items-center gap-3 py-10">
                <MonitorUp size={30} style={{ color: 'var(--ide-faint)' }} />
                <div className="text-[13px]" style={{ color: 'var(--ide-dim)' }}>{starting ? 'Starting the project…' : 'No preview running yet.'}</div>
                <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
                  The IDE runs your project's own dev server, injects a design bridge into it, and shows it here.
                  Everything the AI does — reading the layout, clicking, asserting, screenshotting — happens on this screen.
                </div>
                <button onClick={() => void start(false)} disabled={starting} className="ide-btn primary">
                  {starting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start preview
                </button>
              </div>
            ) : (
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 120ms ease' }}>
                <div className="rounded-[12px] overflow-hidden"
                  style={{
                    width: device === 'fill' ? '100%' : size.w,
                    height: device === 'fill' ? '100%' : size.h,
                    minWidth: device === 'fill' ? 480 : undefined,
                    maxWidth: '100%',
                    border: '1px solid var(--ide-border-strong)',
                    boxShadow: 'var(--ide-shadow)',
                    background: '#fff',
                  }}>
                  <iframe
                    ref={frameRef}
                    key={frameSrc}
                    src={frameSrc}
                    title={`Preview of ${project}`}
                    onLoad={() => { designSession.attach(frameRef.current); setBanner('') }}
                    style={{
                      width: device === 'fill' ? '100%' : size.w,
                      height: device === 'fill' ? '100%' : size.h,
                      border: 0,
                      background: '#fff',
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                  />
                </div>
              </div>
            )}
          </div>

          {/* findings strip */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 text-[11px]" style={{ borderTop: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
            <Activity size={12} style={{ color: findings.length ? 'var(--ide-warn)' : 'var(--ide-accent)' }} />
            <span style={{ color: 'var(--ide-dim)' }}>
              {snapshot ? `${snapshot.elements.length} elements · ${snapshot.counts.interactive} controls · ${findings.length} finding(s)` : 'waiting for the page…'}
            </span>
            {errorCount > 0 && <span style={{ color: 'var(--ide-danger)' }}>· {errorCount} console/network error(s)</span>}
            <div className="flex-1" />
            <span className="tabular-nums" style={{ color: 'var(--ide-faint)' }}>{snapshot ? `${snapshot.viewport.w}×${snapshot.viewport.h}` : ''}</span>
            <button onClick={() => void readScreen()} className="ide-btn" style={{ color: 'var(--ide-accent)' }}>
              {busy === 'read' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} re-read screen
            </button>
          </div>
        </div>

        {/* ---- right rail (the AI docks out to a pill in full screen) ---- */}
        {!focus && (
        <aside className="w-[430px] shrink-0 min-h-0 flex flex-col" style={{ borderLeft: '1px solid var(--ide-border)', background: 'var(--ide-panel)' }}>
          <div className="shrink-0 flex items-center gap-0.5 px-2 py-1.5" style={{ borderBottom: '1px solid var(--ide-border)' }}>
            <RailTab active={tab === 'assistant'} onClick={() => setTab('assistant')} icon={<Sparkles size={12} />} label="Assistant" />
            <RailTab active={tab === 'inspect'} onClick={() => setTab('inspect')} icon={<Search size={12} />} label="Inspect" badge={snapshot?.elements.length} />
            <RailTab active={tab === 'tests'} onClick={() => setTab('tests')} icon={<ListChecks size={12} />} label="Tests" badge={controls.length} />
            <RailTab active={tab === 'console'} onClick={() => setTab('console')} icon={<Terminal size={12} />} label="Console" badge={errorCount || undefined} tone={errorCount ? 'var(--danger)' : undefined} />
            <RailTab active={tab === 'captures'} onClick={() => setTab('captures')} icon={<ImageIcon size={12} />} label="Shots" badge={captures.length || undefined} />
          </div>

          {banner && (
            <div className="shrink-0 flex items-start gap-2 mx-3 mt-2 p-2 rounded-[8px] text-[11px]"
              style={{ background: 'color-mix(in srgb, var(--ide-warn) 12%, transparent)', color: 'var(--ide-dim)' }}>
              <AlertTriangle size={12} className="mt-[1px] shrink-0" style={{ color: 'var(--ide-warn)' }} />
              <span className="flex-1">{banner}</span>
              <button onClick={() => setBanner('')}><X size={11} /></button>
            </div>
          )}

          <div className="flex-1 min-h-0">
            {tab === 'assistant' && (
              <AgentPanel project={project} tree={tree} design />
            )}


            {tab === 'inspect' && (
              <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
                <input value={inspectFilter} onChange={(e) => setInspectFilter(e.target.value)}
                  placeholder="Filter elements by selector, text or role…"
                  className="ide-input" />
                {selected && (
                  <ElementDetail data={selected} onClose={() => setSelected(null)} onHighlight={highlight} />
                )}
                <div className="flex flex-col gap-1">
                  {filteredElements.slice(0, 80).map((el: any) => (
                    <button key={el.uid} onClick={() => { setSelected(el); void highlight(el.sel) }}
                      className="text-left px-2 py-1.5 rounded-[8px] flex items-start gap-2"
                      style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border)' }}>
                      <span className="text-[9.5px] px-1 py-0.5 rounded shrink-0" style={{ background: 'var(--ide-accent-soft)', color: 'var(--ide-accent)' }}>{el.role}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] truncate" style={{ color: 'var(--ide-text)' }}>{el.name || el.text || el.sel}</span>
                        <span className="block text-[10px] font-mono truncate" style={{ color: 'var(--ide-faint)' }}>{el.sel}</span>
                      </span>
                      {!!el.flags?.length && <AlertTriangle size={11} className="mt-[3px] shrink-0" style={{ color: 'var(--ide-warn)' }} />}
                    </button>
                  ))}
                  {!filteredElements.length && <p className="text-[11.5px] px-1" style={{ color: 'var(--ide-faint)' }}>Nothing to show yet — re-read the screen once the preview is live.</p>}
                </div>
              </div>
            )}

            {tab === 'tests' && (
              <TestPanel
                controls={controls}
                loading={busy === 'read'}
                onRefresh={() => void readScreen()}
                onHighlight={highlight}
                project={project}
              />
            )}

            {tab === 'console' && (
              <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="ide-section flex-1">Findings · {findings.length}</span>
                  <button onClick={() => void call('audit', async () => { await designSession.call('console', { clear: true }); await readScreen() })}
                    className="ide-btn outlined">
                    clear console
                  </button>
                </div>
                {(['a11y', 'layout', 'console', 'network', 'touch', 'ux', 'assets'] as const).map((kind) => {
                  const list = findings.filter((f) => f.kind === kind)
                  if (!list.length) return null
                  return (
                    <div key={kind} className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: KIND_TONE[kind] }}>{kind} · {list.length}</div>
                      {list.map((f, i) => (
                        <button key={i} onClick={() => f.sel && void highlight(f.sel)}
                          className="text-left px-2 py-1.5 rounded-[8px] text-[11px] leading-snug"
                          style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border)', color: 'var(--ide-dim)' }}>
                          {f.msg}
                          {f.sel && <span className="block font-mono text-[10px] mt-0.5 truncate" style={{ color: 'var(--ide-faint)' }}>{f.sel}</span>}
                        </button>
                      ))}
                    </div>
                  )
                })}
                <div className="ide-section mt-2">Console · {consoleEntries.length}</div>
                {consoleEntries.map((c, i) => (
                  <div key={i} className="px-2 py-1.5 rounded-[8px] font-mono text-[10.5px] leading-snug break-words"
                    style={{
                      background: 'var(--ide-code-bg)',
                      border: '1px solid var(--ide-border)',
                      color: c.level === 'error' ? 'var(--ide-danger)' : c.level === 'warn' ? 'var(--ide-warn)' : 'var(--ide-dim)',
                    }}>
                    {c.text}{c.repeat && c.repeat > 1 ? ` (×${c.repeat})` : ''}
                  </div>
                ))}
                {!consoleEntries.length && <p className="text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>Console is quiet.</p>}
              </div>
            )}

            {tab === 'captures' && (
              <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="ide-section flex-1">Screenshots · {captures.length}</span>
                  <button onClick={() => void capture(false)} disabled={!state?.ready} className="ide-btn primary" style={{ height: 22 }}>viewport</button>
                  <button onClick={() => void capture(true)} disabled={!state?.ready} className="ide-btn outlined" style={{ height: 22 }}>full page</button>
                </div>
                {captures.map((c) => (
                  <div key={c.id} className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--ide-border)', background: 'var(--ide-elevated)' }}>
                    <img src={c.dataUrl} alt={c.label} className="w-full block" />
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-[10.5px] flex-1 truncate" style={{ color: 'var(--ide-faint)' }}>{c.label} · {c.w}×{c.h}</span>
                      <a href={c.dataUrl} download={`${project}-${c.id}.jpg`} className="ide-icon-btn" style={{ width: 22, height: 22 }} title="Download"><Download size={11} /></a>
                      <button onClick={() => { attachmentTray.add({ type: 'image', name: `${project}-${c.id}.jpg`, dataUrl: c.dataUrl }); setTab('assistant'); setBanner('Screenshot attached — send your next message.') }}
                        className="ide-btn" style={{ color: 'var(--ide-accent)' }}>
                        attach
                      </button>
                    </div>
                  </div>
                ))}
                {!captures.length && (
                  <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
                    No screenshots yet. Press <strong>Shot</strong>, or ask the AI — its <span className="font-mono">design_screenshot</span> tool drops pictures here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* preview log drawer */}
          <div className="shrink-0" style={{ borderTop: '1px solid var(--ide-border)' }}>
            <button onClick={() => setLogOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
              <Bug size={11} /> preview log
              <span className="flex-1" />
              <ChevronRight size={11} style={{ transform: logOpen ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }} />
            </button>
            {logOpen && (
              <div className="max-h-40 overflow-y-auto px-3 pb-2 font-mono text-[10px] leading-relaxed" style={{ background: 'var(--ide-code-bg)', color: 'var(--ide-dim)' }}>
                {(state?.logs ?? []).slice(-60).map((l, i) => <div key={i} className="whitespace-pre-wrap break-words">{l}</div>)}
                {!state?.logs?.length && <div>no output yet</div>}
              </div>
            )}
          </div>
        </aside>
        )}

        {focus && <AIFloat project={project} tree={tree} design />}
      </div>
    </div>
  )
}

function RailTab({ active, onClick, icon, label, badge, tone }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; tone?: string
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[11.5px]"
      style={{ background: active ? 'var(--ide-active)' : 'transparent', color: active ? 'var(--ide-text)' : 'var(--ide-faint)' }}>
      {icon}{label}
      {!!badge && (
        <span className="ide-badge" style={{ padding: '2px 6px', color: tone, borderColor: tone ? `color-mix(in srgb, ${tone} 40%, transparent)` : undefined }}>{badge}</span>
      )}
    </button>
  )
}

function Row({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-[10.5px] py-[1px]">
      <span className="w-24 shrink-0" style={{ color: 'var(--ide-faint)' }}>{k}</span>
      <span className="flex-1 min-w-0 break-words" style={{ color: 'var(--ide-dim)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{v}</span>
    </div>
  )
}

function ElementDetail({ data, onClose, onHighlight }: { data: any; onClose: () => void; onHighlight: (sel: string) => void }) {
  const styles = data.styles ?? {}
  return (
    <div className="rounded-[10px] p-2.5" style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-accent)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Layers size={12} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[11.5px] font-medium flex-1 truncate">{data.role} · {data.tag}</span>
        <button onClick={() => onHighlight(data.sel)} className="ide-btn" style={{ height: 20, color: 'var(--ide-accent)' }}>highlight</button>
        <button onClick={onClose} className="ide-icon-btn" style={{ width: 20, height: 20 }} aria-label="Close inspector"><X size={11} /></button>
      </div>
      {data.sel && <div className="font-mono text-[10px] mb-2 break-all" style={{ color: 'var(--ide-faint)' }}>{data.sel}</div>}
      {!!data.flags?.length && (
        <div className="flex flex-wrap gap-1 mb-2">
          {data.flags.map((f: string, i: number) => (
            <span key={i} className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warning) 18%, transparent)', color: 'var(--warning)' }}>{f}</span>
          ))}
        </div>
      )}
      {data.rect && <Row k="rect" v={`${data.rect.w}×${data.rect.h} @ ${data.rect.x},${data.rect.y}`} />}
      {data.box && <>
        <Row k="padding" v={data.box.padding} />
        <Row k="margin" v={data.box.margin} />
        <Row k="content" v={`${data.box.contentBox?.w}×${data.box.contentBox?.h}`} />
      </>}
      {!!Object.keys(styles).length && <>
        <div className="text-[10px] uppercase tracking-wider font-semibold mt-2 mb-1" style={{ color: 'var(--text-3)' }}>computed</div>
        {['display', 'position', 'width', 'height', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border-radius', 'gap', 'text-align', 'z-index'].map((p) => (
          styles[p] ? <Row key={p} k={p} v={styles[p]} /> : null
        ))}
      </>}
      {data.contrast && (
        <div className="mt-2 flex items-center gap-2 text-[10.5px]">
          {data.contrast.passAA ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : data.contrast.passLargeAA ? <AlertTriangle size={12} style={{ color: 'var(--warning)' }} /> : <XCircle size={12} style={{ color: 'var(--danger)' }} />}
          <span style={{ color: 'var(--text-2)' }}>contrast {data.contrast.ratio}:1 (text {data.contrast.fg} on {data.contrast.bg})</span>
        </div>
      )}
      {!!data.parents?.length && <>
        <div className="text-[10px] uppercase tracking-wider font-semibold mt-2 mb-1" style={{ color: 'var(--text-3)' }}>ancestors</div>
        {data.parents.slice(0, 3).map((p: any, i: number) => <Row key={i} k={p.display ?? 'block'} v={`${p.sel} ${p.rect ? `${p.rect.w}×${p.rect.h}` : ''}`} />)}
      </>}
      {!!data.siblings?.length && <>
        <div className="text-[10px] uppercase tracking-wider font-semibold mt-2 mb-1" style={{ color: 'var(--text-3)' }}>siblings</div>
        {data.siblings.slice(0, 4).map((s: any, i: number) => <Row key={i} k={s.tag} v={`${s.sel} ${s.rect ? `${s.rect.w}×${s.rect.h}` : ''}`} />)}
      </>}
    </div>
  )
}
