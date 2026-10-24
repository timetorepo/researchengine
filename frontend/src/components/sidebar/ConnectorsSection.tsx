/**
 * Connectors: a marketplace of every app Composio supports, opened from one row
 * in the sidebar. Connecting an app happens here, not on Composio's website:
 * Connect opens Composio's sign-in in a small window, and this list updates by
 * itself when that window is done.
 *
 * Connections are shared by the main chat and the bots (lib/composio/client.ts).
 *
 * Identity (whose connections these are):
 *  - "Automatic": a user id made once on this device. Nothing to type.
 *  - "My Composio account": the person's own Composio user id, so connections
 *    made in their Composio dashboard show up here too.
 *
 * Context7 documentation search is built in and works without a key; the
 * optional key at the bottom raises its limits.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { Check, Loader2, Plug, Search, Unplug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import {
  checkComposio, composioIdentity, disconnectComposio, hasComposioUserId, isActiveAccount,
  isLocalApp, listComposioAccounts, listComposioApps, openInDefaultBrowser, saveComposioKey, setComposioIdentity, startComposioConnect,
  type ComposioAccount, type ComposioApp,
} from '@/lib/composio/client'
import { context7Configured, saveContext7Key } from '@/lib/context7/client'
import { IntegrationsPanel } from '@/components/settings/IntegrationsTab'
import { ServicesPanel } from '@/components/sidebar/ServicesPanel'
import { ConnectedServices } from '@/components/sidebar/ConnectedServices'
import { useComposioActivity, snapshotOf, type ActivityEvent } from '@/lib/composio/activity'
import { composioUserId } from '@/lib/composio/client'

const PAGE = 48
const CHIPS = 10
const POLL_MS = 2500
const WAIT_MS = 5 * 60_000
/** The name the sign-in window is opened with; the return page uses it to close itself. */

interface Waiting { slug: string; name: string; since: number }

const muted = { color: 'var(--text-3)' } as const
const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const
const primary = { background: 'var(--primary)', color: '#fff' } as const

