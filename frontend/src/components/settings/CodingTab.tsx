import React, { useState } from 'react'
import { Plus, Trash2, Loader2, Wrench, TerminalSquare, ShieldCheck, Power } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import type { McpServerConfig } from '@/types'

export function CodingTab() {
  const mcpServers = useStore((s) => s.settings.mcpServers)
  const ui = useUI()
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [envText, setEnvText] = useState('')

  const setServers = (servers: McpServerConfig[]) =>
    useStore.setState((s) => ({ settings: { ...s.settings, mcpServers: servers } }))

  const add = () => {
    const cmd = command.trim()
    if (!cmd) { ui.toast('Command required', 'Example: npx -y @modelcontextprotocol/server-filesystem /path', 'warning'); return }
    const env: Record<string, string> = {}
    for (const line of envText.split('\n')) {
      const i = line.indexOf('=')
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    setServers([...mcpServers, {
      id: nanoid(8), name: name.trim() || cmd.split(' ')[0], command: cmd,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      env: Object.keys(env).length ? env : undefined, enabled: true,
    }])
    setName(''); setCommand(''); setArgs(''); setEnvText('')
    ui.toast('MCP server added', 'The AI can now call its tools via mcp_call.', 'success')
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Coding</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        The Coding workspace: an AI pair-programmer over your local projects, with a guarded terminal, git, and MCP tool servers.
      </p>

      <section className="surface p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} style={{ color: 'var(--success)' }} />
          <h3 className="text-[13.5px] font-medium">Command safety</h3>
        </div>
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <li>Every command runs only inside the project folder, with secrets stripped from its environment.</li>
          <li>Destructive commands (rm -rf /, sudo, pipe-to-shell, disk tools, force-push…) are blocked outright — never runnable, by anyone.</li>
          <li>Mutating commands (installs, builds, git commit/push, file moves) always require your explicit approval first — in the terminal and when the AI asks.</li>
          <li>60-second timeout and output caps on every run.</li>
        </ul>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Wrench size={15} style={{ color: 'var(--primary)' }} />
          <h3 className="text-[13.5px] font-medium">MCP servers</h3>
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Model Context Protocol — extra tools the AI can call</span>
        </div>

        {mcpServers.length > 0 && (
          <div className="space-y-2 mb-4">
            {mcpServers.map((s) => (
              <ServerRow key={s.id} server={s}
                onToggle={() => setServers(mcpServers.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x))}
                onDelete={() => setServers(mcpServers.filter((x) => x.id !== s.id))} />
            ))}
          </div>
        )}

        <div className="surface p-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name (optional)"
              className="px-3 py-2 rounded-[10px] text-[12.5px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
            <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Command — e.g. npx"
              className="px-3 py-2 rounded-[10px] text-[12.5px] outline-none font-mono"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
          </div>
          <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="Arguments (space-separated) — e.g. -y @modelcontextprotocol/server-filesystem /home/user/projects"
            className="w-full px-3 py-2 rounded-[10px] text-[12.5px] outline-none font-mono"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
          <textarea value={envText} onChange={(e) => setEnvText(e.target.value)} rows={2}
            placeholder={'Extra env vars, one per line — e.g. GITHUB_TOKEN=…\n(stored locally, never logged)'}
            className="w-full px-3 py-2 rounded-[10px] text-[12px] outline-none font-mono resize-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
          <button onClick={add} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12.5px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <Plus size={13} /> Add MCP server
          </button>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            Servers are started on demand when the AI lists or calls their tools, and shut down right after — nothing lingers.
          </p>
        </div>
      </section>
    </div>
  )
}

function ServerRow({ server, onToggle, onDelete }: { server: McpServerConfig; onToggle: () => void; onDelete: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [tools, setTools] = useState<string>('')

  const test = async () => {
    setState('loading')
    try {
      const res = await fetch('/api/mcp/tools', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ servers: [server] }),
      })
      const j = await res.json()
      const s = j.servers?.[0]
      if (s?.ok) {
        setState('done')
        setTools(s.tools.map((t: any) => t.name).join(', ') || 'connected (0 tools)')
      } else {
        setState('error')
        setTools(s?.error ?? 'Could not connect')
      }
    } catch (e: any) {
      setState('error'); setTools(String(e?.message ?? e))
    }
  }

  return (
    <div className="surface p-3">
      <div className="flex items-center gap-2">
        <TerminalSquare size={14} style={{ color: server.enabled ? 'var(--primary)' : 'var(--text-3)' }} />
        <span className="text-[13px] font-medium flex-1 truncate">{server.name}</span>
        <span className="text-[10.5px] font-mono truncate max-w-[260px]" style={{ color: 'var(--text-3)' }}>
          {server.command}{server.args.length ? ' ' + server.args.join(' ') : ''}
        </span>
        <button onClick={test} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          {state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : 'Test'}
        </button>
        <button onClick={onToggle} title={server.enabled ? 'Disable' : 'Enable'} className="p-1 rounded-md"
          style={{ color: server.enabled ? 'var(--success)' : 'var(--text-3)' }}>
          <Power size={13} />
        </button>
        <button onClick={onDelete} className="p-1 rounded-md" style={{ color: 'var(--danger)' }} aria-label="Remove server">
          <Trash2 size={13} />
        </button>
      </div>
      {state !== 'idle' && (
        <p className="text-[11px] mt-1.5 font-mono" style={{ color: state === 'error' ? 'var(--danger)' : 'var(--text-2)' }}>
          {state === 'done' ? `tools: ${tools}` : tools}
        </p>
      )}
    </div>
  )
}
