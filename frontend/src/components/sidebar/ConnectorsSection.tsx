/**
 * The Connectors section in the sidebar. It lists every app Composio supports,
 * and a person connects an account from here. Connections are shared by the main
 * chat and the bots, through lib/composio/client.ts.
 *
 * Not configured: a key field. Configured: search, connected accounts, and the
 * whole catalog with Connect buttons. Sign-in opens in a new tab; this section
 * refreshes when the window is focused again, and after the return address.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Plug, Search, Unplug } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import {
  checkComposio, composioConfigured, disconnectComposio, isActiveAccount, listComposioAccounts, listComposioApps,
  saveComposioKey, startComposioConnect, type ComposioAccount, type ComposioApp,
} from '@/lib/composio/client'

const PAGE = 60

export function ConnectorsSection() {
  const ui = useUI()
  const [open, setOpen] = useState(true)
  const [configured, setConfigured] = useState(composioConfigured())
  const [keyDraft, setKeyDraft] = useState('')
  const [apps, setApps] = useState<ComposioApp[] | null>(null)
  const [accounts, setAccounts] = useState<ComposioAccount[]>([])
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<string | null>(null)

  const refresh = useCallback(async (refreshApps = false) => {
    setError(null)
    try {
      const [acc, list] = await Promise.all([
        listComposioAccounts(),
        apps === null || refreshApps ? listComposioApps({ refresh: refreshApps }) : Promise.resolve(apps),
      ])
      setAccounts(acc)
      setApps(list)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    }
  }, [apps])

  // First load, and again when a key is saved.
  useEffect(() => {
    if (!configured) return
    let alive = true
    void (async () => {
      const status = await checkComposio()
      if (!alive) return
      if (!status.ok) { setError(status.error ?? 'Composio did not accept the key.'); return }
      await refresh()
    })()
    return () => { alive = false }
    // refresh changes identity with apps; this effect is for configuration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured])

  // Coming back from sign-in: the window regains focus, or the return address was used.
  useEffect(() => {
    if (!configured) return
    const onFocus = () => { if (waiting) { setWaiting(null); void refresh() } }
    window.addEventListener('focus', onFocus)
    if (new URLSearchParams(window.location.search).get('composio') === 'connected') {
      const url = new URL(window.location.href)
      url.searchParams.delete('composio')
      window.history.replaceState(null, '', url.toString())
      void refresh()
    }
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, waiting])

  const connected = useMemo(() => new Map(accounts.filter(isActiveAccount).map((a) => [a.toolkit.toLowerCase(), a])), [accounts])

  const filtered = useMemo(() => {
    if (!apps) return []
    const needle = q.trim().toLowerCase()
    const list = needle
      ? apps.filter((a) => `${a.name} ${a.slug} ${a.categories.join(' ')} ${a.description}`.toLowerCase().includes(needle))
      : apps
    // Connected apps first, then the rest in their (alphabetical) order.
    return [...list].sort((a, b) => Number(connected.has(b.slug)) - Number(connected.has(a.slug)))
  }, [apps, q, connected])

  const saveKey = async () => {
    const raw = keyDraft.trim()
    if (!raw) { ui.toast('Paste your Composio project key first', undefined, 'warning'); return }
    setBusy('key')
    try {
      await saveComposioKey(raw)
      setKeyDraft('')
      setConfigured(true)
      ui.toast('Composio key saved', 'It stays on this device, encrypted when the vault is on.', 'success')
    } finally { setBusy(null) }
  }

  const removeKey = async () => {
    if (!window.confirm('Remove the Composio key from this device? Connected accounts stay connected at Composio, but this app stops using them until you add the key again.')) return
    await saveComposioKey('')
    setConfigured(false)
    setApps(null)
    setAccounts([])
    setError(null)
  }

  const connect = async (app: ComposioApp) => {
    setBusy(app.slug)
    setError(null)
    try {
      const { redirectUrl } = await startComposioConnect(app.slug)
      window.open(redirectUrl, '_blank', 'noopener')
      setWaiting(app.slug)
      ui.toast(`Sign in to ${app.name}`, 'Finish in the new tab. This list refreshes when you come back.', 'info')
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally { setBusy(null) }
  }

  const disconnect = async (acc: ComposioAccount, name: string) => {
    if (!window.confirm(`Disconnect ${name}? The bots and the chat lose access to it.`)) return
    setBusy(acc.id)
    try {
      await disconnectComposio(acc.id)
      await refresh()
      ui.toast(`${name} disconnected`, undefined, 'success')
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally { setBusy(null) }
  }

  const connectedCount = connected.size
  const appName = (slug: string) => apps?.find((a) => a.slug === slug)?.name ?? slug

  return (
    <section className="px-2 pt-1 pb-1" aria-label="Connectors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-[12px] font-medium hover:bg-[var(--elevated)] transition-colors"
        style={{ color: 'var(--text-2)' }}
      >
        <Plug size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left">Connectors</span>
        {configured && <span className="text-[10.5px] font-normal" style={{ color: 'var(--text-3)' }}>{connectedCount} connected</span>}
        <ChevronDown size={14} className="transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </button>

      {open && (
        <div className="mt-1 space-y-2 px-1 max-h-[46vh] overflow-y-auto pr-1">
          {!configured ? (
            <div className="space-y-2">
              <p className="text-[11px] leading-snug" style={{ color: 'var(--text-3)' }}>
                One project key connects the chat and the bots to the apps Composio supports. Paste it here; it is stored on this device.
              </p>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveKey() }}
                aria-label="Composio project key"
                placeholder="Composio project key"
                autoComplete="off"
                className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
              />
              <button type="button" onClick={saveKey} disabled={busy === 'key'}
                className="w-full px-3 py-1.5 rounded-full text-[12px] font-medium inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                {busy === 'key' && <Loader2 size={12} className="animate-spin" />} Save key
              </button>
            </div>
          ) : (
            <>
              {error && <p role="alert" className="text-[11px] leading-snug" style={{ color: 'var(--danger, #e5484d)' }}>{error}</p>}

              {connectedCount > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Connected</div>
                  {accounts.filter(isActiveAccount).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded-[8px] text-[11.5px]" style={{ background: 'var(--elevated)' }}>
                      <span className="flex-1 truncate">{appName(a.toolkit)}</span>
                      <button type="button" onClick={() => disconnect(a, appName(a.toolkit))} disabled={busy === a.id}
                        aria-label={`Disconnect ${appName(a.toolkit)}`} className="p-1 rounded-full hover:opacity-80" style={{ color: 'var(--text-3)' }}>
                        {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShown(PAGE) }}
                  aria-label="Search apps"
                  placeholder={apps ? `Search ${apps.length} apps` : 'Loading apps…'}
                  className="w-full pl-7 pr-2 py-1.5 rounded-[10px] text-[12px] outline-none"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                />
              </div>

              {apps === null && !error && (
                <div className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> Loading apps</div>
              )}

              <ul className="space-y-0.5" aria-label="Supported apps">
                {filtered.slice(0, shown).map((app) => {
                  const isOn = connected.has(app.slug)
                  return (
                    <li key={app.slug} className="flex items-center gap-2 px-1.5 py-1 rounded-[8px] hover:bg-[var(--elevated)]">
                      {app.logo
                        ? <img src={app.logo} alt="" width={18} height={18} loading="lazy" className="rounded-[4px] shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        : <span className="w-[18px] h-[18px] rounded-[4px] shrink-0" style={{ background: 'var(--elevated)' }} />}
                      <span className="flex-1 min-w-0 truncate text-[11.5px]" title={app.description || app.name}>{app.name}</span>
                      {isOn ? (
                        <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Connected</span>
                      ) : (
                        <button type="button" onClick={() => connect(app)} disabled={busy === app.slug}
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-medium inline-flex items-center gap-1 transition-transform active:scale-95"
                          style={{ background: 'var(--primary)', color: '#fff' }}>
                          {busy === app.slug && <Loader2 size={10} className="animate-spin" />} Connect
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {filtered.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full text-[11px] py-1 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
                  Show more ({filtered.length - shown} left)
                </button>
              )}
              {apps && filtered.length === 0 && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>No app matches “{q}”.</p>}
              {waiting && <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Waiting for {appName(waiting)} sign-in. Come back to this tab when it is done.</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button type="button" onClick={() => refresh(true)} className="text-[10.5px] underline underline-offset-2" style={{ color: 'var(--text-3)' }}>Refresh list</button>
                <button type="button" onClick={removeKey} className="text-[10.5px] underline underline-offset-2" style={{ color: 'var(--text-3)' }}>Remove key</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
