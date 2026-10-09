import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, KeyRound, Loader2, Search as SearchIcon, Server, Terminal, X, Zap } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import LatticeLoader from '@/components/ui/reactbits/micro/LatticeLoader'

/**
 * Settings → Search.
 *
 * The old page asked you to pick an engine and then told you, in the fine print,
 * that most of them needed a key set on the server. This one works the other way
 * round: the ladder searches by itself (your SearXNG if it is running, otherwise
 * a public instance, otherwise DuckDuckGo), and the keys below are only for
 * people who *want* a paid engine. Anything you paste here is stored on this
 * machine and sent with the search request — no server configuration, no
 * environment variables, no restart.
 */

type EngineId = 'auto' | 'searxng' | 'brave' | 'serper' | 'tavily' | 'ddg'

const ENGINES: { id: EngineId; name: string; desc: string; needsKey?: boolean }[] = [
  { id: 'auto', name: 'Automatic (recommended)', desc: 'Your SearXNG → a public SearXNG → DuckDuckGo. Keyless, nothing to set up.' },
  { id: 'searxng', name: 'SearXNG', desc: 'Yours first, then a public instance that still serves the JSON API.' },
  { id: 'brave', name: 'Brave Search', desc: 'Brave’s own index. Paste a key below — no server setup.', needsKey: true },
  { id: 'serper', name: 'Serper', desc: 'Google results through Serper. Paste a key below.', needsKey: true },
  { id: 'tavily', name: 'Tavily', desc: 'Search built for LLMs, returns clean extracts.', needsKey: true },
  { id: 'ddg', name: 'DuckDuckGo', desc: 'Keyless HTML endpoint. Rate-limited but always there.' },
]

const REGIONS = ['us', 'gb', 'de', 'fr', 'jp', 'au', 'ca', 'in']

interface Status {
  searxng?: { url: string; reachable: boolean }[]
  ddg?: boolean
  keys?: { brave: boolean; serper: boolean; tavily: boolean }
}

