// Minimal Model Context Protocol (MCP) client over stdio.
// Servers are spawned per request (no lingering processes), spoken to with
// newline-delimited JSON-RPC, and killed on completion or timeout.
// Configured env vars are passed through but NEVER logged.
import { spawn, type ChildProcess } from 'node:child_process'
import { Hono } from 'hono'

const PROTOCOL_VERSION = '2024-11-05'
const HANDSHAKE_TIMEOUT_MS = 12_000
const CALL_TIMEOUT_MS = 30_000

interface RpcMsg { jsonrpc: '2.0'; id?: number; method?: string; result?: any; error?: any; params?: any }

class McpSession {
  private child: ChildProcess
  private buf = ''
  private nextId = 1
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private dead = false

  constructor(command: string, args: string[], env: Record<string, string>) {
    this.child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '', ...env },
    })
    this.child.stdout!.on('data', (d) => this.onData(d.toString()))
    this.child.stderr!.on('data', () => { /* server logs — ignored, never surfaced */ })
    this.child.on('exit', () => { this.dead = true; for (const p of this.pending.values()) p.reject(new Error('MCP server exited')) })
    this.child.on('error', (e) => { this.dead = true; for (const p of this.pending.values()) p.reject(e) })
  }

  private onData(chunk: string) {
    this.buf += chunk
    let idx: number
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line) continue
      try {
        const msg: RpcMsg = JSON.parse(line)
        if (msg.id != null && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if (msg.error) p.reject(new Error(msg.error?.message ?? 'MCP error'))
          else p.resolve(msg.result)
        }
      } catch { /* partial or non-JSON line */ }
    }
  }

  private notify(method: string, params?: any) {
    if (this.dead) return
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  request(method: string, params?: any, timeoutMs = CALL_TIMEOUT_MS): Promise<any> {
    if (this.dead) return Promise.reject(new Error('MCP server not running'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`)) }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(to); resolve(v) },
        reject: (e) => { clearTimeout(to); reject(e) },
      })
      this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  async init(): Promise<any> {
    const caps = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'research-engine', version: '0.15' },
    }, HANDSHAKE_TIMEOUT_MS)
    this.notify('notifications/initialized')
    return caps
  }

  kill() {
    try { this.child.kill('SIGKILL') } catch { /* already gone */ }
  }
}

function scrubServer(s: any): { command: string; args: string[]; env: Record<string, string> } {
  const command = String(s?.command ?? '').trim()
  if (!command || /[;&|`$]/.test(command)) throw new Error('Invalid MCP command')
  const args = Array.isArray(s?.args) ? s.args.map(String).slice(0, 24) : []
  const env: Record<string, string> = {}
  if (s?.env && typeof s.env === 'object') {
    for (const [k, v] of Object.entries(s.env)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && typeof v === 'string') env[k] = v
    }
  }
  return { command, args, env }
}

export function mcpRoutes() {
  const r = new Hono()

  // List tools across all configured servers.
  r.post('/mcp/tools', async (c) => {
    let body: { servers?: any[] }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const out: { serverId: string; serverName: string; ok: boolean; error?: string; tools: { name: string; description?: string; inputSchema?: any }[] }[] = []
    for (const s of body.servers ?? []) {
      let session: McpSession | null = null
      try {
        const { command, args, env } = scrubServer(s)
        session = new McpSession(command, args, env)
        await session.init()
        const res = await session.request('tools/list', {}, HANDSHAKE_TIMEOUT_MS)
        out.push({ serverId: s.id, serverName: s.name ?? s.id, ok: true, tools: (res?.tools ?? []).map((t: any) => ({ name: t.name, description: t.description ?? '', inputSchema: t.inputSchema ?? {} })) })
      } catch (e: any) {
        out.push({ serverId: s.id, serverName: s.name ?? s.id, ok: false, error: String(e?.message ?? e), tools: [] })
      } finally {
        session?.kill()
      }
    }
    return c.json({ servers: out })
  })

  // Call one tool on one server.
  r.post('/mcp/call', async (c) => {
    let body: { server?: any; name?: string; arguments?: Record<string, unknown> }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    let session: McpSession | null = null
    try {
      const { command, args, env } = scrubServer(body.server)
      session = new McpSession(command, args, env)
      await session.init()
      const res = await session.request('tools/call', { name: body.name, arguments: body.arguments ?? {} })
      // MCP tool results: { content: [{ type:'text', text }], isError? }
      const text = (res?.content ?? []).map((p: any) => p?.text ?? '').join('\n').slice(0, 100_000)
      return c.json({ ok: !res?.isError, text, isError: !!res?.isError })
    } catch (e: any) {
      return c.json({ ok: false, isError: true, text: `MCP call failed: ${String(e?.message ?? e)}` }, 200)
    } finally {
      session?.kill()
    }
  })

  return r
}
