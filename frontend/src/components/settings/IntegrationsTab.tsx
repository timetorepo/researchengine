import React from 'react'
import { Check, Loader2, Plug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { INTEGRATION_META } from '@/components/input/IntegrationPicker'
import { timeAgo } from '@/lib/utils'

const SERVICES = [
  { id: 'drive', scopes: ['drive.readonly'], desc: 'Search, read and reference files as context.' },
  { id: 'gmail', scopes: ['gmail.readonly'], desc: 'Search inbox, summarize threads, draft replies.' },
  { id: 'gcal', scopes: ['calendar.readonly'], desc: 'Read events, suggest study schedules.' },
  { id: 'github', scopes: ['repo:read'], desc: 'Read repos, reference code, open issues (with consent).' },
  { id: 'notion', scopes: ['read_content'], desc: 'Read pages, insert research summaries.' },
  { id: 'zotero', scopes: ['library:read'], desc: 'Sync your citation library.' },
  { id: 'files', scopes: ['scoped-folder'], desc: 'A folder you grant access to. Read-only by default.' },
]

export function IntegrationsTab() {
  const integrations = useStore((s) => s.integrations)
  const log = useStore((s) => s.connectionLog)
  const ui = useUI()

  const toggle = (id: string, scopes: string[]) => {
    const cur = integrations[id]
    const meta = INTEGRATION_META[id]
    if (cur?.connected) {
      useStore.setState((s) => ({ integrations: { ...s.integrations, [id]: { ...cur, connected: false } } }))
      ui.toast(`${meta.name} disconnected`, 'OAuth tokens removed from the local vault.')
    } else {
      // OAuth handled locally via a localhost callback server; simulated here.
      useStore.setState((s) => ({
        integrations: { ...s.integrations, [id]: { id, connected: true, scopes, lastSync: Date.now() } },
      }))
      useStore.getState().logConnection(`oauth://localhost/callback`, `${meta.name} OAuth grant`, 512, 'local')
      ui.toast(`${meta.name} connected`, `Scopes: ${scopes.join(', ')}. Read-only until you grant write access.`, 'success')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Integrations</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Read-only by default, with explicit consent for write access. Tokens are encrypted and stored locally.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {SERVICES.map((svc) => {
          const meta = INTEGRATION_META[svc.id]
          const st = integrations[svc.id]
          const connected = !!st?.connected
          return (
            <div key={svc.id} className="surface p-4 flex flex-col">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: `hsl(${meta.hue} 50% 45% / 0.18)`, color: `hsl(${meta.hue} 62% 62%)` }}>
                  <meta.icon size={16} strokeWidth={1.5} />
                </span>
                <div className="flex-1">
                  <div className="font-medium text-[13.5px]">{meta.name}</div>
                  <div className="text-[10.5px]" style={{ color: connected ? 'var(--success)' : 'var(--text-3)' }}>
                    {connected ? `Connected · last sync ${st.lastSync ? timeAgo(st.lastSync) : 'now'}` : 'Not connected'}
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] flex-1 mb-3" style={{ color: 'var(--text-2)' }}>{svc.desc}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(svc.id, svc.scopes)}
                  className="flex-1 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors"
                  style={{
                    background: connected ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--primary)',
                    color: connected ? 'var(--danger)' : '#fff',
                  }}>
                  {connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              {connected && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {svc.scopes.map((sc) => (
                    <span key={sc} className="px-1.5 py-0.5 rounded-full text-[9.5px] font-mono" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{sc}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h3 className="text-[13px] font-semibold mb-2">Connection log</h3>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>A live record of every outbound request.</p>
      <div className="surface overflow-hidden">
        {log.length === 0 && <div className="p-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>No outbound requests yet.</div>}
        {log.slice(0, 12).map((e) => (
          <div key={e.id} className="flex items-center gap-2 px-3.5 py-2 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.status === 'local' ? 'var(--success)' : e.status === 'error' ? 'var(--danger)' : 'var(--primary)' }} />
            <span className="font-mono text-[11px] truncate flex-1" title={e.endpoint}>{e.endpoint}</span>
            <span className="truncate max-w-[180px]" style={{ color: 'var(--text-2)' }}>{e.purpose}</span>
            <span style={{ color: 'var(--text-3)' }}>{timeAgo(e.t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
