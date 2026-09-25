// Live preview manager for Coding / Design mode.
//
// Responsibilities
//  1. Detect how a project wants to be served (Vite, Next, Astro, CRA, generic
//     npm script, Django, or a plain static folder).
//  2. Start it on a free port (or serve the files itself), with a scrubbed env.
//  3. Put a small reverse proxy in front on a *second* free port. The proxy is
//     what the browser embeds: it injects the Design-Mode bridge script into
//     every HTML document, drops frame-busting headers, and pipes websockets so
//     HMR keeps working. Because the proxy serves at the root of its own port,
//     root-relative asset URLs keep working untouched.
//  4. Hand the AI a stable handle (inspect / click / assert / screenshot) and
//     keep a rolling log so failures are visible in the UI.
import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { createConnection } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname, normalize, delimiter } from 'node:path'
import { BRIDGE_JS } from './bridge'
import { isWithinDir } from './paths'

export interface PreviewSession {
  project: string
  dir: string
  kind: string
  command: string
  internalPort: number | null
  publicPort: number
  proxy: Server
  child: ChildProcess | null
  staticRoot: string | null
  startedAt: number
  logs: string[]
  ready: boolean
  error: string | null
}

export interface PreviewInfo {
  running: boolean
  project: string
  kind: string
  command: string
  port: number
  internalPort: number | null
  url: string
  startedAt: number
  ready: boolean
  error: string | null
  logs: string[]
}

const MAX_LOGS = 400
export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
}

/** Free TCP port on all interfaces. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.on('error', reject)
    srv.listen(0, '0.0.0.0', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

/** Wait until something accepts connections on the port. */
function waitForPort(port: number, timeoutMs = 45_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = () => {
      const sock = createConnection({ port, host: '127.0.0.1' })
      const done = (ok: boolean) => { sock.removeAllListeners(); sock.destroy(); ok ? resolve(true) : (Date.now() > deadline ? resolve(false) : setTimeout(attempt, 350)) }
      sock.once('connect', () => done(true))
      sock.once('error', () => done(false))
      sock.setTimeout(1500, () => done(false))
    }
    attempt()
  })
}

interface Plan { kind: string; command: string; bin: string; args: (port: number) => string[]; env?: Record<string, string>; static?: boolean; needsPort: boolean; staticRoot?: string }