export function SearchTab() {
  const settings = useStore((s) => s.settings)
  const update = (patch: Partial<typeof settings>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  const [status, setStatus] = useState<Status | null>(null)
  const [checking, setChecking] = useState(false)
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'done' | 'error'; engine?: string; first?: string; error?: string }>({ state: 'idle' })

  const keys = settings.searchKeys ?? {}
  const setKey = (id: 'brave' | 'serper' | 'tavily', value: string) =>
    update({ searchKeys: { ...keys, [id]: value.trim() } })
  const clearKey = (id: 'brave' | 'serper' | 'tavily') => {
    const next = { ...keys }
    delete next[id]
    update({ searchKeys: next })
  }

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try {
      const own = settings.searxngUrl ? `?searxng=${encodeURIComponent(settings.searxngUrl)}` : ''
      const res = await fetch(`/api/search/status${own}`, {
        headers: Object.keys(keys).length ? { 'x-re-search-keys': JSON.stringify(keys) } : undefined,
      })
      setStatus(res.ok ? await res.json() : null)
    } catch { setStatus(null) } finally { setChecking(false) }
  }, [keys, settings.searxngUrl])

  useEffect(() => { void checkStatus() }, [checkStatus])

  const runTest = async () => {
    setTest({ state: 'running' })
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent('research engine self hosted')}`, {
        headers: Object.keys(keys).length ? { 'x-re-search-keys': JSON.stringify(keys) } : undefined,
      })
      const json = await res.json()
      const first = json?.results?.[0]?.title as string | undefined
      setTest({ state: json?.results?.length ? 'done' : 'error', engine: json?.backend, first })
    } catch (e: any) {
      setTest({ state: 'error', error: String(e?.message ?? e) })
    }
  }

  const reachable = status?.searxng?.filter((s) => s.reachable) ?? []

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Search</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        What the Search toggle on a message uses. It works with nothing configured — the ladder below finds an engine
        by itself — and gets better if you give it a key or run your own SearXNG.
      </p>

      {/* Where it stands right now */}
      <div className="surface p-3.5 mb-5" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] font-medium">Search is ready</span>
          <button onClick={checkStatus} className="ml-auto text-[11.5px] px-2 py-1 rounded-full"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            {checking ? 'Checking…' : 'Re-check'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[12px]">
          <div className="flex items-center gap-1.5">
            {reachable.length
              ? <Check size={12} style={{ color: 'var(--success)' }} />
              : <X size={12} style={{ color: 'var(--text-3)' }} />}
            <span style={{ color: 'var(--text-2)' }}>
              {reachable.length ? `SearXNG answering (${reachable[0].url.replace(/^https?:\/\//, '')})` : 'No SearXNG instance answered from this machine'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {status?.ddg ? <Check size={12} style={{ color: 'var(--success)' }} /> : <X size={12} style={{ color: 'var(--text-3)' }} />}
            <span style={{ color: 'var(--text-2)' }}>{status?.ddg ? 'DuckDuckGo answering (keyless fallback)' : 'DuckDuckGo unreachable'}</span>
          </div>
          {(Object.keys(keys).length > 0) && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <KeyRound size={12} style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--text-2)' }}>
                Keys saved here: {Object.entries(keys).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none yet'}
              </span>
            </div>
          )}
        </div>
        {settings.searchLastEngine && (
          <div className="mt-2 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            Last search answered by <span className="font-mono">{settings.searchLastEngine}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {ENGINES.map((b) => {
          const active = (settings.searchBackend ?? 'auto') === b.id
          return (
            <button key={b.id} onClick={() => update({ searchBackend: b.id as any })}
              className="w-full text-left p-3.5 rounded-[14px] transition-colors"
              style={{
                background: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
                border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
              }}>
              <div className="font-medium text-[13.5px] flex items-center gap-1.5">
                {b.name}
                {b.needsKey && <span className="text-[10.5px] px-1.5 py-[1px] rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>key</span>}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{b.desc}</div>
            </button>
          )
        })}
      </div>

      {(settings.searchBackend ?? 'auto') !== 'auto' && (
        <label className="block mb-5">
          <span className="text-[12.5px] font-medium mb-1.5 block">Your SearXNG URL (optional)</span>
          <input value={settings.searxngUrl} onChange={(e) => update({ searxngUrl: e.target.value })}
            placeholder="http://localhost:8080"
            className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px] font-mono"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
          <span className="text-[11.5px] block mt-1" style={{ color: 'var(--text-3)' }}>
            Leave it as it is if you do not run one — a public instance is used instead.
          </span>
        </label>
      )}

      {/* Keys: paste, and they are used. Nothing to configure on the server. */}
      <div className="surface p-3.5 mb-5" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] font-medium">API keys — optional, and they stay here</span>
        </div>
        <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
          Paste a key and it is used immediately, on this machine, sent with the search request. Nothing needs to be
          set on the server and there is no restart.
        </p>
        {(['brave', 'serper', 'tavily'] as const).map((id) => (
          <label key={id} className="flex items-center gap-2 mb-2">
            <span className="text-[12px] w-16 capitalize" style={{ color: 'var(--text-2)' }}>{id}</span>
            <input
              type="password" value={keys[id] ?? ''} onChange={(e) => setKey(id, e.target.value)}
              placeholder={status?.keys?.[id] ? 'in use (env or this field)' : 'paste key'}
              aria-label={`${id} API key`}
              className="flex-1 px-3 py-1.5 rounded-[10px] outline-none text-[12.5px] font-mono"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
            {keys[id] && (
              <button onClick={() => clearKey(id)} aria-label={`Clear ${id} key`} className="p-1 rounded-[8px]"
                style={{ color: 'var(--text-3)' }}><X size={12} /></button>
            )}
          </label>
        ))}
      </div>

      <div className="mb-5">
        <span className="text-[12.5px] font-medium mb-1.5 block">Region</span>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button key={r} onClick={() => update({ searchRegion: r })}
              className="px-3 py-1 rounded-full text-[12px] uppercase"
              style={{
                background: settings.searchRegion === r ? 'var(--primary)' : 'var(--elevated)',
                color: settings.searchRegion === r ? '#fff' : 'var(--text-2)',
              }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Prove it, here, without leaving the page */}
      <div className="surface p-3.5" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <SearchIcon size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] font-medium">Test a search</span>
          <button onClick={runTest} disabled={test.state === 'running'}
            className="ml-auto px-3 py-1.5 rounded-full text-[12px] font-medium disabled:opacity-60"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {test.state === 'running' ? 'Searching…' : 'Run a test'}
          </button>
        </div>
        {test.state === 'running' && (
          <LatticeLoader label="Asking the engines" status="working" cellSize={5} gap={3} fontSize={11} />
        )}
        {test.state === 'done' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px]" style={{ color: 'var(--text-2)' }}>
            <Check size={12} className="inline mr-1" style={{ color: 'var(--success)' }} />
            <span className="font-mono">{test.engine}</span> answered — first result: {test.first}
          </motion.div>
        )}
        {test.state === 'error' && (
          <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{test.error ?? 'Nothing answered.'}</div>
        )}
      </div>

      <div className="mt-5 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
        <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-2)' }}>
          <Server size={12} /> Want your own SearXNG? One line, if you have Docker:
        </div>
        <code className="block font-mono text-[11px] px-2.5 py-1.5 rounded-[8px] mb-1.5"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          docker run -d --name searxng -p 8080:8080 -e SEARXNG_SETTINGS__SEARCH__FORMATS__0=json searxng/searxng
        </code>
        <div className="flex items-center gap-1.5">
          <Terminal size={12} /> Then set the URL above to <span className="font-mono">http://localhost:8080</span> — it is
          tried before any public instance.
        </div>
      </div>
    </div>
  )
}
