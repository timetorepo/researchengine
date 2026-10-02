// Host side of the Design-Mode bridge.
//
// The preview runs in an iframe on its own port (cross-origin by design), with
// the bridge script injected by the preview proxy. Everything the AI can do to
// the screen — snapshot, inspect, click, type, assert, screenshot — travels as
// a postMessage request/response pair through this module.
//
// A single module-level instance (`designSession`) is shared by the Design UI
// and by the chat tools, mirroring how `execWaits` is shared for approvals.
import { nanoid } from 'nanoid'

export interface SnapshotNode {
  uid: string
  sel: string
  tag: string
  role: string
  name: string
  text?: string
  rect: { x: number; y: number; w: number; h: number }
  aboveFold: boolean
  style: { fs: string; fw: string; color: string; bg: string; pad: string; gap: string; radius: string; display: string }
  flags: string[]
}

export interface Finding { kind: string; msg: string; sel: string }

export interface Snapshot {
  url: string
  title: string
  viewport: { w: number; h: number }
  scroll: { x: number; y: number; height: number }
  headings: { tag: string; text: string }[]
  counts: { interactive: number; nodes: number; images: number }
  elements: SnapshotNode[]
  findings: Finding[]
  console: { level: string; text: string; repeat?: number }[]
  network: { url: string; status: number; error?: string }[]
}

export interface ControlInfo {
  uid: string
  sel: string
  kind: 'button' | 'link' | 'input'
  name: string
  testid?: string
  rect: { x: number; y: number; w: number; h: number }
  aboveFold: boolean
  currentValue?: string
  disabled: boolean
  pressed?: string
  href?: string
  type?: string
}

export interface BridgeEvent {
  type: 'ready' | 'idle' | 'unloading' | 'picked' | 'status' | 'pointer'
  payload?: any
}

type Listener = (e: BridgeEvent) => void

/** Signal that the caller wants the preview iframe on screen. */
type OpenRequest = { project: string; resolve: () => void }

