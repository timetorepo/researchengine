import React, { useMemo, useState } from 'react'
import { ExternalLink, Loader2, Plus, Power, Search, Server, ShieldCheck, Trash2, Wrench } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { McpServerConfig } from '@/types'
import { MCP_LISTINGS, mcpConfigFromListing, type McpListing } from '@/lib/ide/mcpCatalog'
import { useMcpStore } from '@/stores/useMcpStore'
import { useUI } from '@/stores/useUI'

export function McpMarketplace({ project }: { project?: string }) {
  const servers = useMcpStore((state) => state.servers)
  const addServer = useMcpStore((state) => state.addServer)
  const [query, setQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [customArgs, setCustomArgs] = useState('')
  const [customEnv, setCustomEnv] = useState('')
  const toast = useUI((state) => state.toast)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? MCP_LISTINGS.filter((listing) =>
      [listing.name, listing.category, listing.description, listing.command, ...listing.args].join(' ').toLowerCase().includes(q),
    ) : MCP_LISTINGS
  }, [query])

  const addListing = (listing: McpListing) => {
    addServer(mcpConfigFromListing(listing))
    toast(`${listing.name} added`, 'Configuration saved locally. Connect it when you are ready to start the server.', 'success')
  }

  const addCustom = () => {
    const command = customCommand.trim()
    if (!command) {
      toast('Command required', 'Enter the executable for this stdio MCP server, such as npx.', 'warning')
      return
    }
    const env: Record<string, string> = {}
    for (const line of customEnv.split('\n')) {
      const index = line.indexOf('=')
      if (index > 0) env[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
    const server: McpServerConfig = {
      id: nanoid(8), name: customName.trim() || command,
      command, args: customArgs.trim() ? customArgs.trim().split(/\s+/) : [],
      env: Object.keys(env).length ? env : undefined, enabled: false, approved: false,
    }
    addServer(server)
    setCustomName(''); setCustomCommand(''); setCustomArgs(''); setCustomEnv(''); setCustomOpen(false)
    toast('Custom server added', 'Configuration saved locally. Connect it when you are ready to start the server.', 'success')
  }

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3" data-mcp-marketplace>
      <header className="flex items-center gap-2">
        <Server size={14} style={{ color: 'var(--ide-accent)' }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-medium" style={{ color: 'var(--ide-text)' }}>MCP server marketplace</h2>
          <p className="text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>Curated stdio servers · available only in Coding</p>
        </div>
        <span className="text-[10.5px] px-2 py-1 rounded-full" style={{ background: 'var(--ide-hover)', color: 'var(--ide-dim)' }}>
          {servers.filter((server) => server.enabled).length} enabled
        </span>
      </header>

      <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[11px] leading-relaxed"
        style={{ background: 'color-mix(in srgb, var(--ide-warn) 10%, transparent)', color: 'var(--ide-dim)' }}>
        <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ide-warn)' }} />
        <p>
          Add saves a disabled configuration only. Open a Coding project and choose Connect to start it; an npx command may download its package the first time. The server becomes available to the assistant only after it responds. Credentials are password-hidden, stored in this local app profile, and passed to that process when it starts.
        </p>
      </div>

      {!!servers.length && (
        <section className="flex flex-col gap-2" aria-label="Configured MCP servers">
          <div className="flex items-center gap-2">
            <Wrench size={12} style={{ color: 'var(--ide-dim)' }} />
            <h3 className="text-[11.5px] font-medium" style={{ color: 'var(--ide-text)' }}>Configured servers</h3>
          </div>
          {servers.map((server) => (
            <McpServerRow key={server.id} server={server} project={project} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ide-faint)' }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search servers — files, browser, GitHub, search…"
              aria-label="Search MCP servers" className="ide-input w-full pl-8 text-[11.5px]" />
          </div>
          <span className="text-[10.5px] shrink-0" style={{ color: 'var(--ide-faint)' }}>{shown.length} listings</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {shown.map((listing) => {
            const installed = servers.some((server) => server.catalogId === listing.id)
            return (
              <article key={listing.id} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
                style={{ background: 'var(--ide-hover)', border: '1px solid var(--ide-border)' }} data-mcp-listing={listing.id}>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>{listing.name}</span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--ide-surface)', color: 'var(--ide-faint)' }}>{listing.category}</span>
                  <a href={listing.docs} target="_blank" rel="noreferrer noopener" title={`Documentation for ${listing.name}`}
                    className="ml-auto p-1" style={{ color: 'var(--ide-faint)' }}><ExternalLink size={11} /></a>
                </div>
                <p className="text-[10.8px] leading-snug" style={{ color: 'var(--ide-dim)' }}>{listing.description}</p>
                <code className="block text-[10px] leading-relaxed break-all font-mono" style={{ color: 'var(--ide-faint)' }}>
                  {listing.command} {listing.args.join(' ')}
                </code>
                {!!listing.envKeys.length && (
                  <p className="text-[10px]" style={{ color: 'var(--ide-faint)' }}>
                    Needs {listing.envKeys.map((item) => item.label).join(', ')}
                  </p>
                )}
                {listing.projectScoped && !project && (
                  <p className="text-[10px]" style={{ color: 'var(--ide-warn)' }}>Open a project to connect this server.</p>
                )}
                <button onClick={() => addListing(listing)} disabled={installed}
                  className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] text-[10.5px] disabled:opacity-60"
                  style={{ background: installed ? 'var(--ide-surface)' : 'var(--ide-accent)', color: installed ? 'var(--ide-dim)' : 'var(--ide-accent-contrast, white)' }}>
                  {installed ? 'Added' : <><Plus size={10} /> Add to Coding</>}
                </button>
              </article>
            )
          })}
          {!shown.length && <p className="text-[11px] p-3" style={{ color: 'var(--ide-faint)' }}>No servers match that search.</p>}
        </div>
      </section>

      <section className="rounded-[10px] p-2.5" style={{ background: 'var(--ide-hover)', border: '1px solid var(--ide-border)' }}>
        <button onClick={() => setCustomOpen((value) => !value)} className="flex items-center gap-2 text-[11.5px] font-medium"
          style={{ color: 'var(--ide-text)' }} aria-expanded={customOpen}>
          <Plus size={12} /> Add a custom stdio server
        </button>
        {customOpen && (
          <div className="mt-2.5 flex flex-col gap-2">
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Display name"
              className="ide-input w-full" aria-label="Custom MCP server name" />
            <input value={customCommand} onChange={(event) => setCustomCommand(event.target.value)} placeholder="Command, for example npx"
              className="ide-input w-full font-mono" aria-label="Custom MCP server command" />
            <input value={customArgs} onChange={(event) => setCustomArgs(event.target.value)} placeholder="Arguments separated by spaces"
              className="ide-input w-full font-mono" aria-label="Custom MCP server arguments" />
            <textarea value={customEnv} onChange={(event) => setCustomEnv(event.target.value)} rows={2}
              placeholder={'Environment variables, one KEY=value per line'} className="ide-input w-full font-mono resize-y"
              aria-label="Custom MCP server environment variables" />
            <button onClick={addCustom} className="self-start inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px]"
              style={{ background: 'var(--ide-accent)', color: 'var(--ide-accent-contrast, white)' }}>
              <Plus size={11} /> Save server configuration
            </button>
          </div>
        )}
      </section>

      <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        The listings are bundled with the app and are not a live external directory. The AI can use enabled servers only while a Coding project is open.
      </p>
    </div>
  )
}

function McpServerRow({ server, project }: { server: McpServerConfig; project?: string }) {
  const updateServer = useMcpStore((state) => state.updateServer)
  const setServerEnv = useMcpStore((state) => state.setServerEnv)
  const toggleServer = useMcpStore((state) => state.toggleServer)
  const removeServer = useMcpStore((state) => state.removeServer)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [tools, setTools] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const listing = MCP_LISTINGS.find((item) => item.id === server.catalogId)
  const missingProject = !project?.trim()
  const missingCredential = (listing?.envKeys ?? []).some((key) => !server.env?.[key.name]?.trim())

  const connect = async () => {
    setState('loading'); setTools([]); setMessage('')
    try {
      const response = await fetch('/api/mcp/tools', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ servers: [server], project }),
      })
      const result = await response.json()
      const entry = result.servers?.[0]
      if (entry?.ok) {
        updateServer(server.id, { enabled: true, approved: true })
        setState('done')
        const found = (entry.tools ?? []).map((tool: any) => String(tool.name))
        setTools(found)
        setMessage(found.length ? `${found.length} tools available` : 'Connected; server reported no tools.')
      } else {
        setState('error')
        setMessage(entry?.error ?? result.error ?? 'The server did not connect.')
      }
    } catch (error) {
      setState('error')
      setMessage(String(error instanceof Error ? error.message : error))
    }
  }

  return (
    <article className="rounded-[10px] p-2.5 flex flex-col gap-2" style={{ background: 'var(--ide-hover)', border: '1px solid var(--ide-border)' }} data-mcp-server={server.id}>
      <div className="flex items-center gap-2 min-w-0">
        <Server size={12} style={{ color: server.enabled ? 'var(--ide-accent)' : 'var(--ide-faint)' }} />
        <span className="text-[11.5px] font-medium truncate" style={{ color: 'var(--ide-text)' }}>{server.name}</span>
        <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--ide-surface)', color: 'var(--ide-faint)' }}>{server.enabled ? 'enabled' : 'disabled'}</span>
        <span className="flex-1" />
        <button onClick={() => void connect()} disabled={state === 'loading' || missingProject || missingCredential}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] text-[10px] disabled:opacity-40"
          style={{ background: 'var(--ide-surface)', color: 'var(--ide-text)' }}
          title={missingProject ? 'Open a project before connecting' : missingCredential ? 'Enter the required API key first' : 'Start the server and list its tools'}>
          {state === 'loading' ? <Loader2 size={10} className="animate-spin" /> : <Wrench size={10} />}
          {state === 'loading' ? 'Connecting' : 'Connect'}
        </button>
        <button onClick={() => { if (server.enabled) toggleServer(server.id) }} disabled={!server.enabled}
          aria-label={server.enabled ? `Disable ${server.name}` : `Connect to enable ${server.name}`}
          title={server.enabled ? `Disable ${server.name}` : 'Use Connect to test and enable this server'}
          className="p-1 rounded-[6px] disabled:cursor-not-allowed" style={{ color: server.enabled ? 'var(--success)' : 'var(--ide-faint)' }}><Power size={11} /></button>
        <button onClick={() => removeServer(server.id)} aria-label={`Remove ${server.name}`} className="p-1 rounded-[6px]" style={{ color: 'var(--ide-danger)' }}><Trash2 size={11} /></button>
      </div>

      <div className="flex flex-col gap-1">
        <code className="text-[9.5px] leading-relaxed break-all font-mono" style={{ color: 'var(--ide-faint)' }}>
          {server.command}{server.args.length ? ` ${server.args.join(' ')}` : ''}
        </code>
        {server.args.some((arg) => arg.includes('{project}')) && (
          <span className="text-[9.5px]" style={{ color: 'var(--ide-faint)' }}>
            {project ? `Project folder: ${project}` : 'Open a project to resolve the {project} argument.'}
          </span>
        )}
      </div>

      {!!(listing?.envKeys.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {listing.envKeys.map((key) => (
            <label key={key.name} className="flex flex-col gap-1 text-[9.5px]" style={{ color: 'var(--ide-faint)' }}>
              {key.label}
              <input type="password" autoComplete="off" value={server.env?.[key.name] ?? ''}
                onChange={(event) => setServerEnv(server.id, key.name, event.target.value)} placeholder={key.name}
                className="ide-input w-full font-mono" aria-label={key.label} />
            </label>
          ))}
        </div>
      )}

      {(state !== 'idle' || message) && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="text-[10px]" style={{ color: state === 'error' ? 'var(--ide-danger)' : 'var(--ide-dim)' }}>{message}</p>
          {!!tools.length && <p className="text-[9.5px] break-words" style={{ color: 'var(--ide-faint)' }}>Tools: {tools.join(', ')}</p>}
        </div>
      )}
      <p className="text-[9.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        Connect starts the configured process briefly to list its tools. It stops after the response; enabled servers can start again when the AI calls them.
      </p>
    </article>
  )
}