/** Work out how to run this project. */
async function planFor(dir: string): Promise<Plan | null> {
  const has = (p: string) => existsSync(join(dir, p))
  const binPath = (name: string) => {
    const p = join(dir, 'node_modules', '.bin', name)
    return existsSync(p) ? p : null
  }
  let pkg: any = null
  if (has('package.json')) { try { pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) } catch { pkg = null } }
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const scripts = pkg?.scripts ?? {}

  const vite = binPath('vite')
  if (vite && (deps.vite || deps['@vitejs/plugin-react'] || scripts.dev?.includes('vite'))) {
    return { kind: 'vite', command: 'vite --port <p> --strictPort --host 0.0.0.0', bin: vite, args: (p) => ['--port', String(p), '--strictPort', '--host', '0.0.0.0'], needsPort: true }
  }
  const next = binPath('next')
  if (next && (deps.next || scripts.dev?.includes('next'))) {
    return { kind: 'next', command: 'next dev -p <p> -H 0.0.0.0', bin: next, args: (p) => ['dev', '-p', String(p), '-H', '0.0.0.0'], needsPort: true }
  }
  const astro = binPath('astro')
  if (astro && (deps.astro || scripts.dev?.includes('astro'))) {
    return { kind: 'astro', command: 'astro dev --port <p> --host 0.0.0.0', bin: astro, args: (p) => ['dev', '--port', String(p), '--host', '0.0.0.0'], needsPort: true }
  }
  const cra = binPath('react-scripts')
  if (cra && (deps['react-scripts'] || scripts.start?.includes('react-scripts'))) {
    return { kind: 'cra', command: 'react-scripts start (PORT=<p>)', bin: cra, args: () => ['start'], env: { PORT: '<p>', HOST: '0.0.0.0', BROWSER: 'none', DANGEROUSLY_DISABLE_HOST_CHECK: 'true' }, needsPort: true }
  }
  // Python is not on the same name on every OS: `python3` does not exist on
  // Windows, where it is `python` or the `py` launcher. Without this, a Django
  // or Flask project simply refused to preview there.
  const python = pythonBin()
  if (has('manage.py') && python) {
    return { kind: 'django', command: `${python} manage.py runserver 0.0.0.0:<p>`, bin: python, args: (p) => ['manage.py', 'runserver', `0.0.0.0:${p}`, '--noreload'], needsPort: true }
  }
  if (scripts.dev && has('package.json')) {
    return { kind: 'npm-dev', command: 'npm run dev -- --port <p>', bin: 'npm', args: (p) => ['run', 'dev', '--', '--port', String(p), '--host'], env: { PORT: '<p>' }, needsPort: true }
  }
  if (scripts.start && has('package.json')) {
    return { kind: 'npm-start', command: 'npm run start (PORT=<p>)', bin: 'npm', args: () => ['run', 'start'], env: { PORT: '<p>', HOST: '0.0.0.0', BROWSER: 'none' }, needsPort: true }
  }
  for (const candidate of ['index.html', 'public/index.html', 'dist/index.html', 'build/index.html']) {
    if (has(candidate)) {
      const folder = candidate.split('/')[0]
      const root = candidate === 'index.html' ? dir : join(dir, folder)
      return {
        kind: 'static',
        command: candidate === 'index.html' ? 'static file server (project root)' : `static server (${folder}/)`,
        bin: '', args: () => [], static: true, needsPort: false, staticRoot: root,
      } as Plan & { staticRoot: string }
    }
  }
  if ((has('requirements.txt') || has('pyproject.toml')) && python) {
    const entry = (await readdir(dir)).find((f) => f === 'app.py' || f === 'main.py')
    if (entry) return { kind: 'flask', command: `${python} ${entry}`, bin: python, args: () => [entry], env: { PORT: '<p>', FLASK_RUN_PORT: '<p>' }, needsPort: true }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* proxy + static server                                              */
/* ------------------------------------------------------------------ */
export function injectBridge(html: string): string {
  const tag = `<script data-re-design-bridge>${BRIDGE_JS}</script>`
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, (m) => `${m}\n${tag}`)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, (m) => `${m}\n<head>${tag}</head>`)
  return tag + html
}

const STRIP_HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'content-length', 'content-encoding', 'transfer-encoding', 'connection']

function upstreamHeaders(headers: Record<string, any>, port: number): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase()
    if (lk === 'host' || lk === 'accept-encoding' || lk === 'origin' || lk === 'referer' || lk === 'connection' || lk === 'content-length') continue
    out[k] = v
  }
  out.host = `127.0.0.1:${port}`
  return out
}