class DesignBridge {
  private frame: HTMLIFrameElement | null = null
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: any }>()
  private listeners = new Set<Listener>()
  private openRequests: OpenRequest[] = []
  token = nanoid(10)
  status: 'offline' | 'connecting' | 'ready' = 'offline'
  lastUrl = ''
  lastTitle = ''
  viewport = { w: 0, h: 0 }
  /** Set by the Design UI: switches the workbench into Design mode for a project. */
  onOpenRequest: ((project: string, done: () => void) => void) | null = null
  /** Set by the Design UI: resizes the preview pane (the iframe owns its viewport). */
  onResize: ((w: number, h: number) => void) | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (e: MessageEvent) => this.onMessage(e))
    }
  }

  /* ---------------- wiring ---------------- */
  attach(frame: HTMLIFrameElement | null) {
    this.frame = frame
    this.status = frame ? 'connecting' : 'offline'
    this.emit({ type: 'status', payload: this.status })
  }

  on(fn: Listener) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private emit(e: BridgeEvent) {
    for (const fn of this.listeners) { try { fn(e) } catch { /* listener errors must not break the bridge */ } }
  }

  private onMessage(e: MessageEvent) {
    const d: any = e.data
    if (!d || d.source !== 're-design-bridge') return
    if (d.token && d.token !== this.token) return
    if (d.type === 'result' || d.type === 'error') {
      const entry = this.pending.get(d.id)
      if (!entry) return
      clearTimeout(entry.timer)
      this.pending.delete(d.id)
      if (d.type === 'error') entry.reject(new Error(d.payload?.message ?? 'bridge error'))
      else entry.resolve(d.payload)
      return
    }
    if (d.type === 'ready') {
      this.status = 'ready'
      this.lastUrl = d.payload?.url ?? ''
      this.lastTitle = d.payload?.title ?? ''
      this.viewport = d.payload?.viewport ?? this.viewport
      this.emit({ type: 'ready', payload: d.payload })
      this.emit({ type: 'status', payload: 'ready' })
      return
    }
    if (d.type === 'idle') { this.emit({ type: 'idle', payload: d.payload }); return }
    if (d.type === 'unloading') {
      this.emit({ type: 'unloading', payload: d.payload })
      this.failPending('the preview navigated away')
      return
    }
    if (d.type === 'picked') { this.emit({ type: 'picked', payload: d.payload }); return }
    // Design mode's pointer: the frame reports where the mouse is, because the
    // parent page cannot see it once it is over an iframe.
    if (d.type === 'pointer') { this.emit({ type: 'pointer', payload: d.payload }); return }
  }

  private failPending(reason: string) {
    for (const [, entry] of this.pending) { clearTimeout(entry.timer); entry.reject(new Error(reason)) }
    this.pending.clear()
  }

  /* ---------------- request/response ---------------- */
  get live() { return this.status === 'ready' && !!this.frame?.contentWindow }

  async call<T = any>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    const win = this.frame?.contentWindow
    if (!win) throw new Error('The live preview is not on screen. Open Design mode (or press Start preview) and try again.')
    const id = nanoid(8)
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`The preview did not answer "${cmd}" within ${Math.round(timeoutMs / 1000)}s. It may be busy, crashed, or blocked from embedding.`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try { win.postMessage({ source: 're-design-host', cmd, args, id, token: this.token }, '*') }
      catch (err: any) { clearTimeout(timer); this.pending.delete(id); reject(new Error(String(err?.message ?? err))) }
    })
  }

  /** Wait for the bridge to announce itself (iframe load or reload). */
  waitForReady(timeoutMs = 20_000): Promise<void> {
    if (this.status === 'ready') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const off = this.on((e) => {
        if (e.type === 'ready') { clearTimeout(timer); off(); resolve() }
      })
      const timer = setTimeout(() => { off(); reject(new Error('The preview never became ready. Check the preview log — the app may have failed to start or is blocking embedding.')) }, timeoutMs)
    })
  }

  /** Ask the workbench to surface the preview, then wait until it is live. */
  async ensurePreview(project: string, timeoutMs = 25_000): Promise<void> {
    if (this.live) return
    if (this.onOpenRequest) {
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => { if (!settled) { settled = true; resolve() } }
        this.onOpenRequest!(project, done)
        setTimeout(done, 4000)
      })
    }
    await this.waitForReady(timeoutMs)
  }

  /** Ping with retries — resilient to a preview that is still booting. */
  async ping(tries = 12, gapMs = 700): Promise<any> {
    let lastError: any = null
    for (let i = 0; i < tries; i++) {
      try { return await this.call('ping', {}, 4000) } catch (e: any) {
        lastError = e
        await new Promise((r) => setTimeout(r, gapMs))
      }
    }
    throw lastError ?? new Error('preview unreachable')
  }
}

export const designSession = new DesignBridge()

/* ------------------------------------------------------------------ */
/* captures (screenshots taken by the AI or the user)                  */
/* ------------------------------------------------------------------ */

export interface Capture { id: string; dataUrl: string; w: number; h: number; at: number; url: string; label: string }

let captures: Capture[] = []
const captureListeners = new Set<() => void>()

export const captureStore = {
  subscribe(fn: () => void) { captureListeners.add(fn); return () => { captureListeners.delete(fn) } },
  get(): Capture[] { return captures },
  add(c: Capture) {
    captures = [c, ...captures].slice(0, 8)
    for (const fn of captureListeners) { try { fn() } catch { /* ignore */ } }
  },
  clear() { captures = []; for (const fn of captureListeners) { try { fn() } catch { /* ignore */ } } },
}

/* ------------------------------------------------------------------ */
/* attachment tray — screenshots queued to go out with the next message */
/* ------------------------------------------------------------------ */

export interface TrayAttachment { type: 'image'; name: string; dataUrl: string }

let tray: TrayAttachment[] = []
const trayListeners = new Set<() => void>()

export const attachmentTray = {
  subscribe(fn: () => void) { trayListeners.add(fn); return () => { trayListeners.delete(fn) } },
  get(): TrayAttachment[] { return tray },
  add(a: TrayAttachment) { tray = [...tray, a].slice(0, 4); trayListeners.forEach((fn) => { try { fn() } catch { /* ignore */ } }) },
  remove(i: number) { tray = tray.filter((_, idx) => idx !== i); trayListeners.forEach((fn) => { try { fn() } catch { /* ignore */ } }) },
  take(): TrayAttachment[] { const t = tray; tray = []; trayListeners.forEach((fn) => { try { fn() } catch { /* ignore */ } }); return t },
  clear() { tray = []; trayListeners.forEach((fn) => { try { fn() } catch { /* ignore */ } }) },
}

