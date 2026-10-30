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
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Check, Loader2, Plug, Search, Unplug, X } from 'lucide-react'
import { Spinner, toast } from '@heroui/react'
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
/** A sign-in window that closed is given this long to show up as a connected account. */
const CLOSED_GRACE_MS = 2000

/**
 * One sign-in in progress for one app.
 * connecting → the sign-in window is open (or the link is waiting to be opened);
 * connected  → the account showed up, shown briefly;
 * failed     → why it stopped: 'closed' window, 'timeout', 'error' or 'opener'.
 */
interface Flight {
  app: ComposioApp
  status: 'connecting' | 'connected' | 'failed'
  since: number
  /** The tab that holds the sign-in page (browser only). */
  win: Window | null
  /** The sign-in link, kept so it can be opened or copied by hand. */
  link: string | null
  /** The browser refused the tab, so the person presses the link themselves. */
  blocked?: boolean
  closedAt?: number
  reason?: 'closed' | 'timeout' | 'error' | 'opener'
  message?: string
}

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
  /** Sign-ins in progress, by app slug. */
  const [flights, setFlights] = useState<Record<string, Flight>>({})
  const flightsRef = useRef(flights)
  flightsRef.current = flights
  const connectRef = useRef<(app: ComposioApp) => void>(() => {})
  const lastPollRef = useRef(0)
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

  // Follow every sign-in in progress. Each second: a closed window and a timeout
  // are noticed at once; the accounts are read every POLL_MS and a new account
  // for the app ends the flight as connected.
  const connectingKey = Object.values(flights).filter((f) => f.status === 'connecting').map((f) => f.app.slug).join(',')
  useEffect(() => {
    if (!connectingKey) return
    let stopped = false
    const id = window.setInterval(async () => {
      if (stopped) return
      const now = Date.now()
      const live = Object.values(flightsRef.current).filter((f) => f.status === 'connecting')
      if (!live.length) return
      for (const f of live) {
        if (f.win && f.win.closed && !f.closedAt) patchFlight(f.app.slug, { closedAt: now })
        if (now - f.since > WAIT_MS) finishFlight(f.app, 'timeout')
      }
      if (now - lastPollRef.current < POLL_MS) return
      lastPollRef.current = now
      let acc: ComposioAccount[]
      try { acc = await refreshAccounts() } catch { return }
      if (stopped) return
      for (const f of Object.values(flightsRef.current).filter((x) => x.status === 'connecting')) {
        if (acc.some((a) => isActiveAccount(a) && a.toolkit.toLowerCase() === f.app.slug)) {
          succeedFlight(f.app.slug)
          f.win?.close()
        } else if (f.closedAt && now - f.closedAt >= CLOSED_GRACE_MS) {
          finishFlight(f.app, 'closed')
        }
      }
    }, 1000)
    return () => { stopped = true; window.clearInterval(id) }
    // The effect restarts only when the set of sign-ins in progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectingKey, refreshAccounts])

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
    setFlights({})
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

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      useUI.getState().toast('Sign-in link copied', 'Paste it into the browser you are signed in to.', 'success')
    } catch {
      useUI.getState().toast('Could not copy', 'Select the link and copy it by hand.', 'warning')
    }
  }

  const patchFlight = (slug: string, patch: Partial<Flight>) => {
    setFlights((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], ...patch } } : prev))
  }

  /** The sign-in ended without a connection. Say why, in a HeroUI toast, with the next step. */
  const finishFlight = (app: ComposioApp, reason: NonNullable<Flight['reason']>, message?: string) => {
    setFlights((prev) => {
      const f = prev[app.slug]
      if (!f || f.status !== 'connecting') return prev
      return { ...prev, [app.slug]: { ...f, status: 'failed', reason, message, win: null } }
    })
    const retry = () => connectRef.current(app)
    if (reason === 'closed') {
      toast.danger('Sign-in window closed', {
        description: `${app.name} is not connected yet. Start again with a new sign-in link.`,
        actionProps: { children: 'New sign-in link', onPress: retry },
        timeout: 9000,
      })
    } else if (reason === 'timeout') {
      toast.warning('Sign-in did not finish', {
        description: 'It took longer than five minutes. Start again with a new link, or check back later: this list updates by itself when it is done.',
        actionProps: { children: 'New sign-in link', onPress: retry },
        timeout: 10000,
      })
    } else if (reason === 'opener') {
      const link = flightsRef.current[app.slug]?.link
      toast.danger('Could not open your browser', {
        description: 'No default browser could be started on this computer. Copy the sign-in link and open it in the browser you are signed in to.',
        actionProps: { children: 'Copy link', onPress: () => { if (link) void copyLink(link) } },
        timeout: 12000,
      })
    } else {
      toast.danger(`Could not connect ${app.name}`, {
        description: `${message ?? 'Composio did not return a sign-in link.'} If your browser blocked the window, try another default browser, or check back later.`,
        actionProps: { children: 'Try again', onPress: retry },
        timeout: 12000,
      })
    }
  }

  const succeedFlight = (slug: string) => {
    setFlights((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], status: 'connected', win: null } } : prev))
    window.setTimeout(() => {
      setFlights((prev) => {
        if (prev[slug]?.status !== 'connected') return prev
        const next = { ...prev }
        delete next[slug]
        return next
      })
    }, 1800)
  }

  /**
   * Start one sign-in. The app's own connection link is what matters, so it is
   * opened in one of these ways, and only one:
   *  - Desktop app (this machine runs the server): the default browser on this
   *    computer, which already holds the person's logins.
   *  - Browser tab: a tab opened on the click (a click is allowed to open a
   *    window; a window opened later is blocked). If the browser still refuses,
   *    the link is shown with an "Open sign-in" button, which the person presses.
   * The server is never asked to open a browser when the app runs on another
   * machine: that would open a page on the server, not on the person's screen.
   */
  const connect = async (app: ComposioApp) => {
    if (!hasComposioUserId()) { setError('Enter your Composio user id first. Connections are filed under it.'); return }
    if (flightsRef.current[app.slug]?.status === 'connecting') return
    setError(null)
    const local = isLocalApp()
    const win = local ? null : window.open('about:blank', '_blank')
    setFlights((prev) => ({ ...prev, [app.slug]: { app, status: 'connecting', since: Date.now(), win, link: null } }))
    lastPollRef.current = 0

    let url = ''
    try {
      url = (await startComposioConnect(app.slug)).redirectUrl
    } catch (e: any) {
      win?.close()
      finishFlight(app, 'error', String(e?.message ?? e))
      return
    }
    if (!url) { win?.close(); finishFlight(app, 'error'); return }
    patchFlight(app.slug, { link: url })

    if (local) {
      const r = await openInDefaultBrowser(url)
      if (!r.ok) finishFlight(app, 'opener', r.error)
      return
    }
    if (win && !win.closed) {
      try {
        win.opener = null
        win.location.href = url
        return
      } catch { /* the tab was refused; fall through to the button */ }
    }
    win?.close()
    patchFlight(app.slug, { win: null, blocked: true })
    setSignInLink({ name: app.name, url })
    toast.warning('Sign-in window was blocked', {
      description: `Your browser stopped the ${app.name} sign-in window. Press “Open sign-in” on the button to continue.`,
      timeout: 9000,
    })
  }
  connectRef.current = (app) => { void connect(app) }

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
                  const flight = flights[app.slug]
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
                      <div className="mt-auto pt-0.5 flex flex-col items-start gap-1">
                        {isOn ? (
                          <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Check size={11} aria-hidden /> Connected</span>
                        ) : (
                          <ConnectButton
                            flight={flight}
                            disabled={!hasComposioUserId()}
                            onConnect={() => connect(app)}
                          />
                        )}
                        {flight?.status === 'connecting' && flight.blocked && flight.link && (
                          <a href={flight.link} target="_blank" rel="noopener noreferrer"
                            className="mt-1 text-[11px] underline underline-offset-2 inline-flex items-center gap-1"
                            style={{ color: 'var(--primary)' }}>
                            Open sign-in
                          </a>
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

/**
 * The Connect button, which changes shape as the sign-in moves on:
 *  Connect → Connecting (spinner) → Connected (check), or → Failed (X in a circle).
 * Clicking Failed starts again.
 */
function ConnectButton({ flight, disabled, onConnect }: { flight?: Flight; disabled: boolean; onConnect: () => void }) {
  const status = flight?.status ?? 'idle'
  const idle = status === 'idle'
  const failed = status === 'failed'
  const color = failed ? 'var(--danger)' : status === 'connected' ? 'var(--success)' : undefined
  return (
    <motion.button
      layout
      type="button"
      aria-live="polite"
      disabled={disabled || status === 'connecting' || status === 'connected'}
      onClick={() => { if (idle || failed) onConnect() }}
      title={failed ? (flight?.message ?? 'Try again') : undefined}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-transform active:scale-95 disabled:cursor-default disabled:active:scale-100"
      style={idle ? primary : { background: 'var(--elevated)', border: `1px solid ${color ?? 'var(--surface-border)'}`, color: color ?? 'var(--text-2)' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          layout
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.16 }}
          className="inline-flex items-center gap-1.5"
        >
          {idle && 'Connect'}
          {status === 'connecting' && <><Spinner size="sm" aria-label="Connecting" /> Connecting</>}
          {status === 'connected' && <><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Connected</>}
          {failed && (
            <>
              <span className="w-[15px] h-[15px] rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: 'var(--danger)' }} aria-hidden>
                <X size={9} strokeWidth={2.6} />
              </span>
              Failed
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