function createProxy(session: PreviewSession, upstream: () => number | null): Promise<Server> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '/'
    if (url.startsWith('/__re/bridge.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(BRIDGE_JS)
      return
    }
    const port = upstream()
    if (!port) { serveStatic(session, req, res); return }
    let up: ReturnType<typeof httpRequest>
    try {
      up = httpRequest({ host: '127.0.0.1', port, method: req.method, path: url, headers: upstreamHeaders(req.headers as any, port) }, (r) => {
        const headers: Record<string, any> = { ...r.headers }
        for (const h of STRIP_HEADERS) delete headers[h]
        const ct = String(r.headers['content-type'] ?? '')
        if (ct.includes('text/html') || ct.includes('application/xhtml')) {
          const chunks: Buffer[] = []
          let size = 0
          r.on('data', (c: Buffer) => { size += c.length; if (size < 8_000_000) chunks.push(c) })
          r.on('end', () => {
            let html = Buffer.concat(chunks).toString('utf8')
            html = injectBridge(html)
            headers['content-type'] = 'text/html; charset=utf-8'
            headers['content-length'] = Buffer.byteLength(html)
            headers['cache-control'] = 'no-store'
            res.writeHead(r.statusCode ?? 200, headers)
            res.end(html)
          })
          return
        }
        headers['cache-control'] = headers['cache-control'] ?? 'no-store'
        res.writeHead(r.statusCode ?? 200, headers)
        r.pipe(res)
      })
    } catch (e: any) { res.writeHead(502, { 'content-type': 'text/plain' }); res.end(`preview upstream error: ${e?.message ?? e}`); return }
    up.on('error', (e: any) => {
      pushLog(session, `[proxy] upstream error: ${e?.message ?? e}`)
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' })
      res.end(`<body style="font:14px system-ui;padding:40px;background:#111;color:#eee"><h3>Preview server is not responding</h3><p>${String(e?.message ?? e)}</p><p>Check the preview log in the IDE.</p></body>`)
    })
    req.pipe(up)
  })

  // Websockets (Vite / Next HMR) — raw socket piping, upstream origin rewritten
  // so host/origin allowlists accept the connection.
  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const port = upstream()
    if (!port) { socket.destroy(); return }
    const up = createConnection({ host: '127.0.0.1', port }, () => {
      const raw: string[] = [`${req.method} ${req.url} HTTP/1.1`]
      const headers = { ...(req.headers as any) }
      headers.host = `127.0.0.1:${port}`
      if (headers.origin) headers.origin = `http://127.0.0.1:${port}`
      for (const [k, v] of Object.entries(headers)) {
        if (v === undefined) continue
        raw.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      }
      up.write(raw.join('\r\n') + '\r\n\r\n')
      if (head?.length) up.write(head)
      socket.pipe(up)
      up.pipe(socket)
    })
    up.on('error', () => socket.destroy())
    socket.on('error', () => up.destroy())
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(session.publicPort, '0.0.0.0', () => resolve(server))
  })
}

/** Extensions a command can carry on Windows (`.exe`, `.cmd`, …). */
const PATH_EXTS = process.platform === 'win32'
  ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
  : ['']

/**
 * Resolve a command name against PATH the way a shell would, without spawning
 * anything. Returns the first match, or null when the tool is not installed —
 * which is the honest answer, and lets a caller choose a fallback plan instead
 * of failing later.
 */
export function findOnPath(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const d of dirs) {
    if (process.platform !== 'win32') {
      const full = join(d, name)
      if (existsSync(full)) return full
    } else {
      for (const ext of PATH_EXTS) {
        const full = join(d, name + ext)
        if (existsSync(full)) return full
      }
      const bare = join(d, name)
      if (existsSync(bare)) return bare
    }
  }
  return null
}

/** The Python interpreter under whatever name this OS uses. */
export function pythonBin(): string | null {
  return findOnPath('python3') ?? findOnPath('python') ?? findOnPath('py')
}

/** Serve a project folder directly (no dev server needed). */
function serveStatic(session: PreviewSession, req: IncomingMessage, res: ServerResponse) {
  const root = session.staticRoot
  if (!root) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return }
  let rel = decodeURIComponent((req.url || '/').split('?')[0])
  if (rel.endsWith('/')) rel += 'index.html'
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '')
  let file = join(root, safe)
  try {
    // Separator-aware: a bare `startsWith(root)` also accepted a sibling folder
    // whose name merely begins with the root's ("/a/projects2" for "/a/projects").
    if (!isWithinDir(root, file)) throw new Error('escape')
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      // SPA fallback
      const index = join(root, 'index.html')
      if (existsSync(index) && !extname(rel)) file = index
      else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return }
    }
    const st = statSync(file)
    const ext = extname(file).toLowerCase()
    const type = MIME[ext] ?? 'application/octet-stream'
    if (type.includes('text/html')) {
      const html = injectBridge(readFileSync(file, 'utf8'))
      res.writeHead(200, { 'content-type': type, 'content-length': Buffer.byteLength(html), 'cache-control': 'no-store' })
      res.end(html)
      return
    }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': 'no-store' })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404')
  }
}

