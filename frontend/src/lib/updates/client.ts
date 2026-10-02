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
import { useStore } from '@/stores/useStore'
import { notifyUpdate } from '@/lib/notifications/store'

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
  /** Which source the server is reading — a private repo, or your own manifest. */
  source?: { kind: 'github' | 'manifest'; repo: string | null; manifestUrl: string | null; token: 'set' | 'none' }
}

/**
 * Where updates are read from. Sent with every update request, never stored on
 * the server: the token is a credential for *this* call, and the manifest URL is
 * the way to update without GitHub's API being reachable at all.
 */
/** What `/api/update/install` answers with, whichever path it took. */
export interface InstallResult {
  ok: boolean
  kind?: 'desktop' | 'portable'
  via?: 'installer' | 'archive'
  file?: string
  opened?: boolean
  message?: string
  pending?: { from: string; to: string; at: number; attempts: number; backup: string }
  restartRequired?: boolean
}

export interface UpdateSource {
  repo?: string
  token?: string
  manifestUrl?: string
}

function sourceHeaders(source?: UpdateSource): Record<string, string> {
  const h: Record<string, string> = {}
  if (!source) return h
  if (source.repo?.trim()) h['x-re-update-repo'] = source.repo.trim()
  if (source.token?.trim()) h['x-re-update-token'] = source.token.trim()
  if (source.manifestUrl?.trim()) h['x-re-update-manifest'] = source.manifestUrl.trim()
  return h
}

async function jget<T>(url: string, source?: UpdateSource): Promise<T> {
  const res = await fetch(url, { headers: sourceHeaders(source) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as any)?.error ?? `${res.status} ${res.statusText}`)
  return body as T
}

async function jpost<T>(url: string, payload?: unknown, source?: UpdateSource): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...sourceHeaders(source) },
    body: JSON.stringify(payload ?? {}),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as any)?.error ?? `${res.status} ${res.statusText}`)
  return body as T
}

export const updateApi = {
  status: (source?: UpdateSource) => jget<UpdateStatus>('/api/update/status', source),
  check: (force = false, source?: UpdateSource) => jget<UpdateCheck>(`/api/update/check${force ? '?force=1' : ''}`, source),
  install: (version?: string, source?: UpdateSource) => jpost<InstallResult>('/api/update/install', version ? { version } : {}, source),
  restart: () => jpost<{ ok: boolean }>('/api/update/restart'),
  rollback: () => jpost<{ ok: boolean }>('/api/update/rollback'),
  dismiss: () => jpost<{ ok: boolean }>('/api/update/dismiss'),
  /**
   * Install an archive that is already on this machine. The file goes up as the
   * raw body; the optional checksum text rides along in a header, which is what
   * makes this work with no route to GitHub at all.
   */
  installFile: async (file: File, sumsText?: string) => {
    const res = await fetch(`/api/update/install-file?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-re-file-name': file.name,
        ...(sumsText?.trim() ? { 'x-re-sums': sumsText.trim() } : {}),
      },
      body: file,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((body as any)?.error ?? `${res.status} ${res.statusText}`)
    return body as { ok: boolean; restartRequired?: boolean }
  },
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
  /**
   * The sentence the server sent back after a successful download — which is
   * *not* the same news on every install kind. A portable build says "press
   * Restart"; a desktop build says where the installer went and whether it was
   * opened. The UI used to guess both, so a portable folder that had just been
   * handed an archive was told to "finish the installer".
   */
  const [notice, setNotice] = useState<string | null>(null)
  // Where updates come from, straight from settings — so a private repository
  // (with a token) or a self-hosted manifest works without a rebuild.
  const configured = useStore((s) => s.settings.updates)
  const source: UpdateSource = {
    repo: configured?.repo,
    token: configured?.token,
    manifestUrl: configured?.manifestUrl,
  }
  const sourceKey = `${source.repo ?? ''}|${source.manifestUrl ?? ''}|${source.token ? 'tok' : ''}`

  const refreshStatus = useCallback(async () => {
    try {
      const next = await updateApi.status(source)
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
  }, [sourceKey])

  const runCheck = useCallback(async (force = false) => {
    setError(null)
    try {
      const next = await updateApi.check(force, source)
      setCheck(next)
      // A release found is a fact the user asked to be told about (Settings →
      // Notifications, on by default). The store dedupes by version, so the
      // same release is announced exactly once however often this runs.
      if (next?.available && next.latest && useStore.getState().settings.notifyUpdates !== false) {
        notifyUpdate(String(next.latest), next.notes)
      }
      return next
    } catch (e: any) {
      setError(String(e?.message ?? e))
      return null
    }
  }, [sourceKey])

  const install = useCallback(async (version?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const out = await updateApi.install(version, source)
      await refreshStatus()
      setNotice(typeof out?.message === 'string' && out.message
        ? out.message
        : out?.restartRequired
          ? `Downloaded and verified. Press “Restart now” to run ${out?.pending?.to ?? 'the new version'} — your library is untouched.`
          : 'Downloaded.')
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
  }, [refreshStatus, sourceKey])

  /** Install an archive the user already has. Same verification, same swap. */
  const installFromFile = useCallback(async (file: File, sumsText?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await updateApi.installFile(file, sumsText)
      await refreshStatus()
      return true
    } catch (e: any) {
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

  /** Restart into the version that is already on disk (then reload the page). */
  const restart = useCallback(async () => {
    try { await updateApi.restart() } catch { /* the request dies with the server */ }
    window.setTimeout(() => window.location.reload(), 4000)
  }, [])

  return {
    status, check, error, notice, busy,
    refreshStatus, runCheck, install, installFromFile, restart, setError,
    clearNotice: () => setNotice(null),
  }
}
