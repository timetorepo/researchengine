/**
 * Marketplace: every app Composio supports, one page per app. The list is the
 * front door: featured coding apps first, then search and categories. Each app
 * has its own page (/marketplace/:slug) that says what the assistant can do once
 * the app is connected, lists its tools as an accordion, and holds the Connect
 * button. Connecting happens here, not on Composio's website: Connect opens the
 * sign-in in a small window (or the default browser on the desktop app), and the
 * page updates by itself when it is done.
 *
 * Connections are shared by the main chat, the coding mode and the bots
 * (lib/composio/client.ts). Whose connections these are is set under "Your
 * Composio user id" below the list.
 *
 * Context7 documentation search is built in and works without a key; the
 * optional key at the bottom raises its limits.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Accordion, Button, ButtonGroup, Spinner, toast } from '@heroui/react'
import { ArrowLeft, CheckCircle2, Check, ChevronLeft, ChevronRight, Loader2, Plug, Search, Unplug, X } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import {
  checkComposio, composioIdentity, composioUserId, disconnectComposio, hasComposioUserId, isActiveAccount,
  isLocalApp, listComposioApps, listComposioTools, saveComposioKey, setComposioIdentity,
  startComposioConnect, type ComposioAccount, type ComposioApp, type ComposioTool, NeedsAppCredentialsError, clearComposioAppCredentials, saveComposioAppCredentials, COMPOSIO_OAUTH_CALLBACK, type ComposioAppCredentials, composioToolkitAuth, type ComposioAuthField,
} from '@/lib/composio/client'
import { syncConnectorAccounts } from '@/lib/composio/sync'
import { context7Configured, saveContext7Key } from '@/lib/context7/client'
import { IntegrationsPanel } from '@/components/settings/IntegrationsTab'
import { McpSection } from '@/components/marketplace/McpSection'
import { PipedreamPanel } from '@/components/marketplace/PipedreamPanel'
import { ServicesPanel } from '@/components/sidebar/ServicesPanel'
import { ConnectedServices } from '@/components/sidebar/ConnectedServices'
import { useComposioActivity, type ActivityEvent } from '@/lib/composio/activity'
import { newSignInId, openSignInInDefaultBrowser, reportSignIn, signInState } from '@/lib/signin/client'

const PAGE = 48
const CHIPS = 10
const POLL_MS = 2500
const WAIT_MS = 5 * 60_000
/** A sign-in window that closed is given this long to show up as a connected account. */
const CLOSED_GRACE_MS = 2000
/** After the provider sends the person back, the new account is expected within this time. */
const RETURN_GRACE_MS = 30_000
/** Coding and productivity apps shown first, in this order, when they are in the catalogue. */
const FEATURED = ['github', 'vercel', 'supabase', 'netlify', 'cloudflare', 'sentry', 'linear', 'notion', 'slack', 'googledrive']

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
  /** Tracks this attempt on the server (lib/signin). */
  flightId?: string
  /** When the provider sent the person back to ResearchEngine's done page. */
  returnedAt?: number
  closedAt?: number
  reason?: 'closed' | 'timeout' | 'error' | 'opener' | 'needs_credentials'
  message?: string
}

type Tab = 'apps' | 'connected' | 'builtin' | 'mcp' | 'pipedream'
type ToolKind = 'All' | 'Read' | 'Create' | 'Update' | 'Delete' | 'Other'

const muted = { color: 'var(--text-3)' } as const
const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const
const primary = { background: 'var(--primary)', color: '#fff' } as const
const card = { background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-card)' } as const
const danger = { color: 'var(--danger, #e5484d)' } as const

/** A tool's kind, from the verb in its slug (GMAIL_SEND_EMAIL → Create). */
/**
 * An app that signs in with a key, token or login, and offers no OAuth. Connect for
 * these takes the values on the app's page and never opens a sign-in window.
 */
export function isKeyApp(app: ComposioApp): boolean {
  if (app.noAuth || app.authSchemes.length === 0) return false
  return !app.authSchemes.some((s) => /oauth|dcr/i.test(s))
}

export function toolKind(slug: string): Exclude<ToolKind, 'All'> {
  const s = slug.toUpperCase()
  if (/(DELETE|REMOVE|ARCHIVE|TRASH|CLEAR|DESTROY)/.test(s)) return 'Delete'
  if (/(CREATE|ADD|SEND|INSERT|UPLOAD|DUPLICATE)/.test(s)) return 'Create'
  if (/(UPDATE|EDIT|PATCH|SET_|MOVE|RENAME|MERGE|REPLACE)/.test(s)) return 'Update'
  if (/(GET|LIST|FETCH|SEARCH|FIND|READ|QUERY|VIEW|DOWNLOAD|SHOW)/.test(s)) return 'Read'
  return 'Other'
}

