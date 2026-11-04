/**
 * The agent's download ledger, on the client side.
 *
 * Every clone, install or download the agent starts is announced twice — once
 * when it begins, once when VirusTotal has a verdict — and the whole list stays
 * readable after the fact. Nothing here is decoration: if the agent downloads
 * something, the user sees it, and the row says exactly what was checked.
 */
import { create } from 'zustand'

export interface DownloadEvent {
  kind: 'download' | 'command'
  at: number
  project: string
  agent?: string | null
  url?: string
  path?: string
  command?: string
  bytes?: number
  sha256?: string
  vt: string
  flagged?: number
  total?: number
  note: string
  refused?: boolean
}

export interface VtVerdict {
  status: 'clean' | 'suspicious' | 'malicious' | 'unknown' | 'unconfigured' | 'error'
  sentence: string
  flagged?: number
  total?: number
  link?: string
  checked: 'url' | 'hash'
}

interface DownloadsStore {
  events: DownloadEvent[]
  loading: boolean
  load: () => Promise<void>
}

export const useDownloads = create<DownloadsStore>((set) => ({
  events: [],
  loading: false,
  load: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/ide/downloads')
      const json = await res.json()
      set({ events: Array.isArray(json?.events) ? json.events : [], loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))

/** The tone for a VirusTotal status, in one place. */
export const vtTone = (status: string): string => {
  if (status === 'clean') return 'var(--success, #16a34a)'
  if (status === 'malicious') return 'var(--danger, #dc2626)'
  if (status === 'suspicious') return 'var(--warning, #d97706)'
  if (status === 'unconfigured') return 'var(--ide-faint, var(--text-3))'
  return 'var(--ide-dim, var(--text-2))'
}

export const vtLabel = (status: string): string => ({
  clean: 'Checked · clean',
  malicious: 'Checked · dangerous',
  suspicious: 'Checked · suspicious',
  unknown: 'Unknown to VirusTotal',
  unconfigured: 'Not checked',
  error: 'Check failed',
} as Record<string, string>)[status] ?? status

/** Download a URL through the guarded backend: link checked, then bytes by hash. */
export async function downloadThroughAgent(project: string, url: string, opts: { filename?: string; confirmed?: boolean; uploadIfUnknown?: boolean } = {}) {
  const res = await fetch('/api/ide/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project, url, ...opts }),
  })
  const json = await res.json().catch(() => ({}))
  if (json?.requiresConfirm) return { needsConfirm: true, reason: json.reason as string }
  if (json?.refused) return { refused: true, reason: json.reason as string, before: json.before as VtVerdict, link: json.link as string }
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return json as { ok: true; path: string; bytes: number; sha256: string; before: VtVerdict; after: VtVerdict }
}

/** Clone a repository through the guarded backend: link checked, then cloned. */
export async function cloneThroughAgent(project: string, url: string, opts: { name?: string; confirmed?: boolean } = {}) {
  const res = await fetch('/api/ide/clone', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project, url, ...opts }),
  })
  const json = await res.json().catch(() => ({}))
  if (json?.requiresConfirm) return { needsConfirm: true, reason: json.reason as string }
  if (json?.refused) return { refused: true, reason: json.reason as string, before: json.before as VtVerdict, link: json.link as string }
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return json as { exit: number | null; stdout: string; stderr: string; dir: string; before: VtVerdict; downloadNote: string }
}
