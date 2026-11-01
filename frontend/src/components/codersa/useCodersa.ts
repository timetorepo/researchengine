/**
 * Codersa's state, in one place: the session list, the open thread, and the
 * turn that is running. Nothing here outlives the page except the two small
 * preferences saved in localStorage. A running turn is aborted when the page
 * unmounts, so leaving the page never leaves a model call or command behind.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { harnessApi, openTurn, type HarnessProfile, type SessionSummary } from '@/lib/codersa/api'
import { readSse } from '@/lib/codersa/sse'
import { applyLive, itemsFromLog, newId, windowItems, type Item } from '@/lib/codersa/timeline'
import { describeModel, resolveTarget } from '@/lib/codersa/model'

const PREFS_KEY = 'codersa.prefs.v1'
/** How long a closed stream waits before the log is reloaded, so the server's 'stopped' entry is written first. */
const STOP_SETTLE_MS = 400

export interface Outcome { outcome: 'done' | 'stopped' | 'error' | 'step-limit'; steps: number }

interface Prefs { profile: 'minimal' | 'standard'; allowCommands: boolean; project: string }

function readPrefs(): Prefs {
  const fallback: Prefs = { profile: 'standard', allowCommands: false, project: '' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      profile: p.profile === 'minimal' ? 'minimal' : 'standard',
      // Commands are off until the person turns them on, every time they open the page.
      allowCommands: false,
      project: typeof p.project === 'string' ? p.project : '',
    }
  } catch { return fallback }
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function useCodersa() {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [profiles, setProfiles] = useState<HarnessProfile[]>([])
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [projects, setProjects] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [hidden, setHidden] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const settings = useStore((s) => s.settings)
  const model = describeModel(settings)

  const abortRef = useRef<AbortController | null>(null)
  const activeRef = useRef<string | null>(null)
  const openSeq = useRef(0)
  const alive = useRef(true)

  useEffect(() => { activeRef.current = activeId }, [activeId])

  // Save the two preferences that carry over; the rest is per visit.
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ profile: prefs.profile, project: prefs.project })) } catch { /* private mode */ }
  }, [prefs.profile, prefs.project])

  const refreshSessions = useCallback(async () => {
    try {
      const list = await harnessApi.sessions()
      if (alive.current) setSessions(list)
    } catch (err) {
      if (alive.current) setError(errorText(err, 'Could not load sessions.'))
    }
  }, [])

  // Mount: load the lists. Unmount: stop any running turn and mark the hook dead.
  useEffect(() => {
    alive.current = true
    void refreshSessions()
    void harnessApi.profiles().then((p) => { if (alive.current) setProfiles(p) }).catch(() => {})
    void harnessApi.projects().then((p) => { if (alive.current) setProjects(p.map((x) => x.name)) }).catch(() => {})
    return () => {
      alive.current = false
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [refreshSessions])

  const reloadActive = useCallback(async (id: string) => {
    try {
      const events = await harnessApi.events(id)
      if (!alive.current || activeRef.current !== id) return
      const win = windowItems(itemsFromLog(events))
      setItems(win.shown)
      setHidden(win.hidden)
    } catch (err) {
      if (alive.current) setError(errorText(err, 'Could not reload this session.'))
    }
  }, [])

  const openSession = useCallback(async (id: string) => {
    if (abortRef.current) return
    const seq = ++openSeq.current
    setError(null)
    setOutcome(null)
    setActiveId(id)
    setLoading(true)
    try {
      const events = await harnessApi.events(id)
      if (!alive.current || seq !== openSeq.current) return
      const win = windowItems(itemsFromLog(events))
      setItems(win.shown)
      setHidden(win.hidden)
    } catch (err) {
      if (alive.current && seq === openSeq.current) setError(errorText(err, 'Could not open this session.'))
    } finally {
      if (alive.current && seq === openSeq.current) setLoading(false)
    }
  }, [])

  const newSession = useCallback(() => {
    if (abortRef.current) return
    openSeq.current++
    setActiveId(null)
    setItems([])
    setHidden(0)
    setError(null)
    setOutcome(null)
  }, [])

  /** Start a turn. Returns true when the turn started, so the caller can clear its draft only then. */
  const send = useCallback(async (raw: string): Promise<boolean> => {
    const text = raw.trim()
    if (!text || abortRef.current) return false
    setError(null)
    setOutcome(null)

    const resolved = await resolveTarget()
    if (!resolved.ok) { setError(resolved.reason); return false }

    let id = activeRef.current
    if (!id) {
      try {
        const created = await harnessApi.create({ profile: prefs.profile, project: prefs.project || null, title: text.slice(0, 60) })
        if (!alive.current) return false
        openSeq.current++
        id = created.id
        setActiveId(id)
        activeRef.current = id
        void refreshSessions()
      } catch (err) {
        if (alive.current) setError(errorText(err, 'Could not start a session.'))
        return false
      }
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setItems((prev) => [...prev, { kind: 'user', id: newId('u'), text }])
    try {
      const body = await openTurn(id, { text, approve: prefs.allowCommands, model: { base: resolved.target.base, model: resolved.target.model, key: resolved.target.key } }, controller.signal)
      for await (const ev of readSse(body, controller.signal)) {
        if (!alive.current) break
        if (ev.event === 'end') { setOutcome(ev.data as Outcome); continue }
        if (ev.event === 'start' || ev.event === 'done') continue
        setItems((prev) => applyLive(prev, ev))
      }
    } catch (err) {
      if (alive.current && !controller.signal.aborted) setError(errorText(err, 'The connection to Codersa was lost.'))
    } finally {
      const stopped = controller.signal.aborted
      abortRef.current = null
      if (alive.current) {
        setBusy(false)
        if (stopped) await new Promise((r) => setTimeout(r, STOP_SETTLE_MS))
        // Reload the saved log: the thread then matches what was kept, and every
        // item has the event index that forking needs.
        if (alive.current) await reloadActive(id)
        void refreshSessions()
      }
    }
    return true
  }, [prefs.profile, prefs.project, prefs.allowCommands, reloadActive, refreshSessions])

  const stop = useCallback(() => { abortRef.current?.abort() }, [])

  const removeSession = useCallback(async (id: string) => {
    if (abortRef.current && activeRef.current === id) return
    try {
      await harnessApi.remove(id)
      if (activeRef.current === id) newSession()
      void refreshSessions()
    } catch (err) {
      if (alive.current) setError(errorText(err, 'Could not delete this session.'))
    }
  }, [newSession, refreshSessions])

  const forkAt = useCallback(async (at: number) => {
    const id = activeRef.current
    if (!id || abortRef.current) return
    try {
      const forked = await harnessApi.fork(id, at)
      void refreshSessions()
      await openSession(forked.id)
    } catch (err) {
      if (alive.current) setError(errorText(err, 'Could not fork here.'))
    }
  }, [openSession, refreshSessions])

  const searchSessions = useCallback((q: string) => harnessApi.search(q), [])

  const setProfile = useCallback((profile: Prefs['profile']) => setPrefs((p) => ({ ...p, profile })), [])
  const setProject = useCallback((project: string) => setPrefs((p) => ({ ...p, project })), [])
  const setAllowCommands = useCallback((allowCommands: boolean) => setPrefs((p) => ({ ...p, allowCommands })), [])

  const active = sessions?.find((s) => s.id === activeId) ?? null

  return {
    profiles, sessions, projects, active, activeId, items, hidden, busy, loading, error, outcome, model,
    prefs, setProfile, setProject, setAllowCommands,
    openSession, newSession, send, stop, removeSession, forkAt, searchSessions,
    dismissError: () => setError(null),
  }
}