/** A readable name for a tool: the API's name if it has one, otherwise the slug. */
function toolTitle(t: ComposioTool): string {
  const raw = t.name && t.name !== t.slug ? t.name : t.slug.replace(/^[A-Z0-9]+_/, '').replace(/_/g, ' ').toLowerCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function MarketplacePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const identity = useStore((s) => s.settings.composio)
  const configured = !!identity?.token
  const tab = useUI((s) => s.connectorsTab) as Tab
  const count = useUI((s) => s.connectorsCount)

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
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const appsRef = useRef<ComposioApp[] | null>(null)

  const refreshAccounts = useCallback(async (): Promise<ComposioAccount[]> => {
    const acc = await syncConnectorAccounts()
    setAccounts(acc)
    setRefreshedAt(Date.now())
    return acc
  }, [])

  const loadApps = useCallback(async (fresh = false) => {
    const list = await listComposioApps({ refresh: fresh })
    appsRef.current = list
    setApps(list)
  }, [])

  // When the page opens (or the key or identity changes), check the key and load the catalogue.
  const identityUser = identity?.accountUserId
  useEffect(() => {
    if (!configured) return
    let alive = true
    void (async () => {
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
  }, [configured, identity?.token, identityUser])

  // Follow every sign-in in progress. Each second the server's record of the sign-in
  // window is read (a closed window ends the attempt, in the browser or the default
  // browser alike), and a closed window or a timeout is noticed at once. The accounts
  // are read every POLL_MS; a new account for the app ends the flight as connected.
  const connectingKey = Object.values(flights).filter((f) => f.status === 'connecting').map((f) => f.app.slug).join(',')
  useEffect(() => {
    if (!connectingKey) return
    let stopped = false
    const reading = new Set<string>()
    const id = window.setInterval(async () => {
      if (stopped) return
      const now = Date.now()
      const live = Object.values(flightsRef.current).filter((f) => f.status === 'connecting')
      if (!live.length) return
      for (const f of live) {
        if (f.win && f.win.closed && !f.closedAt) patchFlight(f.app.slug, { closedAt: now })
        if (now - f.since > WAIT_MS) finishFlight(f.app, 'timeout')
        if (f.flightId && !reading.has(f.flightId)) {
          const flightId = f.flightId
          reading.add(flightId)
          void signInState(flightId).then((st) => {
            reading.delete(flightId)
            if (stopped) return
            const cur = flightsRef.current[f.app.slug]
            if (!cur || cur.status !== 'connecting') return
            if (st === 'closed' && !cur.closedAt) patchFlight(f.app.slug, { closedAt: Date.now() })
            if (st === 'returned' && !cur.returnedAt) patchFlight(f.app.slug, { returnedAt: Date.now() })
            if (st === 'failed') finishFlight(f.app, 'error', 'The sign-in did not finish.')
          })
        }
      }
      if (now - lastPollRef.current < POLL_MS) return
      lastPollRef.current = now
      let acc: ComposioAccount[] | null = null
      try { acc = await refreshAccounts() } catch { acc = null }
      if (stopped) return
      for (const f of Object.values(flightsRef.current).filter((x) => x.status === 'connecting')) {
        if (acc?.some((a) => isActiveAccount(a) && a.toolkit.toLowerCase() === f.app.slug)) {
          succeedFlight(f.app.slug)
          f.win?.close()
        } else if (f.closedAt && now - f.closedAt >= CLOSED_GRACE_MS) {
          finishFlight(f.app, 'closed')
        } else if (f.returnedAt && now - f.returnedAt >= RETURN_GRACE_MS) {
          finishFlight(f.app, 'error', 'The sign-in finished, but the new connection did not show up. Check the Connected tab in a moment.')
        }
      }
    }, 1000)
    return () => { stopped = true; window.clearInterval(id) }
    // The effect restarts only when the set of sign-ins in progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectingKey, refreshAccounts])

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

  /** Featured coding apps first (in FEATURED order), then the rest. Connected apps float up within each group. */
  const filtered = useMemo(() => {
    if (!apps) return []
    const needle = q.trim().toLowerCase()
    let list = apps
    if (category) list = list.filter((a) => a.categories.includes(category))
    if (needle) list = list.filter((a) => `${a.name} ${a.slug} ${a.categories.join(' ')} ${a.description}`.toLowerCase().includes(needle))
    const rank = (a: ComposioApp) => {
      const f = FEATURED.indexOf(a.slug)
      return f === -1 ? FEATURED.length : f
    }
    return [...list].sort((a, b) => Number(connected.has(b.slug)) - Number(connected.has(a.slug)) || rank(a) - rank(b))
  }, [apps, q, category, connected])

  const featured = useMemo(
    () => (apps ? FEATURED.map((s) => apps.find((a) => a.slug === s)).filter((a): a is ComposioApp => !!a) : []),
    [apps],
  )

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
    const flightId = flightsRef.current[app.slug]?.flightId
    // A closed window is already known to the server; every other end is told to it so the window closes.
    if (flightId && reason !== 'closed') reportSignIn(flightId, 'failed')
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
    const flightId = flightsRef.current[slug]?.flightId
    if (flightId) reportSignIn(flightId, 'connected')
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
  /** Key-based and no-auth apps: no window. The server answers with `connected`. */
  const connectDirect = async (app: ComposioApp, fields?: Record<string, string>) => {
    setError(null)
    setFlights((prev) => ({ ...prev, [app.slug]: { app, status: 'connecting', since: Date.now(), win: null, link: null } }))
    lastPollRef.current = 0
    try {
      const r = await startComposioConnect(app.slug, { fields })
      if (r.connected) {
        await refreshAccounts()
        succeedFlight(app.slug)
        toast.success(`${app.name} is connected`, { description: 'The AI can use it in chat and the bots now.', timeout: 6000 })
        return
      }
      finishFlight(app, 'error', 'Composio did not connect the app.')
    } catch (e: any) {
      finishFlight(app, 'error', String(e?.message ?? e))
    }
  }

  const connect = async (app: ComposioApp, fields?: Record<string, string>) => {
    if (!hasComposioUserId()) { setError('Enter your Composio user id first. Connections are filed under it.'); return }
    if (flightsRef.current[app.slug]?.status === 'connecting') return
    if (!fields && isKeyApp(app)) { openApp(app.slug); return }
    if (fields || app.noAuth) { await connectDirect(app, fields); return }
    setError(null)
    const local = isLocalApp()
    const win = local ? null : window.open('about:blank', '_blank')
    const flightId = newSignInId()
    setFlights((prev) => ({ ...prev, [app.slug]: { app, status: 'connecting', since: Date.now(), win, link: null, flightId } }))
    lastPollRef.current = 0

    let url = ''
    try {
      url = (await startComposioConnect(app.slug, { flightId })).redirectUrl ?? ''
    } catch (e: any) {
      win?.close()
      finishFlight(app, e instanceof NeedsAppCredentialsError ? 'needs_credentials' : 'error', String(e?.message ?? e))
      return
    }
    if (!url) { win?.close(); finishFlight(app, 'error'); return }
    patchFlight(app.slug, { link: url })

    if (local) {
      // The default browser opens our launch page, which holds the sign-in window and reports when it closes.
      try { await openSignInInDefaultBrowser(flightId) } catch (e: any) { finishFlight(app, 'opener', String(e?.message ?? e)) }
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
      // Announced by the sync, like every other change.
    } catch (e: any) {
      setError(`${name}: ${String(e?.message ?? e)}`)
    } finally { setBusy(null) }
  }

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
  const openApp = (s: string) => navigate(`/marketplace/${encodeURIComponent(s)}`)
  const backToList = () => navigate('/marketplace')

  const tabs: [Tab, string][] = [['apps', 'Apps'], ['connected', 'Connected'], ['pipedream', 'Pipedream'], ['builtin', 'Built in'], ['mcp', 'MCP servers']]

  // ------------------------------------------------------------------ one app
  if (slug) {
    const app = apps?.find((a) => a.slug === slug)
    const index = apps ? apps.findIndex((a) => a.slug === slug) : -1
    const prev = index > 0 && apps ? apps[index - 1] : null
    const next = apps && index >= 0 && index < apps.length - 1 ? apps[index + 1] : null
    return (
      <div className="h-full overflow-y-auto" data-marketplace-app={slug}>
        <div className="mx-auto w-full max-w-4xl px-5 py-6 md:px-8">
          <AppDetail
            key={slug}
            app={app}
            loading={apps === null && !error}
            error={error}
            configured={configured}
            account={app ? connected.get(app.slug) : undefined}
            flight={app ? flights[app.slug] : undefined}
            armed={armed}
            busy={busy}
            prev={prev}
            next={next}
            onBack={backToList}
            onOpen={openApp}
            onConnect={(a) => connect(a)}
            onConnectFields={(a, f) => connect(a, f)}
            onDisconnect={disconnect}
          />
          {signInLink && <SignInLink link={signInLink} onCopy={copyLink} />}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ list
  return (
    <div className="h-full overflow-y-auto" data-marketplace>
      <div className="mx-auto w-full max-w-5xl px-5 py-6 md:px-8 space-y-5">
        <header className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[22px] font-semibold" style={{ letterSpacing: '-0.02em' }}>
              <Plug size={18} strokeWidth={1.5} /> Marketplace
            </h1>
            <p className="text-[12.5px] mt-0.5" style={muted}>
              Connect the apps the chat, the coding mode and the bots can use. {configured ? `${count} connected.` : 'Add your Composio key once to start.'}
            </p>
          </div>
          <ButtonGroup size="sm" aria-label="Marketplace sections">
            {tabs.map(([id, label]) => (
              <Button key={id} variant={tab === id ? 'primary' : 'ghost'} onPress={() => useUI.setState({ connectorsTab: id })}>
                {label}
                {id === 'connected' && count > 0 && (
                  <span className="text-[10.5px] tabular-nums px-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>{count}</span>
                )}
              </Button>
            ))}
          </ButtonGroup>
        </header>

        {error && <p role="alert" className="text-[12px] leading-snug" style={danger}>{error}</p>}

        {tab === 'mcp' ? (
          <McpSection />
        ) : tab === 'pipedream' ? (
          <PipedreamPanel />
        ) : tab === 'connected' ? (
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
            <Button variant="primary" size="sm" onPress={() => void saveKey()} isDisabled={busy === 'key'}>
              {busy === 'key' && <Loader2 size={13} className="animate-spin" />} Save key
            </Button>
            <div className="pt-2">
              <Context7Row />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
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
                <Button size="sm" variant="primary" onPress={() => void saveKey()} isDisabled={!keyDraft.trim() || busy === 'key'}>Replace</Button>
              </div>
              <div className="flex items-center gap-3 pt-0.5">
                <button type="button" onClick={checkKeyNow} disabled={checking}
                  className="text-[11px] underline underline-offset-2 inline-flex items-center gap-1" style={muted}>
                  {checking && <Loader2 size={11} className="animate-spin" />} Check key
                </button>
                <button type="button" onClick={removeKey}
                  className="text-[11px] underline underline-offset-2" style={armed === 'key' ? danger : muted}>
                  {armed === 'key' ? 'Press again to remove the key' : 'Remove key'}
                </button>
              </div>
            </div>

            {/* Your Composio user id: connections are filed under it. */}
            <div className="rounded-[12px] p-3 space-y-2" style={field}>
              <label className="block text-[11px]" style={muted} htmlFor="composio-user-id">
                Your Composio user id. Connections you make here are filed under it, and the ones in your Composio dashboard show up here too.
              </label>
              <div className="flex gap-1.5">
                <input id="composio-user-id" value={idDraft} onChange={(e) => { setIdDraft(e.target.value); setIdError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveUserId() }}
                  placeholder="e.g. you@example.com" autoComplete="off"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                <Button size="sm" variant="primary" onPress={saveUserId}>{hasComposioUserId() ? 'Save' : 'Use'}</Button>
              </div>
              {idError && <p role="alert" className="text-[11px]" style={danger}>{idError}</p>}
              {!hasComposioUserId() && !idError && (
                <p className="text-[11px]" style={muted}>Connect is available once this is set.</p>
              )}
            </div>

            {signInLink && <SignInLink link={signInLink} onCopy={copyLink} />}

            {apps === null && !error && (
              <div className="text-[12px] inline-flex items-center gap-1.5" style={muted}><Loader2 size={13} className="animate-spin" /> Loading apps</div>
            )}

            {featured.length > 0 && !q && !category && (
              <section aria-label="Ready for coding" className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-semibold">Ready for coding</h2>
                  <span className="text-[11px]" style={muted}>Connect once; the coding mode can use them too.</span>
                </div>
                <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {featured.map((app) => (
                    <AppCard key={app.slug} app={app} isOn={connected.has(app.slug)} flight={flights[app.slug]}
                      onOpen={openApp} onConnect={connect} compact />
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1">
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
              <Button size="sm" variant="ghost" onPress={() => void refreshAll()} isDisabled={refreshing}>
                {refreshing && <Loader2 size={11} className="animate-spin" />} Refresh list
              </Button>
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

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" aria-label="Supported apps">
              {filtered.slice(0, shown).map((app) => (
                <AppCard key={app.slug} app={app} isOn={connected.has(app.slug)} flight={flights[app.slug]}
                  onOpen={openApp} onConnect={connect} />
              ))}
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
      </div>
    </div>
  )
}

function SignInLink({ link, onCopy }: { link: { name: string; url: string }; onCopy: (url: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px]">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>
        Open the sign-in page for {link.name}
      </a>
      <button type="button" onClick={() => void onCopy(link.url)} className="underline underline-offset-2" style={{ color: 'var(--text-2)' }}>
        Copy link
      </button>
    </div>
  )
}

/** One app in a grid. The whole card opens its page; the Connect button does not. */
function AppCard({ app, isOn, flight, onOpen, onConnect, compact = false }: {
  app: ComposioApp; isOn: boolean; flight?: Flight; onOpen: (slug: string) => void; onConnect: (app: ComposioApp) => void; compact?: boolean
}) {
  return (
    <li className="min-w-0">
      <div
        role="link"
        tabIndex={0}
        aria-label={`${app.name}, open`}
        onClick={() => onOpen(app.slug)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(app.slug) }}
        className="h-full flex flex-col gap-2 p-3 rounded-[14px] min-w-0 cursor-pointer transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-[var(--elevated)] focus-visible:outline-none focus-visible:ring-2"
        style={{ ...card, ['--tw-ring-color' as string]: 'var(--primary)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {app.logo
            ? <img src={app.logo} alt="" width={20} height={20} loading="lazy" className="rounded-[6px] shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            : <span className="w-5 h-5 rounded-[6px] shrink-0 flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{app.name.charAt(0)}</span>}
          <span className="text-[13px] font-medium truncate" title={app.name}>{app.name}</span>
        </div>
        {!compact && app.description && (
          <span className="text-[11.5px] leading-snug line-clamp-2" style={muted}>{app.description}</span>
        )}
        <div className="mt-auto pt-1 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {isOn ? (
            <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Check size={11} aria-hidden /> Connected</span>
          ) : (
            <span className="flex items-center gap-2 flex-wrap">
              <ConnectButton flight={flight} disabled={!hasComposioUserId()} onConnect={() => onConnect(app)} />
              {flight?.status === 'connecting' && flight.blocked && flight.link && (
                <a href={flight.link} target="_blank" rel="noopener noreferrer" className="text-[11px] underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                  Open sign-in
                </a>
              )}
            </span>
          )}
          <span className="text-[10.5px] shrink-0" style={muted}>{app.toolsCount} tools</span>
        </div>
      </div>
    </li>
  )
}

/** One app's page: what the assistant can do, its tools as an accordion, and Connect. */
function AppDetail({
  app, loading, error, configured, account, flight, armed, busy, prev, next,
  onBack, onOpen, onConnect, onConnectFields, onDisconnect,
}: {
  app: ComposioApp | undefined
  loading: boolean
  error: string | null
  configured: boolean
  account: ComposioAccount | undefined
  flight: Flight | undefined
  armed: string | null
  busy: string | null
  prev: ComposioApp | null
  next: ComposioApp | null
  onBack: () => void
  onOpen: (slug: string) => void
  onConnect: (app: ComposioApp) => void
  onConnectFields: (app: ComposioApp, fields: Record<string, string>) => void
  onDisconnect: (acc: ComposioAccount, name: string) => void
}) {
  const [tools, setTools] = useState<ComposioTool[] | null>(null)
  const [toolError, setToolError] = useState<string | null>(null)
  const [kind, setKind] = useState<ToolKind>('All')
  const [tq, setTq] = useState('')
  const [expanded, setExpanded] = useState(false)

  const slug = app?.slug
  useEffect(() => {
    if (!slug || !configured) return
    let alive = true
    setTools(null)
    setToolError(null)
    listComposioTools(slug)
      .then((list) => { if (alive) setTools(list) })
      .catch((e: any) => { if (alive) { setToolError(String(e?.message ?? e)); setTools([]) } })
    return () => { alive = false }
  }, [slug, configured])

  const counts = useMemo(() => {
    const n: Record<ToolKind, number> = { All: 0, Read: 0, Create: 0, Update: 0, Delete: 0, Other: 0 }
    for (const t of tools ?? []) { n.All += 1; n[toolKind(t.slug)] += 1 }
    return n
  }, [tools])

  const visible = useMemo(() => {
    const needle = tq.trim().toLowerCase()
    return (tools ?? []).filter((t) =>
      (kind === 'All' || toolKind(t.slug) === kind) &&
      (!needle || `${toolTitle(t)} ${t.slug} ${t.description}`.toLowerCase().includes(needle)))
  }, [tools, kind, tq])

  if (loading) {
    return <div className="text-[12px] inline-flex items-center gap-1.5 py-10" style={muted}><Loader2 size={13} className="animate-spin" /> Loading app</div>
  }

  if (!app) {
    return (
      <div className="space-y-4 py-6">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
          <ArrowLeft size={14} /> Marketplace
        </button>
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
          {configured ? 'That app is not in the catalogue.' : 'Add your Composio key on the Marketplace page first.'}
        </p>
        {error && <p role="alert" className="text-[12px]" style={danger}>{error}</p>}
      </div>
    )
  }

  const isOn = !!account
  const long = app.description.length > 180
  const kinds: ToolKind[] = ['All', 'Read', 'Create', 'Update', 'Delete', 'Other']

  return (
    <div className="space-y-6">
      {isKeyApp(app)
        ? (!isOn && <KeyPanel app={app} flight={flight} onConnect={(f) => onConnectFields(app, f)} />)
        : <OwnAppPanel app={app} needed={flight?.reason === 'needs_credentials'} onConnect={() => onConnect(app)} />}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] hover:opacity-80" style={{ color: 'var(--text-2)' }}>
          <ArrowLeft size={14} /> Marketplace
        </button>
        <ButtonGroup size="sm" aria-label="Browse apps">
          <Button variant="ghost" isIconOnly aria-label={prev ? `Previous: ${prev.name}` : 'No previous app'} isDisabled={!prev} onPress={() => prev && onOpen(prev.slug)}>
            <ChevronLeft size={15} />
          </Button>
          <Button variant="ghost" isIconOnly aria-label={next ? `Next: ${next.name}` : 'No next app'} isDisabled={!next} onPress={() => next && onOpen(next.slug)}>
            <ChevronRight size={15} />
          </Button>
        </ButtonGroup>
      </div>

      {/* App header: logo, name, what it is, and the one Connect action. */}
      <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        className="p-5 flex flex-col gap-4 sm:flex-row sm:items-start" style={card}>
        {app.logo
          ? <img src={app.logo} alt="" width={52} height={52} className="rounded-[14px] shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          : <span className="w-[52px] h-[52px] rounded-[14px] shrink-0 flex items-center justify-center text-[20px] font-semibold" style={{ background: 'var(--elevated)' }}>{app.name.charAt(0)}</span>}
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-[22px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{app.name}</h1>
          <div className="flex flex-wrap gap-1.5">
            {app.categories.slice(0, 4).map((c) => (
              <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{c}</span>
            ))}
          </div>
          {app.description && (
            <p className={`text-[13px] leading-relaxed ${long && !expanded ? 'line-clamp-2' : ''}`} style={{ color: 'var(--text-2)' }}>{app.description}</p>
          )}
          <div className="flex items-center gap-3 text-[11.5px]" style={muted}>
            <span>{app.toolsCount} tools</span>
            {app.authSchemes.length > 0 && <span>Sign-in: {app.authSchemes.join(', ').toLowerCase()}</span>}
            {long && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
          {isOn ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' }}>
                <CheckCircle2 size={14} aria-hidden /> Connected
              </span>
              <button type="button" onClick={() => onDisconnect(account!, app.name)} disabled={busy === account!.id}
                className="text-[11.5px] underline underline-offset-2 inline-flex items-center gap-1" style={armed === account!.id ? danger : muted}>
                {busy === account!.id ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
                {armed === account!.id ? 'Press again to disconnect' : 'Disconnect'}
              </button>
            </>
          ) : (
            <>
              <ConnectButton size="lg" flight={flight} disabled={!hasComposioUserId()} onConnect={() => onConnect(app)} />
              {flight?.status === 'connecting' && flight.blocked && flight.link && (
                <a href={flight.link} target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                  Open sign-in
                </a>
              )}
              {!hasComposioUserId() && <span className="text-[11px]" style={muted}>Set your Composio user id on the Marketplace page first.</span>}
            </>
          )}
        </div>
      </motion.section>

      {/* What it adds to the assistant, in plain words. */}
      <section className="p-4" style={card} aria-label="What the assistant can do">
        <h2 className="text-[13px] font-semibold mb-1">What the assistant can do</h2>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {isOn
            ? `${app.name} is connected. The chat, the coding mode and the bots can use its tools below when you ask for something in ${app.name}. Results show as cards, not raw data.`
            : `Once ${app.name} is connected, the chat, the coding mode and the bots can use its tools below, for example when you ask them to look something up or make a change in ${app.name}. Results show as cards, not raw data.`}
        </p>
      </section>

      {/* Tools: search, kind filter, and one row per tool. */}
      <section className="space-y-3" aria-label="Tools">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-[15px] font-semibold">Tools{tools ? <span className="ml-2 text-[12px] font-normal" style={muted}>{tools.length}</span> : null}</h2>
          <div className="relative md:w-72">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
            <input value={tq} onChange={(e) => setTq(e.target.value)} aria-label="Search tools"
              placeholder="Search tools" className="w-full pl-8 pr-3 py-2 rounded-[12px] text-[12.5px] outline-none" style={field} />
          </div>
        </div>

        {configured && (
          <ButtonGroup size="sm" aria-label="Filter tools by kind" className="flex-wrap">
            {kinds.map((k) => (
              <Button key={k} variant={kind === k ? 'primary' : 'ghost'} onPress={() => setKind(k)} isDisabled={k !== 'All' && counts[k] === 0}>
                {k}
                {tools && <span className="text-[10.5px] tabular-nums opacity-80">{counts[k]}</span>}
              </Button>
            ))}
          </ButtonGroup>
        )}

        {!configured ? (
          <p className="text-[12.5px]" style={muted}>Add your Composio key on the Marketplace page to see the tools.</p>
        ) : tools === null ? (
          <div className="text-[12px] inline-flex items-center gap-1.5 py-4" style={muted}><Loader2 size={13} className="animate-spin" /> Loading tools</div>
        ) : toolError ? (
          <p role="alert" className="text-[12px]" style={danger}>Could not load the tools: {toolError}</p>
        ) : tools.length === 0 ? (
          <p className="text-[12.5px]" style={muted}>No tools are listed for {app.name} yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-[12.5px]" style={muted}>No tool matches{tq ? ` “${tq}”` : ' this filter'}.</p>
        ) : (
          <div className="rounded-[14px] overflow-hidden" style={card}>
        <Accordion allowsMultipleExpanded>
            {visible.slice(0, 200).map((t) => (
              <Accordion.Item key={t.slug} id={t.slug} className="px-4 border-b last:border-b-0 border-[var(--surface-border)]">
                <Accordion.Heading>
                  <Accordion.Trigger className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{toolTitle(t)}</span>
                      {t.description && <span className="block text-[11.5px] truncate" style={muted}>{t.description}</span>}
                    </span>
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{toolKind(t.slug)}</span>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="pb-4 space-y-2">
                    {t.description && <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t.description}</p>}
                    <p className="text-[11px] font-mono" style={muted}>{t.slug}</p>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
        )}
      </section>
    </div>
  )
}

/** Documentation search. On by default with no setup; the key is optional. */
/**
 * The values a key-based app asks for (an API key, a token, a region …), read from
 * Composio's toolkit metadata. They are sent to Composio with the connect request and
 * are not kept on this device.
 */
function KeyPanel({ app, flight, onConnect }: { app: ComposioApp; flight?: Flight; onConnect: (fields: Record<string, string>) => void }) {
  const [fields, setFields] = useState<ComposioAuthField[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loadErr, setLoadErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    composioToolkitAuth(app.slug)
      .then((a) => {
        if (!alive) return
        setFields(a.keyFields.length ? a.keyFields : [{ name: 'generic_api_key', label: 'API key', description: '', secret: true }])
      })
      .catch((e: any) => { if (alive) setLoadErr(String(e?.message ?? e)) })
    return () => { alive = false }
  }, [app.slug])

  const busy = flight?.status === 'connecting'
  const ready = !!fields && fields.every((f) => (values[f.name] ?? '').trim())
  const submit = () => {
    if (!fields) return
    const out: Record<string, string> = {}
    for (const f of fields) out[f.name] = (values[f.name] ?? '').trim()
    onConnect(out)
  }

  return (
    <section className="rounded-[14px] p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} aria-label={`Connect ${app.name} with a key`}>
      <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>Connect {app.name} with a key</div>
      <p className="text-[11.5px] leading-snug" style={muted}>
        {app.name} does not use a sign-in window. Enter the key it gives you. The key is sent to Composio, which keeps it on your connected account. Research Engine does not save it on this device.
      </p>
      {loadErr && <p role="alert" className="text-[11.5px]" style={danger}>{loadErr}</p>}
      {!fields && !loadErr && <p className="text-[11.5px]" style={muted}>Loading the fields…</p>}
      {fields && (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className="space-y-1">
              <span className="text-[11px]" style={muted}>{f.label}</span>
              <input type={f.secret ? 'password' : 'text'} autoComplete="off" value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                aria-label={f.label} placeholder={f.description || f.label}
                className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
            </label>
          ))}
        </div>
      )}
      {flight?.status === 'failed' && flight.message && <p role="alert" className="text-[11.5px]" style={danger}>{flight.message}</p>}
      <button type="button" disabled={!ready || busy} onClick={submit}
        className="px-3 py-1.5 rounded-full text-[11.5px] font-medium disabled:opacity-50" style={primary}>
        {busy ? 'Connecting…' : `Connect ${app.name}`}
      </button>
    </section>
  )
}

/** Where the person creates a developer app, for toolkits that need one. */
const APP_PORTALS: Record<string, { label: string; url: string }> = {
  spotify: { label: 'Spotify developer dashboard', url: 'https://developer.spotify.com/dashboard' },
}

/**
 * The person's own developer app for one toolkit. Opens by itself when a connect is
 * refused because Composio has no managed sign-in for the app (Spotify, for example).
 * The secret is saved encrypted on this device and sent only with the connect request.
 */
function OwnAppPanel({ app, needed, onConnect }: { app: ComposioApp; needed: boolean; onConnect: () => void }) {
  const saved = useStore((s) => s.settings.composio?.apps?.[app.slug])
  const [open, setOpen] = useState(needed || !!saved)
  const [clientId, setClientId] = useState(saved?.clientId ?? '')
  const [secret, setSecret] = useState('')
  const [scopes, setScopes] = useState(saved?.scopes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (needed) setOpen(true) }, [needed])
  const portal = APP_PORTALS[app.slug]

  const save = async (connectAfter: boolean) => {
    setErr(null)
    setBusy(true)
    try {
      const problem = await saveComposioAppCredentials(app.slug, { clientId, clientSecret: secret, scopes })
      if (problem) { setErr(problem); return }
      setSecret('')
      toast.success(`${app.name} app saved`, { description: 'It is kept encrypted on this device.', timeout: 4000 })
      if (connectAfter) onConnect()
    } catch (e: any) {
      setErr(String(e?.message ?? e))
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-[14px] p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} aria-label={`Your own ${app.name} app`}>
      <Accordion expandedKeys={open ? new Set(['own-app']) : new Set<string>()}
        onExpandedChange={(keys) => setOpen(keys.has('own-app'))}>
        <Accordion.Item id="own-app" className="border-0">
          <Accordion.Heading>
            <Accordion.Trigger className="flex w-full items-center gap-2 py-0 text-left">
              <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                {needed ? `${app.name} needs your own developer app` : `Use your own ${app.name} developer app`}
                {saved && <span className="ml-2 text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>Saved</span>}
              </span>
              <Accordion.Indicator style={{ color: 'var(--text-3)' }} />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="space-y-3 px-0 pt-3 pb-0">
          <ol className="text-[11.5px] leading-snug list-decimal pl-4 space-y-1" style={muted}>
            <li>
              Create an app in the {portal ? <a href={portal.url} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--primary)' }}>{portal.label}</a> : `${app.name} developer portal`}.
            </li>
            <li>Add this redirect URI: <code className="break-all select-all" style={{ color: 'var(--text-2)' }}>{COMPOSIO_OAUTH_CALLBACK}</code></li>
            <li>Paste the client ID and client secret below. Scopes are optional; leave them empty to use Composio's defaults.</li>
          </ol>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={clientId} onChange={(e) => { setClientId(e.target.value); setErr(null) }} autoComplete="off"
              aria-label={`${app.name} client ID`} placeholder="Client ID"
              className="px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
            <input type="password" value={secret} onChange={(e) => { setSecret(e.target.value); setErr(null) }} autoComplete="off"
              aria-label={`${app.name} client secret`} placeholder={saved ? 'Client secret (leave blank to keep)' : 'Client secret'}
              className="px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
          </div>
          <input value={scopes} onChange={(e) => setScopes(e.target.value)} autoComplete="off"
            aria-label={`${app.name} scopes (optional)`} placeholder="Scopes, comma-separated (optional)"
            className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
          {err && <p role="alert" className="text-[11.5px]" style={danger}>{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !clientId.trim() || (!secret.trim() && !saved)} onClick={() => save(true)}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-medium disabled:opacity-50" style={primary}>
              Save and connect
            </button>
            <button type="button" disabled={busy || !clientId.trim() || !secret.trim()} onClick={() => save(false)}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-medium disabled:opacity-50" style={field}>
              Save only
            </button>
            {saved && (
              <button type="button" onClick={() => { clearComposioAppCredentials(app.slug); setClientId(''); setSecret(''); setScopes(''); toast('Developer app removed', { timeout: 3000 }) }}
                className="px-3 py-1.5 rounded-full text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                Remove
              </button>
            )}
          </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </section>
  )
}

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
function ConnectButton({ flight, disabled, onConnect, size = 'sm' }: { flight?: Flight; disabled: boolean; onConnect: () => void; size?: 'sm' | 'lg' }) {
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
      className={`${size === 'lg' ? 'px-4 py-2 text-[13px] gap-2' : 'px-2.5 py-1 text-[11px] gap-1.5'} rounded-full font-medium inline-flex items-center transition-transform active:scale-95 disabled:cursor-default disabled:active:scale-100`}
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