function pushLog(session: PreviewSession, line: string) {
  for (const l of String(line).split('\n')) {
    const t = l.replace(/\u001b\[[0-9;]*m/g, '').trimEnd()
    if (!t) continue
    session.logs.push(t.slice(0, 500))
  }
  if (session.logs.length > MAX_LOGS) session.logs.splice(0, session.logs.length - MAX_LOGS)
}

/** Look for "listening on :PORT" style output so we can follow a moved port. */
function sniffPort(text: string): number | null {
  const m = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]|:)(?::)?(\d{2,5})\b/)
  if (!m) return null
  const p = Number(m[1])
  return p > 0 && p < 65_536 ? p : null
}

function scrubbedEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (/key|token|secret|passw|credential|auth/i.test(k)) continue
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/* ------------------------------------------------------------------ */
/* manager                                                            */
/* ------------------------------------------------------------------ */
export class PreviewManager {
  private sessions = new Map<string, PreviewSession>()

  info(project: string): PreviewInfo | null {
    const s = this.sessions.get(project)
    if (!s) return null
    return {
      running: true, project: s.project, kind: s.kind, command: s.command, port: s.publicPort,
      internalPort: s.internalPort, url: `http://127.0.0.1:${s.publicPort}/`, startedAt: s.startedAt,
      ready: s.ready, error: s.error, logs: s.logs.slice(-120),
    }
  }

  list(): PreviewInfo[] {
    return [...this.sessions.keys()].map((k) => this.info(k)!).filter(Boolean)
  }

  /**
   * Start (or restart) the preview for a project.
   *
   * A restart keeps the SAME public port and proxy, so the pane the user is
   * looking at does not have to be re-created — only the inner dev server is
   * replaced. That keeps the embedded iframe URL stable across AI edits.
   */
  async start(project: string, dir: string, opts: { restart?: boolean } = {}): Promise<PreviewInfo> {
    const existing = this.sessions.get(project)
    // A cached session that failed (or whose process died) must not pin the
    // project into that failure — re-run the plan instead of returning a stale
    // error forever.
    if (existing && !opts.restart && (existing.ready || (!existing.error && existing.child))) return this.info(project)!
    if (existing) {
      await this.killChild(existing)
      existing.error = null
      existing.ready = false
      existing.logs.push('[re] restarting preview…')
      await this.bringUp(existing, dir)
      return this.info(project)!
    }

    const session: PreviewSession = {
      project, dir, kind: 'starting', command: '', internalPort: null, publicPort: 0,
      proxy: null as any, child: null, staticRoot: null, startedAt: Date.now(),
      logs: [], ready: false, error: null,
    }
    session.logs.push(`[re] preparing preview for ${project}`)
    this.sessions.set(project, session)
    session.publicPort = await freePort()
    try {
      await this.bringUp(session, dir)
      session.proxy = await createProxy(session, () => (session.ready && session.internalPort ? session.internalPort : null))
      session.logs.push(`[re] preview proxy on 0.0.0.0:${session.publicPort}`)
    } catch (e: any) {
      session.error = String(e?.message ?? e)
      session.logs.push(`[re] preview failed: ${session.error}`)
    }
    return this.info(project)!
  }

