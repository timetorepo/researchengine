import React from 'react'
import { useStore } from '@/stores/useStore'

const BACKENDS = [
  { id: 'demo', name: 'Demo (built-in)', desc: 'Simulated sources — no network. Perfect for trying the UI.' },
  { id: 'searxng', name: 'SearXNG (self-hosted)', desc: 'Default production backend. Point at your instance.' },
  { id: 'brave', name: 'Brave Search', desc: 'Requires BRAVE_API_KEY on the backend.' },
  { id: 'serper', name: 'Serper', desc: 'Google results via Serper. Requires SERPER_API_KEY.' },
  { id: 'tavily', name: 'Tavily', desc: 'Search built for LLMs. Requires TAVILY_API_KEY.' },
  { id: 'ddg', name: 'DuckDuckGo', desc: 'HTML scrape fallback. No key, rate-limited.' },
]

const REGIONS = ['us', 'gb', 'de', 'fr', 'jp', 'au', 'ca', 'in']

export function SearchTab() {
  const settings = useStore((s) => s.settings)
  const update = (patch: Partial<typeof settings>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Search</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        The backend used when you toggle Search on a message. Self-host SearXNG for full privacy.
      </p>

      <div className="space-y-2 mb-6">
        {BACKENDS.map((b) => (
          <button key={b.id} onClick={() => update({ searchBackend: b.id as any })}
            className="w-full text-left p-3.5 rounded-[14px] transition-colors"
            style={{
              background: settings.searchBackend === b.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)',
              border: `1px solid ${settings.searchBackend === b.id ? 'var(--primary)' : 'var(--surface-border)'}`,
            }}>
            <div className="font-medium text-[13.5px]">{b.name}</div>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{b.desc}</div>
          </button>
        ))}
      </div>

      {settings.searchBackend === 'searxng' && (
        <label className="block mb-5">
          <span className="text-[12.5px] font-medium mb-1.5 block">SearXNG instance URL</span>
          <input value={settings.searxngUrl} onChange={(e) => update({ searxngUrl: e.target.value })}
            className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px] font-mono"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
        </label>
      )}

      <div>
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
    </div>
  )
}
