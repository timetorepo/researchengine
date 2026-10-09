/**
 * MCP tool servers, shared by the coding workspace and Settings → MCP Servers.
 * Chats get the same servers: the chat tool loop reads settings.mcpServers.
 *
 * Three ways in: a short list of servers worth having (one click), the open
 * index of about 7,700 servers (one click where the index verified a run
 * command, a link everywhere else), and a paste box for anything else.
 */
import { useEffect, useMemo, useState } from 'react'
import { Plus, Power, Trash2, Zap, ExternalLink, Loader2, Store, Search, Copy, Check } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import type { McpServerConfig } from '@/types'
import {
  loadMcpCatalog, searchCatalog, splitCommand, MCP_REGISTRY_URL, MCP_REGISTRY_LISTED,
  type McpCatalog, type McpCatalogEntry,
} from '@/lib/mcp/catalog'

interface Reco {
  name: string
  pkg: string
  why: string
  /** An env var the server wants before it can talk to its upstream. */
  envKey?: string
  envHint?: string
}

const RECOS: Reco[] = [
  { name: 'Filesystem', pkg: '@modelcontextprotocol/server-filesystem', why: 'Read, write and search files in a folder you choose.' },
  { name: 'Fetch', pkg: '@modelcontextprotocol/server-fetch', why: 'Pull web pages down as clean text for the agent.' },
  { name: 'Memory', pkg: '@modelcontextprotocol/server-memory', why: 'A knowledge graph the agent remembers between runs.' },
  { name: 'Sequential thinking', pkg: '@modelcontextprotocol/server-sequential-thinking', why: 'Structured multi-step reasoning as a tool.' },
  { name: 'Time', pkg: '@modelcontextprotocol/server-time', why: 'Times, dates and timezone conversions.' },
  { name: 'GitHub', pkg: '@modelcontextprotocol/server-github', why: 'Repos, issues and pull requests.', envKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', envHint: 'A fine-grained token with repo scope' },
  { name: 'Puppeteer', pkg: '@modelcontextprotocol/server-puppeteer', why: 'Drive a real browser: open, click, screenshot.' },
  { name: 'Brave search', pkg: '@modelcontextprotocol/server-brave-search', why: 'Web and local search results.', envKey: 'BRAVE_API_KEY', envHint: 'From the Brave Search API' },
]

const REGISTRIES: { name: string; url: string; note: string }[] = [
  { name: 'mcpservers.org', url: MCP_REGISTRY_URL, note: `${MCP_REGISTRY_LISTED} listed` },
  { name: 'Smithery', url: 'https://smithery.ai', note: 'installable registry' },
  { name: 'mcp.so', url: 'https://mcp.so', note: 'community servers' },
  { name: 'Glama', url: 'https://glama.ai/mcp/servers', note: 'directory with reviews' },
  { name: 'Official servers', url: 'https://github.com/modelcontextprotocol/servers', note: 'the reference set' },
]

export function McpPanel() {
  const servers = useStore((s) => s.settings.mcpServers)
  const ui = useUI()
  const [filter, setFilter] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [testNote, setTestNote] = useState<Record<string, string>>({})
  const [envDrafts, setEnvDrafts] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState({ name: '', command: '' })
  const [catQ, setCatQ] = useState('')
  const [cat, setCat] = useState<McpCatalog | null>(null)
  const [catEnv, setCatEnv] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadMcpCatalog()
      .then((c) => { if (live) setCat(c) })
      .catch(() => { if (live) setCat({ source: 'unavailable', count: 0, withCommand: 0, entries: [] }) })
    return () => { live = false }
  }, [])

  const setServers = (next: McpServerConfig[]) =>
    useStore.setState((s) => ({ settings: { ...s.settings, mcpServers: next } }))

  const already = (pkg: string) => servers.some((s) => (s.args ?? []).includes(pkg))

  const install = (reco: Reco) => {
    if (reco.envKey && !envDrafts[reco.pkg]?.trim()) return
    const cfg: McpServerConfig = {
      id: nanoid(8),
      name: reco.name,
      command: 'npx',
      args: ['-y', reco.pkg],
      env: reco.envKey ? { [reco.envKey]: envDrafts[reco.pkg].trim() } : undefined,
      enabled: true,
    }
    setServers([...servers, cfg])
    ui.toast(`${reco.name} installed`, 'It starts on demand the first time the agent needs its tools.', 'success')
  }

  const addFromCatalog = (e: McpCatalogEntry) => {
    const { command, args } = splitCommand(e.command)
    if (!command) return
    if (servers.some((s) => s.name === e.name)) {
      ui.toast('Already added', `${e.name} is in your servers.`, 'info')
      return
    }
    const key = e.env[0]
    const value = (catEnv[e.name] ?? '').trim()
    if (key && !value) return
    setServers([...servers, { id: nanoid(8), name: e.name, command, args, env: key ? { [key]: value } : undefined, enabled: true }])
    ui.toast(`${e.name} added`, 'It starts on demand, in coding sessions and in chats.', 'success')
  }

  const copyLink = (link: string, id: string) => {
    void navigator.clipboard?.writeText(link)
    setCopied(id)
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400)
  }

  const test = async (s: McpServerConfig) => {
    setTesting(s.id)
    setTestNote((n) => ({ ...n, [s.id]: '' }))
    try {
      const res = await fetch('/api/mcp/tools', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ servers: [s] }),
      })
      const j = await res.json()
      const one = j.servers?.[0]
      if (one?.ok) setTestNote((n) => ({ ...n, [s.id]: `connected: ${one.tools.length} tool${one.tools.length === 1 ? '' : 's'}, ${one.tools.map((t: any) => t.name).slice(0, 4).join(', ')}${one.tools.length > 4 ? '…' : ''}` }))
      else setTestNote((n) => ({ ...n, [s.id]: one?.error ?? 'Could not connect from this machine.' }))
    } catch {
      setTestNote((n) => ({ ...n, [s.id]: 'Could not reach the MCP bridge from here.' }))
    }
    setTesting(null)
  }

  const addCustom = () => {
    const cmd = custom.command.trim()
    if (!cmd) { ui.toast('Command required', 'Example: npx -y @modelcontextprotocol/server-filesystem /path', 'warning'); return }
    const { command, args } = splitCommand(cmd)
    setServers([...servers, { id: nanoid(8), name: custom.name.trim() || command, command, args, enabled: true }])
    setCustom({ name: '', command: '' })
    setAdding(false)
    ui.toast('MCP server added', 'Test it with the bolt button once you are online.', 'success')
  }

  const q = filter.trim().toLowerCase()
  const shown = RECOS.filter((r) => !q || r.name.toLowerCase().includes(q) || r.pkg.toLowerCase().includes(q) || r.why.toLowerCase().includes(q))
  const catShown = useMemo(() => searchCatalog(cat?.entries ?? [], catQ, 40), [cat, catQ])

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-3 text-[11px]">
      {/* configured */}
      <div className="ide-section px-0.5 pt-2 pb-1.5">Your servers</div>
      {servers.length === 0 && (
        <p className="px-1 pb-1 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
          Nothing configured yet. Install one below or paste a command.
        </p>
      )}
      {servers.map((s) => (
        <div key={s.id} className="px-1.5 py-1.5 rounded-[6px] mb-1 hover:bg-[var(--ide-hover)]">
          <div className="flex items-center gap-1.5">
            <Zap size={10} style={{ color: s.enabled ? 'var(--ide-accent)' : 'var(--ide-faint)' }} />
            <span className="flex-1 truncate text-[10.5px]" style={{ color: 'var(--ide-text)' }}>{s.name}</span>
            <span className="font-mono text-[9.5px] truncate max-w-[90px]" style={{ color: 'var(--ide-faint)' }}>{s.command} {(s.args ?? []).join(' ')}</span>
            <button title={s.enabled ? 'Disable' : 'Enable'} className="opacity-70 hover:opacity-100"
              onClick={() => setServers(servers.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x))}>
              <Power size={10} style={{ color: s.enabled ? 'var(--success)' : 'var(--ide-faint)' }} />
            </button>
            <button title="Test the connection" className="opacity-70 hover:opacity-100" onClick={() => void test(s)}>
              {testing === s.id ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
            </button>
            <button title="Remove" className="opacity-60 hover:opacity-100" onClick={() => setServers(servers.filter((x) => x.id !== s.id))}>
              <Trash2 size={10} />
            </button>
          </div>
          {testNote[s.id] && <p className="mt-1 leading-snug" style={{ color: 'var(--ide-faint)' }}>{testNote[s.id]}</p>}
        </div>
      ))}
      {!adding ? (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-1.5 py-1 rounded-[6px] hover:bg-[var(--ide-hover)]" style={{ color: 'var(--ide-dim)' }}>
          <Plus size={10} /> Paste a custom server…
        </button>
      ) : (
        <div className="px-1.5 py-1.5 space-y-1.5">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Name (optional)" className="ide-input w-full" />
          <input value={custom.command} onChange={(e) => setCustom({ ...custom, command: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="npx -y @modelcontextprotocol/server-filesystem /path" className="ide-input w-full font-mono" />
          <div className="flex gap-1.5">
            <button onClick={addCustom} className="px-2 py-1 rounded-[6px] text-[10.5px]" style={{ background: 'var(--ide-accent)', color: '#fff' }}>Add</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1 rounded-[6px] text-[10.5px]" style={{ color: 'var(--ide-dim)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* recommended */}
      <div className="ide-section px-0.5 pt-3.5 pb-1.5">Recommended, one click</div>
      <div className="px-1 pb-2">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--ide-faint)' }} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter the list…"
            className="ide-input w-full pl-6" />
        </div>
      </div>
      {shown.map((r) => {
        const installed = already(r.pkg)
        return (
          <div key={r.pkg} className="px-1.5 py-1.5 rounded-[6px] mb-1 hover:bg-[var(--ide-hover)]">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <span className="block text-[10.5px]" style={{ color: 'var(--ide-text)' }}>{r.name}</span>
                <span className="block leading-snug" style={{ color: 'var(--ide-dim)' }}>{r.why}</span>
              </div>
              {installed ? (
                <span className="text-[9.5px] shrink-0" style={{ color: 'var(--success)' }}>installed</span>
              ) : (
                <button onClick={() => install(r)} disabled={Boolean(r.envKey && !envDrafts[r.pkg]?.trim())}
                  title={r.envKey && !envDrafts[r.pkg]?.trim() ? 'Fill in the key first' : `Add ${r.pkg}`}
                  className="shrink-0 px-1.5 py-1 rounded-[6px] text-[9.5px] font-medium disabled:opacity-40"
                  style={{ background: 'var(--ide-accent)', color: '#fff' }}>
                  Install
                </button>
              )}
            </div>
            {r.envKey && !installed && (
              <input value={envDrafts[r.pkg] ?? ''} onChange={(e) => setEnvDrafts((d) => ({ ...d, [r.pkg]: e.target.value }))}
                placeholder={`${r.envKey} (${r.envHint ?? 'required'})`} type="password"
                className="ide-input w-full mt-1.5 font-mono" style={{ fontSize: 9.5 }} />
            )}
          </div>
        )
      })}
      {!shown.length && <p className="px-1" style={{ color: 'var(--ide-faint)' }}>Nothing matches that filter.</p>}

      {/* catalog */}
      <div className="ide-section px-0.5 pt-3.5 pb-1.5 flex items-center gap-1"><Store size={10} /> The catalog</div>
      <div className="px-1 pb-2">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--ide-faint)' }} />
          <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder={cat ? `Search ${cat.count.toLocaleString()} servers…` : 'Loading the catalog…'}
            className="ide-input w-full pl-6" />
        </div>
        <p className="pt-1 text-[9px] leading-snug" style={{ color: 'var(--ide-faint)' }}>
          {cat ? `${cat.count.toLocaleString()} servers in the open index. ${cat.withCommand} install in one click; the rest open their project page.` : ''}
        </p>
      </div>
      {catShown.map((e) => {
        const installed = servers.some((s) => s.name === e.name)
        const oneClick = !!e.command
        const needsKey = oneClick && !!e.env[0] && !installed
        const keyMissing = needsKey && !(catEnv[e.name] ?? '').trim()
        return (
          <div key={`${e.name}|${e.url}`} className="px-1.5 py-1.5 rounded-[6px] mb-1 hover:bg-[var(--ide-hover)]">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <span className="block text-[10.5px] truncate" style={{ color: 'var(--ide-text)' }}>{e.name}</span>
                <span className="block leading-snug truncate" title={e.description} style={{ color: 'var(--ide-dim)' }}>{e.description || e.category}</span>
                <span className="block font-mono text-[9px] truncate" style={{ color: 'var(--ide-faint)' }}>
                  {oneClick ? e.command : e.transport ? `${e.transport}, hosted` : 'link only'}
                </span>
              </div>
              {(e.url || e.endpoint) && (
                <a href={e.url || e.endpoint} target="_blank" rel="noreferrer" title="Open the project page" className="shrink-0 opacity-70 hover:opacity-100">
                  <ExternalLink size={10} />
                </a>
              )}
              {installed ? (
                <span className="text-[9.5px] shrink-0" style={{ color: 'var(--success)' }}>added</span>
              ) : oneClick ? (
                <button onClick={() => addFromCatalog(e)} disabled={keyMissing}
                  title={keyMissing ? `Enter ${e.env[0]} first` : 'Add to your servers'}
                  className="shrink-0 px-1.5 py-1 rounded-[6px] text-[9.5px] font-medium disabled:opacity-40"
                  style={{ background: 'var(--ide-accent)', color: '#fff' }}>
                  Add
                </button>
              ) : (
                <button onClick={() => copyLink(e.url || e.endpoint || '', e.name)} title="Copy the link"
                  className="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-[6px] text-[9.5px]"
                  style={{ color: 'var(--ide-dim)' }}>
                  {copied === e.name ? <Check size={10} /> : <Copy size={10} />}
                  {copied === e.name ? 'copied' : 'link'}
                </button>
              )}
            </div>
            {needsKey && (
              <input type="password" value={catEnv[e.name] ?? ''} onChange={(ev) => setCatEnv((d) => ({ ...d, [e.name]: ev.target.value }))}
                placeholder={`${e.env[0]} (required)`} className="ide-input w-full mt-1.5 font-mono" style={{ fontSize: 9.5 }} />
            )}
          </div>
        )
      })}
      {cat && catShown.length === 0 && (
        <p className="px-1 pb-1" style={{ color: 'var(--ide-faint)' }}>Nothing in the index matches. Try a broader word, or browse the full directory below.</p>
      )}

      {/* registries */}
      <div className="ide-section px-0.5 pt-3.5 pb-1.5 flex items-center gap-1"><Store size={10} /> The registries</div>
      <p className="px-1 pb-1.5 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        Everything else lives in the open MCP directories. Find a server, copy its run command, paste it above.
      </p>
      {REGISTRIES.map((r) => (
        <a key={r.url} href={r.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-1.5 py-1 rounded-[6px] hover:bg-[var(--ide-hover)]" style={{ color: 'var(--ide-text)' }}>
          <ExternalLink size={10} style={{ color: 'var(--ide-accent)' }} />
          <span className="text-[10.5px]">{r.name}</span>
          <span className="text-[9.5px] ml-auto" style={{ color: 'var(--ide-faint)' }}>{r.note}</span>
        </a>
      ))}
    </div>
  )
}