  /** Detect the stack, launch the dev server (or static server) and wait for it. */
  private async bringUp(session: PreviewSession, dir: string): Promise<void> {
    let plan: Plan | null = null
    try { plan = await planFor(dir) } catch { plan = null }
    if (!plan) {
      session.kind = 'none'
      session.command = '—'
      session.error = 'No runnable entry point found. Add a package.json script (dev/start), an index.html, or a manage.py.'
      return
    }
    if (plan.static) {
      session.kind = 'static'
      session.command = plan.command
      session.staticRoot = plan.staticRoot ?? dir
      session.ready = true
      session.logs.push(`[re] serving static files from ${session.staticRoot}`)
      return
    }
    const port = await freePort()
    session.internalPort = port
    const env: Record<string, string> = { ...scrubbedEnv(), PORT: String(port), HOST: '0.0.0.0', BROWSER: 'none', FORCE_COLOR: '0', CI: '1' }
    for (const [k, v] of Object.entries(plan.env ?? {})) env[k] = String(v).replace('<p>', String(port))
    const args = plan.args(port)
    session.kind = plan.kind
    session.command = plan.command.replace(/<p>/g, String(port))
    session.logs.push(`[re] $ ${plan.bin} ${args.join(' ')}`)
    const child = spawn(plan.bin, args, { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true, shell: process.platform === 'win32' })
    session.child = child
    child.stdout?.on('data', (d: Buffer) => { pushLog(session, d.toString()); const p = sniffPort(d.toString()); if (p && !session.ready) session.internalPort = p })
    child.stderr?.on('data', (d: Buffer) => pushLog(session, d.toString()))
    child.on('exit', (code, signal) => {
      pushLog(session, `[re] process exited (code ${code ?? 'null'}${signal ? `, ${signal}` : ''})`)
      if (code !== 0 && !session.ready) session.error = `The dev server exited with code ${code}. See the preview log.`
      session.ready = false
    })
    const live = await waitForPort(session.internalPort, 45_000)
    if (!live) {
      session.error = `Nothing started listening on port ${session.internalPort} after 45s. Check the preview log and the project's dev script.`
    } else {
      session.ready = true
      session.logs.push(`[re] dev server listening on 127.0.0.1:${session.internalPort}`)
    }
  }

  /** Only the spawned process — the proxy and its port survive a restart. */
  private async killChild(s: PreviewSession) {
    if (!s.child?.pid) return
    try { process.kill(-s.child.pid, 'SIGTERM') } catch { try { s.child.kill('SIGTERM') } catch { /* ignore */ } }
    await new Promise((r) => setTimeout(r, 350))
    try { process.kill(-s.child.pid, 'SIGKILL') } catch { /* already gone */ }
    s.child = null
  }

  async stop(project: string): Promise<boolean> {
    const s = this.sessions.get(project)
    if (!s) return false
    this.sessions.delete(project)
    await this.kill(s)
    return true
  }

  private async kill(s: PreviewSession) {
    try { s.proxy?.close() } catch { /* ignore */ }
    await this.killChild(s)
  }

  async stopAll() {
    for (const key of [...this.sessions.keys()]) await this.stop(key)
  }

  /**
   * Synchronous teardown for process exit. Dev servers are their own process
   * group (detached), so a SIGKILL to -pid takes the whole tree with it — no
   * orphan node processes pointing at a dead proxy.
   */
  stopAllSync() {
    for (const [, s] of this.sessions) {
      try { s.proxy?.close() } catch { /* ignore */ }
      if (s.child?.pid) {
        try { process.kill(-s.child.pid, 'SIGKILL') } catch { try { s.child.kill('SIGKILL') } catch { /* ignore */ } }
      }
    }
    this.sessions.clear()
  }

  /** Restart after the AI (or the user) changed the code. */
  async reload(project: string): Promise<PreviewInfo | null> {
    const s = this.sessions.get(project)
    if (!s) return null
    return this.start(project, s.dir, { restart: true })
  }

  /** Absolute path of a running preview (used for logs/diagnostics). */
  dirOf(project: string): string | null {
    return this.sessions.get(project)?.dir ?? null
  }

  /**
   * Static-file previews can also be served *through the app origin*
   * (`/api/ide/preview/site`). That is the fallback path for hosts that refuse
   * to embed a page from another port; it needs the folder, nothing else.
   */
  staticRootFor(project: string, fallbackDir?: string): string | null {
    const s = this.sessions.get(project)
    if (s?.staticRoot) return s.staticRoot
    if (fallbackDir) {
      for (const candidate of ['', 'public', 'dist', 'build']) {
        const root = candidate ? join(fallbackDir, candidate) : fallbackDir
        if (existsSync(join(root, 'index.html'))) return root
      }
    }
    return null
  }
}