/* ------------------------------------------------------------------ */
/* preview URL helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * The preview proxy listens on its own port. Browsers cannot reach the
 * container's localhost, so the port is swapped into whatever host the user is
 * already browsing (the sandbox maps `https://<port>-<host>`; locally the host
 * is localhost and `:<port>` is enough).
 */
export function previewUrlFor(port: number, token?: string): string {
  if (!port) return ''
  const { protocol, hostname } = window.location
  const m = hostname.match(/^(\d+)-(.+)$/)
  const host = m ? `${port}-${m[2]}` : `${hostname}:${port}`
  const base = `${protocol}//${host}`
  return token ? `${base}/#re-token=${token}` : base
}

/** Same-origin URL for a preview whose proxy is mounted under a path. */
export function isEmbeddable(url: string): boolean {
  return /^https?:/.test(url)
}

/* ------------------------------------------------------------------ */
/* model-facing formatting                                            */
/* ------------------------------------------------------------------ */

function rectStr(r: { x: number; y: number; w: number; h: number }) {
  return `${r.w}×${r.h} @ ${r.x},${r.y}`
}

/** Compact, readable render of a snapshot for the model (kept well under limits). */
export function formatSnapshot(s: Snapshot, maxElements = 70): string {
  const lines: string[] = []
  lines.push(`PAGE ${s.title || '(untitled)'} — ${s.url}`)
  lines.push(`viewport ${s.viewport.w}×${s.viewport.h} · document ${s.scroll.height}px tall · ${s.counts.nodes} DOM nodes · ${s.counts.interactive} interactive`)
  if (s.headings.length) lines.push(`headings: ${s.headings.map((h) => `${h.tag} "${h.text}"`).join(' | ')}`)
  const flagged = s.elements.filter((e) => e.flags.length)
  if (flagged.length) {
    lines.push('')
    lines.push('ELEMENTS WITH LAYOUT / A11Y FLAGS')
    for (const e of flagged.slice(0, 24)) lines.push(`- ${e.flags.join(', ')} :: ${e.sel} (${rectStr(e.rect)}) "${(e.text || e.name || '').slice(0, 60)}"`)
  }
  lines.push('')
  lines.push('KEY ELEMENTS')
  for (const e of s.elements.slice(0, maxElements)) {
    const label = (e.name || e.text || '').replace(/\s+/g, ' ').slice(0, 70)
    lines.push(`- [${e.uid}] ${e.role} ${e.sel} ${rectStr(e.rect)} fs=${e.style.fs} color=${e.style.color} bg=${e.style.bg}${e.aboveFold ? '' : ' (below fold)'}${label ? ` "${label}"` : ''}`)
  }
  if (s.console?.length) {
    lines.push('')
    lines.push('CONSOLE (recent)')
    for (const c of s.console.slice(0, 10)) lines.push(`- ${c.level}: ${c.text.replace(/\s+/g, ' ').slice(0, 180)}${c.repeat && c.repeat > 1 ? ` (×${c.repeat})` : ''}`)
  }
  if (s.network?.length) {
    lines.push('')
    lines.push('FAILED REQUESTS')
    for (const n of s.network.slice(0, 6)) lines.push(`- ${n.status || 'ERR'} ${n.url}`)
  }
  return lines.join('\n')
}

export function formatFindings(findings: Finding[], limit = 20): string {
  if (!findings?.length) return 'No static UI issues detected.'
  return findings.slice(0, limit).map((f, i) => `${i + 1}. [${f.kind}] ${f.msg}${f.sel ? ` — ${f.sel}` : ''}`).join('\n')
}

export function formatControls(controls: ControlInfo[], limit = 60): string {
  if (!controls.length) return 'No interactive controls found on the page.'
  const rows = controls.slice(0, limit).map((c) => `- [${c.uid}] ${c.kind}: "${c.name}"${c.testid ? ` testid=${c.testid}` : ''}${c.disabled ? ' (disabled)' : ''}${c.currentValue ? ` value="${c.currentValue}"` : ''} @ ${rectStr(c.rect)}`)
  return `${controls.length} interactive control(s) on the page:\n${rows.join('\n')}`
}
