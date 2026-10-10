import React, { useMemo, useState } from 'react'
import {
  Calendar, Check, ChevronDown, ExternalLink, FolderOpen, Github, HardDrive, Hash,
  Loader2, Mail, StickyNote, Unplug,
} from 'lucide-react'
import { INTEGRATIONS, FIELD_LABELS, type IntegrationId } from '@/lib/integrations/registry'
import { integrationSummary, probeIntegration, saveCreds } from '@/lib/integrations/client'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  files: FolderOpen, drive: HardDrive, gmail: Mail, gcal: Calendar, github: Github, notion: StickyNote, slack: Hash,
}

/**
 * The accounts this build can actually reach.
 *
 * A card is "connected" only when a credential exists *and* the service
 * accepted it — the Test button performs a real authenticated call and reports
 * the account name back. Nothing here is simulated: if the token is wrong you
 * get the service's own refusal.
 */
export function IntegrationAccounts() {
  const settings = useStore((s) => s.settings)
  const [openId, setOpenId] = useState<IntegrationId | null>(null)
  const summary = useMemo(() => integrationSummary(), [settings.integrations])

  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="text-[15px] font-semibold">Connected accounts</h3>
        <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          {summary.filter((s) => s.connected && s.auth !== 'none').length} of {summary.filter((s) => s.auth !== 'none').length} connected
        </span>
      </div>
      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Credentials are encrypted in this browser (the same vault as your provider keys) and travel with each request;
        the backend keeps no copy and logs none of it. Everything below is read-only unless a service offers nothing else.
      </p>

      <div className="space-y-2">
        {INTEGRATIONS.map((def) => {
          const Icon = ICONS[def.id] ?? FolderOpen
          const state = summary.find((s) => s.id === def.id)
          const connected = !!state?.connected
          const open = openId === def.id
          return (
            <div key={def.id} className="surface overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
              <button
                onClick={() => setOpenId(open ? null : def.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                aria-expanded={open}
                aria-label={`${def.name} account`}>
                <span className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0"
                  style={{ background: `hsl(${def.hue} 50% 45% / 0.18)`, color: `hsl(${def.hue} 62% 62%)` }}>
                  <Icon size={16} strokeWidth={1.6} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{def.name}</span>
                    {def.auth === 'none'
                      ? <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>no account needed</span>
                      : connected
                        ? <span className="text-[10.5px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' }}><Check size={9} strokeWidth={3} /> connected</span>
                        : <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>not connected</span>}
                  </span>
                  <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {connected && state?.account ? `${state.account} · ` : ''}{def.short}{def.scopes.length ? ` · ${def.scopes.join(', ')}` : ''}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
              </button>
              {open && <AccountForm id={def.id} connected={connected} account={state?.account} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AccountForm({ id, connected, account }: { id: IntegrationId; connected: boolean; account?: string }) {
  const def = INTEGRATIONS.find((i) => i.id === id)!
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('')
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)
  const toast = useUI((s) => s.toast)

  const save = async (andTest: boolean) => {
    setBusy(andTest ? 'test' : 'save')
    setResult(null)
    try {
      await saveCreds(id, values)
      setValues({})
      if (!andTest) {
        toast(`${def.name} saved`, 'The credential is stored in this browser’s vault.', 'success')
        return
      }
      const out = await probeIntegration(id)
      setResult({ kind: 'ok', message: out.account ? `Working — signed in as ${out.account}` : out.detail })
    } catch (e: any) {
      setResult({ kind: 'err', message: String(e?.message ?? e) })
    } finally {
      setBusy('')
    }
  }

  if (def.auth === 'none') {
    return (
      <div className="px-4 pb-4 pt-1 text-[12px]" style={{ color: 'var(--text-2)' }}>
        {def.hint} The agent can already read it through the <code>integration_search</code> tool.
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-1">
      <p className="text-[11.5px] leading-relaxed mb-2.5" style={{ color: 'var(--text-2)' }}>{def.hint}</p>
      {def.fields.map((field) => {
        const meta = FIELD_LABELS[field]
        return (
          <label key={field} className="block mb-2">
            <span className="block text-[11px] mb-1" style={{ color: 'var(--text-3)' }}>{meta.label}</span>
            <input
              type={meta.secret ? 'password' : 'text'}
              value={values[field] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              placeholder={connected && meta.secret ? 'Saved — paste to replace' : meta.placeholder}
              aria-label={`${def.name} ${meta.label}`}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-[10px] text-[12.5px] font-mono outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            />
          </label>
        )
      })}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={() => void save(true)} disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save &amp; test
        </button>
        <button onClick={() => void save(false)} disabled={!!busy}
          className="px-3 py-2 rounded-[10px] text-[12px] disabled:opacity-50"
          style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        {connected && (
          <button
            onClick={async () => { await saveCreds(id, {}, { clear: true }); setResult(null); toast(`${def.name} disconnected`, 'The saved credential was deleted.', 'info') }}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-[10px] text-[12px]"
            style={{ color: 'var(--text-3)' }}>
            <Unplug size={12} /> Disconnect
          </button>
        )}
        <span className="flex-1" />
        {def.docs && (
          <a href={def.docs} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--primary)' }}>
            Get a token <ExternalLink size={11} />
          </a>
        )}
      </div>
      {connected && account && !result && (
        <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>Signed in as {account}.</div>
      )}
      {result && (
        <div className="text-[11.5px] mt-2" style={{ color: result.kind === 'ok' ? 'var(--success)' : 'var(--danger)' }}>{result.message}</div>
      )}
    </div>
  )
}
