/**
 * The Connectors section in the sidebar. It lists every app Composio supports
 * and lets a person connect an account from here. Connections are shared by the
 * main chat and the bots (lib/composio/client.ts).
 *
 * Layout follows Composio's "For You" page: role-style category chips on top,
 * then a grid of app tiles (logo, name, one-line pitch, Connect or Connected).
 *
 * Identity (who the connections belong to):
 *  - "Automatic": a user id made once on this device. Nothing to type.
 *  - "My Composio account": the person's own Composio user id, so connections
 *    made in their Composio dashboard show up here too.
 *
 * Context7 documentation search is built in and works without a key; the
 * optional key row below raises its limits.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Plug, Search, Unplug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import {
  checkComposio, composioConfigured, composioIdentity, composioUserId, disconnectComposio, isActiveAccount,
  listComposioAccounts, listComposioApps, saveComposioKey, setComposioIdentity, startComposioConnect,
  type ComposioAccount, type ComposioApp, type ComposioIdentityMode,
} from '@/lib/composio/client'
import { context7Configured, saveContext7Key } from '@/lib/context7/client'

const PAGE = 24
const CHIPS = 8

export function ConnectorsSection() {
  const ui = useUI()
  const [open, setOpen] = useState(true)
  const [configured, setConfigured] = useState(composioConfigured())
  const [keyDraft, setKeyDraft] = useState('')
  const [apps, setApps] = useState<ComposioApp[] | null>(null)
  const [accounts, setAccounts] = useState<ComposioAccount[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<string | null>(null)
  const identity = useStore((s) => s.settings.composio)
  const who = composioIdentity()
  const [idMode, setIdMode] = useState<ComposioIdentityMode>(who.mode)
  const [idDraft, setIdDraft] = useState(who.accountUserId)
  const [idError, setIdError] = useState<string | null>(null)

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

  // First load, and again when a key is saved or the identity changes.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, identity?.identityMode, identity?.accountUserId])

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

  // The most common categories become the chips (the For You use-case filter).
  const chips = useMemo(() => {
    const count = new Map<string, number>()
    for (const a of apps ?? []) for (const c of a.categories) count.set(c, (count.get(c) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, CHIPS).map(([c]) => c)
  }, [apps])

  const filtered = useMemo(() => {
    if (!apps) return []
    const needle = q.trim().toLowerCase()
    let list = apps
    if (category) list = list.filter((a) => a.categories.includes(category))
    if (needle) list = list.filter((a) => `${a.name} ${a.slug} ${a.categories.join(' ')} ${a.description}`.toLowerCase().includes(needle))
    // Connected apps first, then the rest in their (alphabetical) order.
    return [...list].sort((a, b) => Number(connected.has(b.slug)) - Number(connected.has(a.slug)))
  }, [apps, q, category, connected])

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

  const applyIdentity = (mode: ComposioIdentityMode, id?: string) => {
    const err = setComposioIdentity(mode, id)
    setIdError(err)
    if (err) return
    setIdMode(mode)
    setIdDraft(composioIdentity().accountUserId)
    // Make sure the automatic id exists even when the person never switches back to it.
    composioUserId()
    ui.toast(mode === 'account' ? 'Using your Composio account' : 'Using an automatic id on this device', undefined, 'success')
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

              {/* Identity: whose connections these are. */}
              <div className="rounded-[10px] p-2 space-y-1.5" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                <div role="radiogroup" aria-label="Account identity" className="grid grid-cols-2 gap-1 p-0.5 rounded-[8px]" style={{ background: 'var(--surface)' }}>
                  {([['automatic', 'Automatic'], ['account', 'My Composio account']] as const).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={idMode === id}
                      onClick={() => (id === 'automatic' ? applyIdentity('automatic') : setIdMode('account'))}
                      className="px-2 py-1 rounded-[6px] text-[10.5px] font-medium transition-colors"
                      style={{
                        background: idMode === id ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent',
                        color: idMode === id ? 'var(--text-1)' : 'var(--text-3)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
                {idMode === 'account' ? (
                  <div className="space-y-1">
                    <label className="block text-[10.5px]" style={{ color: 'var(--text-3)' }} htmlFor="composio-user-id">
                      Connect your Composio account: your Composio user id
                    </label>
                    <div className="flex gap-1">
                      <input id="composio-user-id" value={idDraft} onChange={(e) => { setIdDraft(e.target.value); setIdError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyIdentity('account', idDraft) }}
                        placeholder="e.g. you@example.com" autoComplete="off"
                        className="flex-1 min-w-0 px-2 py-1 rounded-[8px] text-[11.5px] outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                      <button type="button" onClick={() => applyIdentity('account', idDraft)}
                        className="px-2 py-1 rounded-full text-[10.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                        Use
                      </button>
                    </div>
                    {idError && <p role="alert" className="text-[10.5px]" style={{ color: 'var(--danger, #e5484d)' }}>{idError}</p>}
                  </div>
                ) : (
                  <p className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
                    Automatic: this device gets its own id, made once. Nothing to type.
                  </p>
                )}
              </div>

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

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1" role="group" aria-label="Categories">
                  {[null, ...chips].map((c) => (
                    <button key={c ?? 'all'} type="button" onClick={() => { setCategory(c); setShown(PAGE) }}
                      aria-pressed={category === c}
                      className="px-2 py-0.5 rounded-full text-[10.5px] transition-colors"
                      style={{
                        background: category === c ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
                        border: `1px solid ${category === c ? 'var(--primary)' : 'var(--surface-border)'}`,
                        color: category === c ? 'var(--text-1)' : 'var(--text-2)',
                      }}>
                      {c ?? 'All'}
                    </button>
                  ))}
                </div>
              )}

              {apps === null && !error && (
                <div className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> Loading apps</div>
              )}

              <ul className="grid grid-cols-2 gap-1" aria-label="Supported apps">
                {filtered.slice(0, shown).map((app) => {
                  const isOn = connected.has(app.slug)
                  return (
                    <li key={app.slug} className="flex flex-col gap-1 p-1.5 rounded-[10px] min-w-0"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {app.logo
                          ? <img src={app.logo} alt="" width={16} height={16} loading="lazy" className="rounded-[4px] shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          : <span className="w-4 h-4 rounded-[4px] shrink-0" style={{ background: 'var(--surface)' }} />}
                        <span className="text-[11px] font-medium truncate" title={app.name}>{app.name}</span>
                      </div>
                      {app.description && (
                        <span className="text-[9.5px] leading-snug line-clamp-2" style={{ color: 'var(--text-3)' }}>{app.description}</span>
                      )}
                      {isOn ? (
                        <span className="text-[10px] mt-auto" style={{ color: 'var(--text-2)' }}>✓ Connected</span>
                      ) : (
                        <button type="button" onClick={() => connect(app)} disabled={busy === app.slug}
                          className="mt-auto px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center justify-center gap-1 transition-transform active:scale-95"
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
              {apps && filtered.length === 0 && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>No app matches{q ? ` “${q}”` : ' this category'}.</p>}
              {waiting && <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Waiting for {appName(waiting)} sign-in. Come back to this tab when it is done.</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button type="button" onClick={() => refresh(true)} className="text-[10.5px] underline underline-offset-2" style={{ color: 'var(--text-3)' }}>Refresh list</button>
                <button type="button" onClick={removeKey} className="text-[10.5px] underline underline-offset-2" style={{ color: 'var(--text-3)' }}>Remove key</button>
              </div>
            </>
          )}

          <Context7Row />
        </div>
      )}
    </section>
  )
}

/** Documentation search. On by default with no setup; the key is optional. */
function Context7Row() {
  const ui = useUI()
  const [draft, setDraft] = useState('')
  const [has, setHas] = useState(context7Configured())
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveContext7Key(draft)
      setDraft('')
      setHas(context7Configured())
      ui.toast(draft.trim() ? 'Context7 key saved' : 'Context7 key removed', draft.trim() ? 'Documentation search now uses your key.' : 'Documentation search uses the anonymous limits.', 'success')
    } finally { setSaving(false) }
  }

  return (
    <div className="pt-2 mt-1 space-y-1.5" style={{ borderTop: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
        <span className="flex-1">Documentation (Context7)</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
          {has ? 'Key saved' : 'Built in'}
        </span>
      </div>
      <p className="text-[10px] leading-snug" style={{ color: 'var(--text-3)' }}>
        Current docs and code examples for libraries, for the chat and the bots. Works without a key at lower limits; a key raises them.
      </p>
      <div className="flex gap-1">
        <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off"
          aria-label="Context7 API key (optional)" placeholder={has ? 'Replace key (optional)' : 'Context7 key (optional)'}
          className="flex-1 min-w-0 px-2 py-1 rounded-[8px] text-[11px] outline-none"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="button" onClick={save} disabled={saving || (!draft.trim() && !has)}
          className="px-2 py-1 rounded-full text-[10.5px] font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {draft.trim() ? 'Save' : 'Clear'}
        </button>
      </div>
    </div>
  )
}
