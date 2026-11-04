/**
 * Pipedream Connect, as a Marketplace section. The person's own Pipedream OAuth client
 * and project are saved once (encrypted when the vault is on). Apps are listed from
 * Pipedream's catalogue; connecting uses the same sign-in tracker as Composio: the
 * window closing fails the attempt with a toast, and a finished sign-in closes its window.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonGroup, Spinner, toast } from '@heroui/react'
import { CheckCircle2, Plug, Search, Unplug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { isLocalApp } from '@/lib/composio/client'
import {
  checkPipedream, clearPipedreamCredentials, listPipedreamAccounts, listPipedreamApps, pipedreamProblem,
  removePipedreamAccount, savePipedreamCredentials, savedPipedreamCredentials, startPipedreamConnect,
  type PipedreamAccount, type PipedreamApp, type PipedreamEnvironment,
} from '@/lib/pipedream/client'
import { openSignInInDefaultBrowser, providerFailureMessage, reportSignIn, signInDetail } from '@/lib/signin/client'

const POLL_MS = 2500
const WAIT_MS = 5 * 60_000
const CLOSED_GRACE_MS = 2000
const RETURN_GRACE_MS = 30_000

const muted = { color: 'var(--text-3)' } as const
const field = { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' } as const

interface Attempt {
  app: PipedreamApp
  flightId: string
  since: number
  win: Window | null
  link: string
  closedAt?: number
  returnedAt?: number
}

export function PipedreamPanel() {
  const configured = useStore((s) => !!s.settings.pipedream?.token)
  const [editing, setEditing] = useState(false)
  return (
    <section className="space-y-4" aria-label="Pipedream">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          <Plug size={15} strokeWidth={1.5} /> Pipedream
        </h2>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Connect apps through Pipedream Connect. Your OAuth client stays on this device (encrypted when the vault is on) and is sent to our server only for each request.
        </p>
      </header>
      {configured && !editing ? (
        <PipedreamWorkspace onEdit={() => setEditing(true)} />
      ) : (
        <PipedreamSetup onSaved={() => setEditing(false)} onCancel={configured ? () => setEditing(false) : undefined} />
      )}
    </section>
  )
}

// ------------------------------------------------------------------ setup

function PipedreamSetup({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [projectId, setProjectId] = useState('')
  const [environment, setEnvironment] = useState<PipedreamEnvironment>('development')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void savedPipedreamCredentials().then((c) => {
      if (!alive || !c) return
      setClientId(c.clientId)
      setProjectId(c.projectId)
      setEnvironment(c.environment)
    })
    return () => { alive = false }
  }, [])

  const save = async () => {
    // A blank secret keeps the one already saved, so the person need not paste it again.
    const saved = await savedPipedreamCredentials()
    const secret = clientSecret.trim() || saved?.clientSecret || ''
    const p = pipedreamProblem({ clientId, clientSecret: secret, projectId, environment })
    if (p) { setProblem(p); return }
    setBusy(true)
    setProblem(null)
    setNotice(null)
    try {
      await savePipedreamCredentials({ clientId, clientSecret: secret, projectId, environment })
      setClientSecret('')
      const res = await checkPipedream()
      if (!res.ok) {
        setProblem(res.error ?? 'Pipedream did not accept these credentials. They are saved; check them and save again.')
        return
      }
      setNotice('Pipedream is connected. Your credentials are saved on this device.')
      toast.success('Pipedream connected', { timeout: 3500 })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <ol className="text-[12px] leading-relaxed list-decimal pl-4 space-y-1" style={muted}>
        <li>Open your workspace’s <a href="https://pipedream.com/settings/api" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--primary)' }}>API settings</a> and create an OAuth client. Copy the client ID and the client secret.</li>
        <li>Open your <a href="https://pipedream.com/projects" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--primary)' }}>projects</a> and copy the project ID from its Settings tab (it starts with proj_).</li>
        <li>Paste them below. Use development while you try things out.</li>
      </ol>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={clientId} onChange={(e) => { setClientId(e.target.value); setProblem(null) }} autoComplete="off"
          aria-label="Pipedream client ID" placeholder="Client ID"
          className="px-3 py-2 rounded-[12px] text-[13px] outline-none" style={field} />
        <input type="password" value={clientSecret} onChange={(e) => { setClientSecret(e.target.value); setProblem(null) }} autoComplete="off"
          aria-label="Pipedream client secret" placeholder="Client secret"
          className="px-3 py-2 rounded-[12px] text-[13px] outline-none" style={field} />
        <input value={projectId} onChange={(e) => { setProjectId(e.target.value); setProblem(null) }} autoComplete="off"
          aria-label="Pipedream project ID" placeholder="Project ID (proj_…)"
          className="px-3 py-2 rounded-[12px] text-[13px] outline-none sm:col-span-2" style={field} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonGroup size="sm" aria-label="Pipedream environment">
          {(['development', 'production'] as const).map((env) => (
            <Button key={env} variant={environment === env ? 'primary' : 'ghost'} onPress={() => setEnvironment(env)}>
              {env === 'development' ? 'Development' : 'Production'}
            </Button>
          ))}
        </ButtonGroup>
        <Button size="sm" variant="primary" isDisabled={busy || !clientId.trim() || !projectId.trim()} onPress={() => void save()}>
          {busy ? <Spinner size="sm" /> : null}
          Save and check
        </Button>
        {onCancel && <Button size="sm" variant="ghost" onPress={onCancel}>Cancel</Button>}
      </div>
      {problem && <InlineAlert status="danger" title="Pipedream did not accept these credentials">{problem}</InlineAlert>}
      {notice && <InlineAlert status="success" title="Saved" onClose={() => setNotice(null)}>{notice}</InlineAlert>}
    </div>
  )
}

// ------------------------------------------------------------------ connected workspace

function PipedreamWorkspace({ onEdit }: { onEdit: () => void }) {
  const [apps, setApps] = useState<PipedreamApp[] | null>(null)
  const [accounts, setAccounts] = useState<PipedreamAccount[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({})
  const [armed, setArmed] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const attemptsRef = useRef(attempts)
  attemptsRef.current = attempts
  const lastPollRef = useRef(0)

  const refreshAccounts = async (): Promise<PipedreamAccount[] | null> => {
    try {
      const list = await listPipedreamAccounts()
      setAccounts(list)
      return list
    } catch (e: any) {
      setError(String(e?.message ?? e))
      return null
    }
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      const status = await checkPipedream()
      if (!alive) return
      if (!status.ok) { setError(status.error ?? 'Pipedream did not accept the saved credentials.'); return }
      await refreshAccounts()
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The catalogue follows the search box. Typing waits a moment before it asks.
  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => {
      listPipedreamApps(query)
        .then((list) => { if (alive) { setApps(list); setError(null) } })
        .catch((e) => { if (alive) setError(String(e?.message ?? e)) })
    }, query ? 300 : 0)
    return () => { alive = false; window.clearTimeout(id) }
  }, [query])

  const connectingKey = Object.keys(attempts).sort().join(',')
  useEffect(() => {
    if (!connectingKey) return
    let stopped = false
    const reading = new Set<string>()
    const id = window.setInterval(async () => {
      if (stopped) return
      const now = Date.now()
      const live = Object.values(attemptsRef.current)
      if (!live.length) return
      for (const a of live) {
        if (a.win && a.win.closed && !a.closedAt) patch(a.app.slug, { closedAt: now })
        if (now - a.since > WAIT_MS) finish(a.app, 'timeout')
        if (!reading.has(a.flightId)) {
          reading.add(a.flightId)
          void signInDetail(a.flightId).then(({ state: st, reason }) => {
            reading.delete(a.flightId)
            const cur = attemptsRef.current[a.app.slug]
            if (stopped || !cur) return
            if (st === 'closed' && !cur.closedAt) patch(a.app.slug, { closedAt: Date.now() })
            if (st === 'returned' && !cur.returnedAt) patch(a.app.slug, { returnedAt: Date.now() })
            // The provider's own error address: say why, now, rather than waiting out the grace period.
            if (st === 'failed') finish(a.app, 'error', providerFailureMessage(a.app.name, reason))
          })
        }
      }
      if (now - lastPollRef.current < POLL_MS) return
      lastPollRef.current = now
      const acc = await refreshAccounts()
      if (stopped) return
      for (const a of Object.values(attemptsRef.current)) {
        if (acc?.some((x) => x.healthy && x.app === a.app.slug)) {
          reportSignIn(a.flightId, 'connected')
          a.win?.close()
          drop(a.app.slug)
          toast.success(`${a.app.name} connected`, { timeout: 4000 })
        } else if (a.closedAt && now - a.closedAt >= CLOSED_GRACE_MS) {
          finish(a.app, 'closed')
        } else if (a.returnedAt && now - a.returnedAt >= RETURN_GRACE_MS) {
          finish(a.app, 'error', 'The sign-in finished, but the connection did not show up. Check the list in a moment.')
        }
      }
    }, 1000)
    return () => { stopped = true; window.clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectingKey])

  function patch(slug: string, p: Partial<Attempt>) {
    setAttempts((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], ...p } } : prev))
  }
  function drop(slug: string) {
    setAttempts((prev) => { const next = { ...prev }; delete next[slug]; return next })
  }
  function finish(app: PipedreamApp, reason: 'closed' | 'timeout' | 'error' | 'opener', message?: string) {
    const a = attemptsRef.current[app.slug]
    if (!a) return
    if (reason !== 'closed') reportSignIn(a.flightId, 'failed')
    drop(app.slug)
    const retry = () => void connect(app)
    if (reason === 'closed') {
      toast.danger('Sign-in window closed', {
        description: `${app.name} is not connected yet. Start again to get a new sign-in window.`,
        actionProps: { children: 'Start again', onPress: retry }, timeout: 9000,
      })
    } else if (reason === 'timeout') {
      toast.warning('Sign-in did not finish', {
        description: 'It took longer than five minutes. Start again when you are ready.',
        actionProps: { children: 'Start again', onPress: retry }, timeout: 10000,
      })
    } else if (reason === 'opener') {
      toast.danger('Could not open your browser', { description: message ?? 'Open the sign-in link by hand.', timeout: 10000 })
    } else {
      toast.danger(`Could not connect ${app.name}`, {
        description: message ?? 'Pipedream did not finish the connection.',
        actionProps: { children: 'Try again', onPress: retry }, timeout: 11000,
      })
    }
  }

  async function connect(app: PipedreamApp) {
    if (attemptsRef.current[app.slug]) return
    setError(null)
    const local = isLocalApp()
    const win = local ? null : window.open('about:blank', '_blank')
    try {
      const { flightId, connectUrl } = await startPipedreamConnect(app.slug)
      setAttempts((prev) => ({ ...prev, [app.slug]: { app, flightId, since: Date.now(), win, link: connectUrl } }))
      lastPollRef.current = 0
      if (local) {
        // The default browser opens our launch page, which holds the sign-in window.
        await openSignInInDefaultBrowser(flightId)
      } else if (win && !win.closed) {
        try { win.opener = null; win.location.href = connectUrl } catch { /* the tab was refused; the card keeps the link */ }
      } else {
        win?.close()
      }
    } catch (e: any) {
      win?.close()
      drop(app.slug)
      setError(String(e?.message ?? e))
      toast.danger(`Could not connect ${app.name}`, { description: String(e?.message ?? e), timeout: 9000 })
    }
  }

  async function disconnect(acc: PipedreamAccount) {
    if (armed !== acc.id) { setArmed(acc.id); return }
    setArmed(null)
    setBusy(acc.id)
    try {
      await removePipedreamAccount(acc.id)
      await refreshAccounts()
      toast('Disconnected', { description: `${acc.name || acc.app} is no longer connected.`, timeout: 3500 })
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally { setBusy(null) }
  }

  const connected = useMemo(() => new Map(accounts.filter((a) => a.healthy).map((a) => [a.app, a])), [accounts])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px]" style={muted}>
          <CheckCircle2 size={13} /> {connected.size} connected
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onPress={onEdit}>Change credentials</Button>
        <Button size="sm" variant="ghost" onPress={() => { clearPipedreamCredentials(); toast('Pipedream credentials removed', { timeout: 3000 }) }}>
          Remove
        </Button>
      </div>

      {error && <InlineAlert status="danger" title="Pipedream">{error}</InlineAlert>}

      {accounts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[12px] font-medium uppercase tracking-wide" style={muted}>Connected</h3>
          <ul className="space-y-1.5">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex items-center gap-3 px-3 py-2 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--text)' }}>{acc.name || acc.app}</span>
                {!acc.healthy && <span className="text-[11px]" style={{ color: 'var(--warning)' }}>Needs attention</span>}
                <Button size="sm" variant="ghost" isDisabled={busy === acc.id} onPress={() => void disconnect(acc)}>
                  <Unplug size={13} /> {armed === acc.id ? 'Confirm disconnect' : 'Disconnect'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.values(attempts).length > 0 && (
        <div className="space-y-2">
          {Object.values(attempts).map((a) => (
            <div key={a.flightId} role="status" className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <Spinner size="sm" />
              <span className="flex-1 text-[13px]" style={{ color: 'var(--text)' }}>Waiting for the sign-in to {a.app.name}…</span>
              <a href={a.link} target="_blank" rel="noreferrer" className="text-[12px] underline" style={{ color: 'var(--primary)' }}>Open sign-in link</a>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 px-3 py-2 rounded-[12px]" style={field}>
          <Search size={14} style={muted} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Pipedream apps"
            aria-label="Search Pipedream apps" className="flex-1 bg-transparent text-[13px] outline-none" />
        </label>
        {apps === null ? (
          <div className="flex items-center gap-2 text-[12.5px]" style={muted}><Spinner size="sm" /> Loading apps…</div>
        ) : apps.length === 0 ? (
          <p className="text-[12.5px]" style={muted}>No apps match “{query}”.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Pipedream apps">
            {apps.map((app) => {
              const acc = connected.get(app.slug)
              const pending = attempts[app.slug]
              return (
                <li key={app.slug} className="flex items-center gap-3 px-3 py-2.5 rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  {app.imgSrc ? <img src={app.imgSrc} alt="" width={28} height={28} className="rounded-[8px] shrink-0" loading="lazy" /> : (
                    <span className="w-7 h-7 rounded-[8px] grid place-items-center text-[12px] font-semibold shrink-0" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{app.name.slice(0, 1)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{app.name}</div>
                    <div className="text-[11.5px] truncate" style={muted}>{app.description || app.categories.join(' · ')}</div>
                  </div>
                  {acc ? (
                    <span className="text-[12px] inline-flex items-center gap-1" style={{ color: 'var(--success)' }}><CheckCircle2 size={13} /> Connected</span>
                  ) : (
                    <Button size="sm" variant="primary" isDisabled={!!pending} onPress={() => void connect(app)}>
                      {pending ? 'Waiting…' : 'Connect'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
