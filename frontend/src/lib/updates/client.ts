/**
 * The updater, from the browser side.
 *
 * All of the real work happens on the server (download, checksum, unpack, swap,
 * rollback) because that is where the app's files are. This module is the thin
 * client: ask what is available, ask for it, watch the progress, restart when the
 * user says so.
 *
 * One deliberate choice: nothing here ever decides *by itself* to install. An
 * update is a change to the program on the user's disk, and it happens when they
 * press the button — automatic checking is opt-out, automatic installing is not
 * a thing.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UpdateAsset { name: string; urls: string[]; size: number }

export interface UpdateCheck {
  current: string
  latest: string | null
  available: boolean
  notes: string
  url: string
  publishedAt: string
  asset: UpdateAsset | null
  hashUrls: string[]
  kind: 'checkout' | 'portable' | 'desktop'
  canSelfUpdate: boolean
  reason?: string
}

export interface UpdateProgress {
  phase: 'idle' | 'checking' | 'downloading' | 'verifying' | 'extracting' | 'swapping' | 'ready' | 'error'
  pct: number
  received: number
  total: number
  message: string
  from?: string
  to?: string
  error?: string
}

export interface UpdateStatus {
  kind: 'checkout' | 'portable' | 'desktop'
  appRoot: string | null
  dataDir: string
  current: string
  platform: string
  canSelfUpdate: boolean
  pending: { from: string; to: string; at: number; attempts: number; backup: string } | null
  backupVersions: string[]
  outcome: { ok: boolean; from: string; to: string; at: number; restored?: boolean; reason?: string } | null
  progress: UpdateProgress
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as any)?.error ?? `${res.status} ${res.statusText}`)
  return body as T
}

async function jpost<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as any)?.error ?? `${res.status} ${res.statusText}`)
  return body as T
}

export const updateApi = {
  status: () => jget<UpdateStatus>('/api/update/status'),
  check: (force = false) => jget<UpdateCheck>(`/api/update/check${force ? '?force=1' : ''}`),
  install: (version?: string) => jpost<any>('/api/update/install', version ? { version } : {}),
  restart: () => jpost<{ ok: boolean }>('/api/update/restart'),
  rollback: () => jpost<{ ok: boolean }>('/api/update/rollback'),
  dismiss: () => jpost<{ ok: boolean }>('/api/update/dismiss'),
}

/** "2.3 MB of 4.9 MB" — the size line under the progress bar. */
export function formatBytes(n: number): string {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function phaseLabel(phase: UpdateProgress['phase']): string {
  switch (phase) {
    case 'checking': return 'Checking'
    case 'downloading': return 'Downloading'
    case 'verifying': return 'Verifying'
    case 'extracting': return 'Unpacking'
    case 'swapping': return 'Installing'
    case 'ready': return 'Ready'
    case 'error': return 'Failed'
    default: return 'Idle'
  }
}

/**
 * The updater's state, kept fresh while an update is running.
 *
 * Polling is deliberate: the download happens on the server, so the browser has
 * nothing to observe locally. It polls fast while something is moving and not at
 * all when nothing is.
 */
export function useUpdates(options: { autoCheck?: boolean } = {}) {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const next = await updateApi.status()
      // A server that has never run an update (or an older build answering a
      // newer page) may omit these fields. Normalise once, here, so no consumer
      // has to defend itself.
      const safe: UpdateStatus = {
        ...next,
        progress: next.progress ?? { phase: 'idle', pct: 0, received: 0, total: 0, message: '' },
        backupVersions: next.backupVersions ?? [],
      }
      setStatus(safe)
      return safe
    } catch (e: any) {
      setError(String(e?.message ?? e))
      return null
    }
  }, [])

  const runCheck = useCallback(async (force = false) => {
    setError(null)
    try {
      const next = await updateApi.check(force)
      setCheck(next)
      return next
    } catch (e: any) {
      setError(String(e?.message ?? e))
      return null
    }
  }, [])

  const install = useCallback(async (version?: string) => {
    setBusy(true)
    setError(null)
    try {
      await updateApi.install(version)
      await refreshStatus()
      return true
    } catch (e: any) {
      // A failed install is not a silent thing: the reason goes back to the
      // server's progress record as well, and is shown from the status poll.
      setError(String(e?.message ?? e))
      await refreshStatus()
      return false
    } finally {
      setBusy(false)
    }
  }, [refreshStatus])

  useEffect(() => { void refreshStatus() }, [refreshStatus])

  // While a download is in flight, watch it; otherwise stay quiet.
  useEffect(() => {
    const phase = status?.progress?.phase
    const running = phase === 'downloading' || phase === 'extracting'
      || phase === 'verifying' || phase === 'swapping' || busy
    if (!running) return
    const id = window.setInterval(() => { void refreshStatus() }, 500)
    return () => window.clearInterval(id)
  }, [status?.progress?.phase, busy, refreshStatus])

  // One quiet check when the app opens (unless the user turned it off).
  const checkedOnce = useRef(false)
  useEffect(() => {
    if (checkedOnce.current || options.autoCheck === false) return
    checkedOnce.current = true
    const id = window.setTimeout(() => { void runCheck(false) }, 2500)
    return () => window.clearTimeout(id)
  }, [options.autoCheck, runCheck])

  return { status, check, error, busy, refreshStatus, runCheck, install, setError }
}
