import React, { useState } from 'react'
import { Check, Eye, EyeOff, Loader2, RefreshCw, X, ShieldAlert, Plus } from 'lucide-react'
import { PROVIDERS } from '@/lib/providers/registry'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { testConnection, ollamaTags } from '@/lib/providers/stream'
import { refreshProviderModels } from '@/lib/providers/refresh'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { getVaultPassphrase, setVaultPassphrase } from '@/lib/crypto/session'

export function ProvidersTab() {
  const settings = useStore((s) => s.settings)
  const [drafts, setDrafts] = useState<Record<string, { key: string; url: string }>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, 'idle' | 'busy' | 'ok' | 'err'>>({})
  const [latency, setLatency] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passPrompt, setPassPrompt] = useState(false)
  const [pass, setPass] = useState('')
  const log = useStore.getState().logConnection

  const get = (id: string) => settings.providers[id] ?? { apiKey: '', baseUrl: '', enabled: false }
  const meta = (id: string) => PROVIDERS.find((p) => p.id === id)!

  const saveProvider = async (id: string) => {
    const d = drafts[id] ?? {}
    const m = meta(id)
    const rawKey = d.key ?? ''
    const baseUrl = d.url ?? get(id).baseUrl ?? m.baseUrl

    let storedKey = get(id).apiKey
    if (rawKey) {
      if (settings.passphraseSet && getVaultPassphrase()) {
        storedKey = await encryptWithPassphrase(rawKey, getVaultPassphrase()!)
      } else if (!settings.passphraseSet) {
        storedKey = rawKey // plaintext, with warning
      } else {
        storedKey = rawKey
      }
    }

    useStore.setState((s) => ({
      settings: {
        ...s.settings,
        providers: { ...s.settings.providers, [id]: { apiKey: storedKey, baseUrl, enabled: true } },
      },
    }))
    setDrafts((prev) => ({ ...prev, [id]: { key: '', url: baseUrl } }))
    if (!settings.passphraseSet) {
      useStore.setState({} as any)
    }
    // Kick off a live model fetch right after saving so the picker fills fast.
    refreshProviderModels(id).catch(() => { /* surfaced via Add models button */ })
  }

  const test = async (id: string) => {
    setTesting((p) => ({ ...p, [id]: 'busy' }))
    setErrors((p) => ({ ...p, [id]: '' }))
    const m = meta(id)
    const conf = get(id)
    const d = drafts[id] ?? {}
    try {
      const key = d.key || (await usableKey(conf.apiKey))
      const url = d.url || conf.baseUrl || m.baseUrl
      if (m.id === 'ollama') {
        const models = await ollamaTags(url)
        useStore.setState({} as any)
        setLatency((p) => ({ ...p, [id]: 0 }))
        setTesting((p) => ({ ...p, [id]: 'ok' }))
        log(m.baseUrl, `ollama /api/tags (${models.length} models)`, 0, 'ok')
        return
      }
      const ms = await testConnection(id, key, url)
      setLatency((p) => ({ ...p, [id]: ms }))
      setTesting((p) => ({ ...p, [id]: 'ok' }))
      log(m.baseUrl, `${m.name} connection test`, 0, 'ok')
    } catch (e: any) {
      setErrors((p) => ({ ...p, [id]: e?.message ?? 'Connection failed' }))
      setTesting((p) => ({ ...p, [id]: 'err' }))
    }
  }

  const hasAnyKey = PROVIDERS.some((p) => get(p.id).apiKey)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Providers</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Bring your own key. Requests go <b>directly</b> from your browser to the provider — never through a Research Engine server.
      </p>

      {!settings.passphraseSet && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-[14px] mb-4"
          style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)' }}>
          <ShieldAlert size={17} style={{ color: 'var(--warning)' }} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
            <b style={{ color: 'var(--text)' }}>No vault passphrase set.</b> Keys are stored in plaintext in your browser's local storage.
            Set a passphrase to encrypt them with AES-GCM.
            <button onClick={() => setPassPrompt(true)} className="block mt-1.5 text-[12px] font-medium hover:underline" style={{ color: 'var(--warning)' }}>
              Set passphrase
            </button>
          </div>
        </div>
      )}

      {passPrompt && (
        <div className="flex gap-2 mb-4 p-3 rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--primary)' }}>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Vault passphrase"
            className="flex-1 bg-transparent outline-none text-[13px]" autoFocus />
          <button onClick={() => {
            if (pass.length < 4) return
            setVaultPassphrase(pass)
            useStore.setState((s) => ({ settings: { ...s.settings, passphraseSet: true } }))
            setPassPrompt(false); setPass('')
          }} className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}>Save</button>
          <button onClick={() => setPassPrompt(false)} className="px-2 text-[12px]" style={{ color: 'var(--text-3)' }}>Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {PROVIDERS.map((p) => {
          const conf = get(p.id)
          const d = drafts[p.id] ?? { key: '', url: conf.baseUrl || p.baseUrl }
          const state = testing[p.id] ?? 'idle'
          return (
            <div key={p.id} className="surface p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
                  <ProviderLogo id={p.id} size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] flex items-center gap-2">
                    {p.name}
                    {conf.enabled && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.hint ?? (p.needsKey ? 'Requires API key' : 'No key required')}</div>
                </div>
                {state === 'ok' && <span className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--success)' }}>
                  <Check size={13} /> {latency[p.id] ? `${latency[p.id]}ms` : 'online'}</span>}
                {state === 'busy' && <Loader2 size={15} className="animate-spin" style={{ color: 'var(--primary)' }} />}
                {state === 'err' && <span className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--danger)' }}><X size={13} /> failed</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="space-y-2">
                  {(p.needsKey || p.kind === 'anthropic') && (
                    <div className="relative">
                      <input
                        type={show[p.id] ? 'text' : 'password'}
                        value={d.key}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, key: e.target.value } }))}
                        placeholder={conf.apiKey ? 'Key saved — paste to replace' : 'API key'}
                        autoComplete="off"
                        className="w-full px-3 py-2 pr-9 rounded-[10px] bg-transparent outline-none text-[13px] font-mono"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                      />
                      <button onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))} aria-label="Toggle key visibility"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                        {show[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}
                  {(p.kind === 'ollama' || p.id === 'custom' || p.id === 'lmstudio' || p.id === 'nim' || p.id === 'openrouter' || conf.baseUrl) && (
                    <input
                      value={d.url}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, url: e.target.value } }))}
                      placeholder="Base URL"
                      className="w-full px-3 py-2 rounded-[10px] bg-transparent outline-none text-[13px] font-mono"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                    />
                  )}
                  {/* Live-fetched models only — never hardcoded. */}
                  {((settings.providerModels ?? {})[p.id] ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {((settings.providerModels ?? {})[p.id] ?? []).slice(0, 6).map((m) => (
                        <button key={m}
                          onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, defaultModel: `${p.id}:${m}` } }))}
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-mono transition-colors"
                          style={{
                            background: settings.defaultModel === `${p.id}:${m}` ? 'var(--primary)' : 'var(--elevated)',
                            color: settings.defaultModel === `${p.id}:${m}` ? '#fff' : 'var(--text-3)',
                          }}>
                          {m}
                        </button>
                      ))}
                      <button
                        onClick={async () => { try { await refreshProviderModels(p.id) } catch (e: any) { setErrors((p2) => ({ ...p2, [p.id]: e?.message ?? 'Fetch failed' })) } }}
                        aria-label={`Refresh ${p.name} models`}
                        className="px-1.5 py-0.5 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                        <RefreshCw size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const n = (await refreshProviderModels(p.id)).length
                          useUI.getState().toast(`${p.name} models fetched`, `${n} model${n === 1 ? '' : 's'} available.`, 'success')
                        } catch (e: any) {
                          setErrors((p2) => ({ ...p2, [p.id]: e?.message ?? 'Could not fetch models — check the key and base URL.' }))
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors hover:border-[var(--primary)]"
                      style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>
                      <Plus size={11} /> Add models
                    </button>
                  )}
                </div>
                <div className="flex sm:flex-col gap-2 items-stretch">
                  <button onClick={() => saveProvider(p.id)} className="px-3 py-1.5 rounded-[10px] text-[12px] font-medium"
                    style={{ background: 'var(--elevated)', color: 'var(--text)' }}>Save</button>
                  <button onClick={() => test(p.id)} disabled={state === 'busy'}
                    className="px-3 py-1.5 rounded-[10px] text-[12px] flex items-center gap-1.5 justify-center"
                    style={{ background: 'var(--primary)', color: '#fff', opacity: state === 'busy' ? 0.6 : 1 }}>
                    <RefreshCw size={11} /> Test
                  </button>
                </div>
              </div>

              {errors[p.id] && (
                <div className="mt-2 text-[12px] px-3 py-2 rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
                  {errors[p.id]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