export function ConnectorsMarketplace() {
  const open = useUI((s) => s.connectorsOpen)
  const tab = useUI((s) => s.connectorsTab)
  const count = useUI((s) => s.connectorsCount)
  const identity = useStore((s) => s.settings.composio)
  const configured = !!identity?.token

  const [apps, setApps] = useState<ComposioApp[] | null>(null)
  const [accounts, setAccounts] = useState<ComposioAccount[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  /** A sign-in page the person opens by hand, when no browser could be started for them. */
  const [signInLink, setSignInLink] = useState<{ name: string; url: string } | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  /** Which destructive action is waiting for its second press (no window.confirm: it can be blocked in the app). */
  const [armed, setArmed] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [idDraft, setIdDraft] = useState(composioIdentity().accountUserId)
  const [idError, setIdError] = useState<string | null>(null)

  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const appsRef = useRef<ComposioApp[] | null>(null)

  const refreshAccounts = useCallback(async (): Promise<ComposioAccount[]> => {
    // Without a user id there is nothing to list yet; the card asks for it.
    if (!hasComposioUserId()) { setAccounts([]); useUI.setState({ connectorsCount: 0 }); return [] }
    const userId = composioUserId()
    const acc = await listComposioAccounts()
    const now = Date.now()
    setAccounts(acc)
    setRefreshedAt(now)
    useUI.setState({ connectorsCount: acc.filter(isActiveAccount).length })
    // Connections made here or on Composio's website: say so when they change.
    const changes = useComposioActivity.getState().observe(userId, snapshotOf(acc, isActiveAccount), now)
    for (const e of changes.slice(0, 3)) {
      const name = appsRef.current?.find((a) => a.slug === e.toolkit)?.name ?? e.toolkit
      useUI.getState().toast(
        e.kind === 'connected' ? `${name} connected` : `${name} disconnected`,
        e.kind === 'connected' ? 'Added to your connected services.' : 'Removed from your connected services.',
        e.kind === 'connected' ? 'success' : 'info',
      )
    }
    return acc
  }, [])

  const loadApps = useCallback(async (fresh = false) => {
    const list = await listComposioApps({ refresh: fresh })
    appsRef.current = list
    setApps(list)
  }, [])

  // Keep connections current while the person works elsewhere (for example on
  // Composio's website): read the accounts every so often, and again whenever the
  // window comes back into focus. Faster while the dialog is open.
  const identityUser = identity?.accountUserId
  useEffect(() => {
    if (!configured || !hasComposioUserId()) return
    const tick = () => { void refreshAccounts().catch(() => { /* try again on the next tick */ }) }
    const id = window.setInterval(tick, open ? 10_000 : 30_000)
    const onBack = () => { if (!document.hidden) tick() }
    window.addEventListener('focus', onBack)
    document.addEventListener('visibilitychange', onBack)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onBack)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [configured, open, identityUser, refreshAccounts])

  // When the dialog opens (or the key or identity changes), check the key and load
  // the catalog. Closed, we only refresh the count the sidebar row shows.
  useEffect(() => {
    if (!configured) { useUI.setState({ connectorsCount: 0 }); return }
    let alive = true
    void (async () => {
      if (!open) { await refreshAccounts().catch(() => {}); return }
      setError(null)
      const status = await checkComposio()
      if (!alive) return
      if (!status.ok) { setError(status.error ?? 'Composio did not accept the key.'); return }
      try {
        await Promise.all([refreshAccounts(), apps === null ? loadApps(false) : Promise.resolve()])
      } catch (e: any) {
        if (alive) setError(String(e?.message ?? e))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configured, identity?.token, identity?.accountUserId])

  // Waiting for a sign-in window: poll the accounts until the app shows up, the
  // window is closed, or a few minutes pass.
  useEffect(() => {
    if (!waiting) return
    let stopped = false
    const tick = async () => {
      if (stopped) return
      const timedOut = Date.now() - waiting.since > WAIT_MS
      let done = false
      try {
        const acc = await refreshAccounts()
        done = acc.some((a) => isActiveAccount(a) && a.toolkit.toLowerCase() === waiting.slug)
      } catch { /* try again on the next tick */ }
      if (stopped) return
      if (done || timedOut) {
        setWaiting(null)
        // The change itself is announced by refreshAccounts (see the activity log).
      }
    }
    const id = window.setInterval(() => { void tick() }, POLL_MS)
    return () => { stopped = true; window.clearInterval(id) }
  }, [waiting, refreshAccounts])

  // The sign-in window lands back here with ?composio=connected. Close it so the
  // person returns to the dialog they started from.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('composio') !== 'connected') return
    url.searchParams.delete('composio')
    window.history.replaceState(null, '', url.toString())
    useUI.setState({ connectorsOpen: true })
  }, [])

  const connected = useMemo(
    () => new Map(accounts.filter(isActiveAccount).map((a) => [a.toolkit.toLowerCase(), a])),
    [accounts],
  )
  const appName = (slug: string) => apps?.find((a) => a.slug === slug)?.name ?? slug

  const chips = useMemo(() => {
    const n = new Map<string, number>()
    for (const a of apps ?? []) for (const c of a.categories) n.set(c, (n.get(c) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, CHIPS).map(([c]) => c)
  }, [apps])

  const filtered = useMemo(() => {
    if (!apps) return []
    const needle = q.trim().toLowerCase()
    let list = apps
    if (category) list = list.filter((a) => a.categories.includes(category))
    if (needle) list = list.filter((a) => `${a.name} ${a.slug} ${a.categories.join(' ')} ${a.description}`.toLowerCase().includes(needle))
    // Connected apps first; the rest keep their alphabetical order.
    return [...list].sort((a, b) => Number(connected.has(b.slug)) - Number(connected.has(a.slug)))
  }, [apps, q, category, connected])

  const close = () => useUI.setState({ connectorsOpen: false })

  const saveKey = async () => {
    const raw = keyDraft.trim()
    if (!raw) { useUI.getState().toast('Paste your Composio project key first', undefined, 'warning'); return }
    setBusy('key')
    try {
      await saveComposioKey(raw)
      setKeyDraft('')
      useUI.getState().toast('Composio key saved', 'It stays on this device, encrypted when the vault is on.', 'success')
    } finally { setBusy(null) }
  }

  /** Check the saved key now, and say plainly what happened. */
  const checkKeyNow = async () => {
    setChecking(true)
    setError(null)
    try {
      const status = await checkComposio()
      if (!status.ok) { setError(status.error ?? 'Composio did not accept the key.'); return }
      await refreshAll()
      useUI.getState().toast('Composio accepted the key', status.apps ? `${status.apps} apps are available.` : undefined, 'success')
    } finally { setChecking(false) }
  }

  const removeKey = async () => {
    if (armed !== 'key') { setArmed('key'); return }
    setArmed(null)
    await saveComposioKey('')
    setApps(null)
    setAccounts([])
    setWaiting(null)
    setError(null)
    useUI.setState({ connectorsCount: 0 })
  }

  // Save the Composio user id. The effect above reloads the accounts for it.
  const saveUserId = () => {
    const err = setComposioIdentity(idDraft)
    setIdError(err)
    if (err) return
    setIdDraft(composioIdentity().accountUserId)
    useUI.getState().toast('Composio user id saved', undefined, 'success')
  }

  /**
   * Send the person to the sign-in page in their own default browser. If the server
   * cannot start one, try a plain new tab; if that is blocked too, show a link to press.
   */
  /**
   * Put the person on the sign-in page. A browser tab takes the link in the tab
   * that was opened on the click. The desktop app asks its local server to start
   * the default browser on this machine. The link stays visible either way.
   */
  const openSignIn = async (url: string, name: string, pending: Window | null): Promise<{ opened: boolean; reason: string }> => {
    setSignInLink({ name, url })
    if (pending && !pending.closed) {
      try {
        pending.opener = null
        pending.location.href = url
        return { opened: true, reason: '' }
      } catch { /* the tab was refused; try the default browser */ }
    }
    const r = await openInDefaultBrowser(url)
    pending?.close()
    if (r.ok) return { opened: true, reason: '' }
    return { opened: false, reason: r.error }
  }

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      useUI.getState().toast('Sign-in link copied', 'Paste it into the browser you are signed in to.', 'success')
    } catch {
      useUI.getState().toast('Could not copy', 'Select the link and copy it by hand.', 'warning')
    }
  }

  const connect = async (app: ComposioApp) => {
    if (!hasComposioUserId()) { setError('Enter your Composio user id first. Connections are filed under it.'); return }
    setBusy(app.slug)
    setError(null)
    setSignInLink(null)
    // In a browser tab, open the tab now, while the click still counts as a user
    // gesture. A tab opened after the request returns is blocked.
    const pending = isLocalApp() ? null : window.open('about:blank', '_blank')
    try {
      const { redirectUrl } = await startComposioConnect(app.slug)
      const result = await openSignIn(redirectUrl, app.name, pending)
      setWaiting({ slug: app.slug, name: app.name, since: Date.now() })
      if (result.opened) useUI.getState().toast(`Sign in to ${app.name}`, 'Finish in your browser. This list updates by itself.', 'info')
      else setError(`${result.reason} Use the sign-in link below; this list updates when you finish.`)
    } catch (e: any) {
      pending?.close()
      setError(String(e?.message ?? e))
    } finally { setBusy(null) }
  }

  const disconnect = async (acc: ComposioAccount, name: string) => {
    if (armed !== acc.id) { setArmed(acc.id); return }
    setArmed(null)
    setBusy(acc.id)
    try {
      await disconnectComposio(acc.id)
      await refreshAccounts()
      // Announced by refreshAccounts, like every other change.
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally { setBusy(null) }
  }

  const [refreshing, setRefreshing] = useState(false)
  const refreshAll = async () => {
    setRefreshing(true)
    setError(null)
    try { await Promise.all([refreshAccounts(), loadApps(true)]) }
    catch (e: any) { setError(String(e?.message ?? e)) }
    finally { setRefreshing(false) }
  }

  const refreshConnected = async () => {
    setRefreshing(true)
    setError(null)
    try { await refreshAccounts() }
    catch (e: any) { setError(String(e?.message ?? e)) }
    finally { setRefreshing(false) }
  }

  const allEvents = useComposioActivity((s) => s.events)
  const changes: ActivityEvent[] = useMemo(
    () => allEvents.filter((e) => e.userId === composioUserId()),
    [allEvents, identityUser],
  )

  const connectedList = accounts.filter(isActiveAccount)

  return (
    <Modal
      isOpen={open}
      onOpenChange={(v) => { if (!v) close() }}
      size="3xl"
      backdrop="blur"
      scrollBehavior="inside"
      placement="center"
      isDismissable
      classNames={{
        wrapper: 'z-[80]',
        backdrop: 'z-[79] bg-[var(--scrim)]',
        base: 'glass overflow-hidden border border-[var(--surface-border)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]',
        header: 'px-5 pt-5 pb-3 border-b border-[var(--surface-border)]',
        body: 'px-5 py-4',
        footer: 'px-5 py-3 border-t border-[var(--surface-border)]',
        closeButton: 'top-4 right-4 text-[var(--text-3)] hover:bg-[var(--elevated)]',
      }}
      aria-label="Connectors"
      data-connectors-marketplace
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1 pr-10">
          <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
            <Plug size={16} strokeWidth={1.5} /> Connectors
          </span>
          <span className="text-[12px] font-normal" style={muted}>
            Connect the apps the chat and the bots can use. {configured ? `${count} connected.` : 'Add your Composio key once to start.'}
          </span>
        </ModalHeader>

        <ModalBody>
          <div role="tablist" aria-label="Connectors" className="grid grid-cols-3 gap-1 p-1 rounded-[12px] mb-4" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
            {([['apps', 'Apps'], ['connected', 'Connected'], ['builtin', 'Built in']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id}
                onClick={() => useUI.setState({ connectorsTab: id })}
                className="h-9 px-3 rounded-[9px] text-[13px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 min-w-0"
                style={{ background: tab === id ? 'var(--surface)' : 'transparent', color: tab === id ? 'var(--text-1)' : 'var(--text-3)', border: tab === id ? '1px solid var(--surface-border)' : '1px solid transparent', boxShadow: tab === id ? '0 1px 2px rgba(0,0,0,0.25)' : 'none' }}>
                <span className="truncate">{label}</span>
                {id === 'connected' && count > 0 && (
                  <span className="text-[10.5px] tabular-nums px-1.5 rounded-full shrink-0" style={{ background: 'var(--primary)', color: '#fff' }}>{count}</span>
                )}
              </button>
            ))}
          </div>
          {tab === 'connected' ? (
            <ConnectedServices
              accounts={connectedList}
              events={changes}
              appName={appName}
              busy={busy}
              armed={armed}
              onDisconnect={disconnect}
              onRefresh={() => void refreshConnected()}
              refreshedAt={refreshedAt}
              refreshing={refreshing}
              onBrowseApps={() => useUI.setState({ connectorsTab: 'apps' })}
            />
          ) : tab === 'builtin' ? (
            <div className="space-y-5">
              <IntegrationsPanel />
              <ServicesPanel />
            </div>
          ) : !configured ? (
            <div className="space-y-3 max-w-md">
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                One project key lets the chat and the bots reach every app Composio supports. Paste it here once; it stays on this device, encrypted when the vault is on.
              </p>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveKey() }}
                aria-label="Composio project key"
                placeholder="Composio project key"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-[12px] text-[13px] outline-none"
                style={field}
              />
              <button type="button" onClick={saveKey} disabled={busy === 'key'}
                className="px-4 py-2 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5"
                style={primary}>
                {busy === 'key' && <Loader2 size={13} className="animate-spin" />} Save key
              </button>
              <div className="pt-2">
                <Context7Row />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && <p role="alert" className="text-[12px] leading-snug" style={{ color: 'var(--danger, #e5484d)' }}>{error}</p>}
              {signInLink && (
                <div className="flex flex-wrap items-center gap-3 text-[12px]">
                  <a href={signInLink.url} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                    Open the sign-in page for {signInLink.name}
                  </a>
                  <button type="button" onClick={() => void copyLink(signInLink.url)}
                    className="underline underline-offset-2" style={{ color: 'var(--text-2)' }}>
                    Copy link
                  </button>
                </div>
              )}

              {/* The project key: saved on this device. Replace it or check it here. */}
              <div className="rounded-[12px] p-3 space-y-2" style={field}>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
                  <span className="flex-1">Project key</span>
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>Saved on this device</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && keyDraft.trim()) void saveKey() }}
                    aria-label="Replace Composio project key"
                    placeholder="Paste a new key to replace it"
                    autoComplete="off"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  />
                  <button type="button" onClick={saveKey} disabled={!keyDraft.trim() || busy === 'key'}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium disabled:opacity-50" style={primary}>
                    Replace
                  </button>
                </div>
                <div className="flex items-center gap-3 pt-0.5">
                  <button type="button" onClick={checkKeyNow} disabled={checking}
                    className="text-[11px] underline underline-offset-2 inline-flex items-center gap-1" style={muted}>
                    {checking && <Loader2 size={11} className="animate-spin" />} Check key
                  </button>
                  <button type="button" onClick={removeKey}
                    className="text-[11px] underline underline-offset-2" style={armed === 'key' ? { color: 'var(--danger, #e5484d)' } : muted}>
                    {armed === 'key' ? 'Press again to remove the key' : 'Remove key'}
                  </button>
                </div>
              </div>

              {/* Your Composio user id: connections are filed under it. */}
              <div className="rounded-[12px] p-3 space-y-2" style={{ ...field }}>
                <label className="block text-[11px]" style={muted} htmlFor="composio-user-id">
                  Your Composio user id. Connections you make here are filed under it, and the ones in your Composio dashboard show up here too.
                </label>
                <div className="flex gap-1.5">
                  <input id="composio-user-id" value={idDraft} onChange={(e) => { setIdDraft(e.target.value); setIdError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveUserId() }}
                    placeholder="e.g. you@example.com" autoComplete="off"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                  <button type="button" onClick={saveUserId}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-medium" style={primary}>
                    {hasComposioUserId() ? 'Save' : 'Use'}
                  </button>
                </div>
                {idError && <p role="alert" className="text-[11px]" style={{ color: 'var(--danger, #e5484d)' }}>{idError}</p>}
                {!hasComposioUserId() && !idError && (
                  <p className="text-[11px]" style={muted}>Connect is available once this is set.</p>
                )}
              </div>

              {connectedList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10.5px] uppercase tracking-wider" style={muted}>Connected</div>
                  <div className="flex flex-wrap gap-1.5">
                    {connectedList.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                        <Check size={11} aria-hidden /> {appName(a.toolkit)}
                        <button type="button" onClick={() => disconnect(a, appName(a.toolkit))} disabled={busy === a.id}
                          aria-label={armed === a.id ? `Confirm disconnect ${appName(a.toolkit)}` : `Disconnect ${appName(a.toolkit)}`}
                          className="px-1.5 py-0.5 rounded-full hover:opacity-80 text-[10.5px] inline-flex items-center gap-1"
                          style={armed === a.id ? { color: 'var(--danger, #e5484d)' } : muted}>
                          {busy === a.id ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
                          {armed === a.id && 'Confirm'}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShown(PAGE) }}
                  aria-label="Search apps"
                  placeholder={apps ? `Search ${apps.length} apps` : 'Loading apps…'}
                  className="w-full pl-8 pr-3 py-2 rounded-[12px] text-[12.5px] outline-none"
                  style={field}
                />
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
                  {[null, ...chips].map((c) => (
                    <button key={c ?? 'all'} type="button" onClick={() => { setCategory(c); setShown(PAGE) }}
                      aria-pressed={category === c}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-colors"
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
                <div className="text-[12px] inline-flex items-center gap-1.5" style={muted}><Loader2 size={13} className="animate-spin" /> Loading apps</div>
              )}

              <ul className="grid grid-cols-2 md:grid-cols-3 gap-2" aria-label="Supported apps">
                {filtered.slice(0, shown).map((app) => {
                  const isOn = connected.has(app.slug)
                  const isWaiting = waiting?.slug === app.slug
                  return (
                    <li key={app.slug} className="flex flex-col gap-1.5 p-2.5 rounded-[12px] min-w-0 transition-colors hover:bg-[var(--surface)]"
                      style={field}>
                      <div className="flex items-center gap-2 min-w-0">
                        {app.logo
                          ? <img src={app.logo} alt="" width={18} height={18} loading="lazy" className="rounded-[5px] shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          : <span className="w-[18px] h-[18px] rounded-[5px] shrink-0" style={{ background: 'var(--surface)' }} />}
                        <span className="text-[12px] font-medium truncate" title={app.name}>{app.name}</span>
                      </div>
                      {app.description && (
                        <span className="text-[10.5px] leading-snug line-clamp-2" style={muted}>{app.description}</span>
                      )}
                      <div className="mt-auto pt-0.5">
                        {isOn ? (
                          <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Check size={11} aria-hidden /> Connected</span>
                        ) : isWaiting ? (
                          <span className="text-[11px] inline-flex items-center gap-1" style={muted}><Loader2 size={11} className="animate-spin" /> Waiting for sign-in</span>
                        ) : (
                          <button type="button" onClick={() => connect(app)} disabled={busy === app.slug || !hasComposioUserId()}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 transition-transform active:scale-95"
                            style={primary}>
                            {busy === app.slug && <Loader2 size={11} className="animate-spin" />} Connect
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {filtered.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full text-[12px] py-2 rounded-[10px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
                  Show more ({filtered.length - shown} left)
                </button>
              )}
              {apps && filtered.length === 0 && <p className="text-[12px]" style={muted}>No app matches{q ? ` “${q}”` : ' this category'}.</p>}

              <Context7Row />
            </div>
          )}
        </ModalBody>

        {configured && tab === 'apps' && (
          <ModalFooter className="justify-between">
            <button type="button" onClick={refreshAll} disabled={refreshing} className="text-[11.5px] underline underline-offset-2 inline-flex items-center gap-1" style={muted}>
              {refreshing && <Loader2 size={11} className="animate-spin" />} Refresh list
            </button>
            <button type="button" onClick={removeKey} className="text-[11.5px] underline underline-offset-2" style={muted}>Remove key</button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
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
    <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
        <span className="flex-1">Documentation (Context7)</span>
        <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
          {has ? 'Key saved' : 'Built in'}
        </span>
      </div>
      <p className="text-[11px] leading-snug" style={muted}>
        Current docs and code examples for libraries, for the chat and the bots. Works without a key at lower limits; a key raises them.
      </p>
      <div className="flex gap-1.5">
        <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off"
          aria-label="Context7 API key (optional)" placeholder={has ? 'Replace key (optional)' : 'Context7 key (optional)'}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none"
          style={field} />
        <button type="button" onClick={save} disabled={saving || (!draft.trim() && !has)}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium disabled:opacity-50"
          style={primary}>
          {draft.trim() ? 'Save' : 'Clear'}
        </button>
      </div>
    </div>
  )
}
