/**
 * VirusTotal, for what the agent downloads.
 *
 * The rule the user asked for: a download is checked BEFORE it happens (the URL
 * the agent is about to fetch) and again AFTER (the bytes that actually
 * arrived, by SHA-256). Both checks are real VirusTotal API v3 calls, and both
 * are honest when they cannot run — an unconfigured key produces
 * `unconfigured`, not `clean`, because saying "clean" when nothing was checked
 * is the worst answer this file could give.
 *
 * The key lives in the user's data directory (or VIRUSTOTAL_API_KEY in the
 * environment) and never leaves this process except to virustotal.com.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type VtStatus = 'clean' | 'suspicious' | 'malicious' | 'unknown' | 'unconfigured' | 'error'

export interface VtVerdict {
  status: VtStatus
  /** One sentence for a person. */
  sentence: string
  /** How many engines flagged it, and out of how many. */
  flagged?: number
  total?: number
  /** The VirusTotal report, when there is one. */
  link?: string
  /** What was actually checked. */
  checked: 'url' | 'hash'
}

const API = 'https://www.virustotal.com/api/v3'
const TIMEOUT = 20_000

/** Where the key is kept. Plain text on purpose: it is the user's own machine. */
const keyFile = (dataDir: string) => join(dataDir, 'virustotal.json')

export async function getVtKey(dataDir: string): Promise<string | null> {
  const env = (process.env.VIRUSTOTAL_API_KEY ?? '').trim()
  if (env) return env
  try {
    const raw = JSON.parse(await readFile(keyFile(dataDir), 'utf8'))
    return typeof raw?.key === 'string' && raw.key.trim() ? raw.key.trim() : null
  } catch {
    return null
  }
}

export async function setVtKey(dataDir: string, key: string): Promise<void> {
  await writeFile(keyFile(dataDir), JSON.stringify({ key: key.trim() }, null, 2) + '\n', 'utf8')
}

const b64url = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function vtFetch(path: string, key: string, init?: RequestInit): Promise<any | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'x-apikey': key, accept: 'application/json', ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    })
    if (res.status === 404) return { notFound: true }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return await res.json()
  } catch (e) {
    return { error: String((e as any)?.message ?? e) }
  } finally {
    clearTimeout(timer)
  }
}

const summarise = (stats: any): { flagged: number; total: number; status: VtStatus } => {
  const malicious = Number(stats?.malicious ?? 0)
  const suspicious = Number(stats?.suspicious ?? 0)
  const harmless = Number(stats?.harmless ?? 0)
  const undetected = Number(stats?.undetected ?? 0)
  const total = malicious + suspicious + harmless + undetected + Number(stats?.timeout ?? 0)
  return { flagged: malicious + suspicious, total, status: malicious > 0 ? 'malicious' : suspicious > 0 ? 'suspicious' : 'clean' }
}

/** Check the URL an agent is about to fetch. */
export async function checkUrl(url: string, dataDir: string): Promise<VtVerdict> {
  const key = await getVtKey(dataDir)
  if (!key) {
    return { status: 'unconfigured', checked: 'url', sentence: 'VirusTotal is not configured, so this link was not checked. Add a VirusTotal API key in Settings → Coding & MCP to check downloads automatically.' }
  }
  const report = await vtFetch(`/urls/${b64url(url)}`, key)
  if (report?.error) return { status: 'error', checked: 'url', sentence: `VirusTotal could not be reached (${report.error}), so this link was not checked.` }
  if (report?.notFound) {
    // Submit it once; the report exists a moment later, but the agent should not
    // wait a minute to start a download. Report what is true: it is unknown.
    await vtFetch('/urls', key, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    })
    return { status: 'unknown', checked: 'url', sentence: 'VirusTotal has never seen this link, so it was submitted for analysis — nothing is known yet. The file is checked again by hash when the download finishes.' }
  }
  const stats = report?.data?.attributes?.last_analysis_stats
  const { flagged, total, status } = summarise(stats)
  const sentence = status === 'clean'
    ? `VirusTotal: no engine flagged this link (${total} engines).`
    : `VirusTotal: ${flagged} of ${total} engines flagged this link — treat the download as dangerous.`
  return { status, flagged, total, checked: 'url', link: `https://www.virustotal.com/gui/url/${b64url(url)}`, sentence }
}

/** Check the file that actually arrived, by SHA-256. */
export async function checkHash(sha256: string, dataDir: string, opts: { size?: number; path?: string; uploadIfUnknown?: boolean } = {}): Promise<VtVerdict> {
  const key = await getVtKey(dataDir)
  if (!key) {
    return { status: 'unconfigured', checked: 'hash', sentence: 'VirusTotal is not configured, so the downloaded file was not checked. The SHA-256 was computed and is shown below.' }
  }
  const report = await vtFetch(`/files/${sha256}`, key)
  if (report?.error) return { status: 'error', checked: 'hash', sentence: `VirusTotal could not be reached (${report.error}), so the file was not checked. The SHA-256 was computed and is shown below.` }

  if (report?.notFound) {
    if (opts.uploadIfUnknown && opts.path && (opts.size ?? 0) > 0 && (opts.size ?? 0) <= 32 * 1024 * 1024) {
      try {
        const bytes = await readFile(opts.path)
        const form = new FormData()
        form.append('file', new Blob([new Uint8Array(bytes)]), 'download')
        const uploaded: any = await vtFetch('/files', key, { method: 'POST', body: form })
        if (uploaded?.data?.id) {
          return { status: 'unknown', checked: 'hash', sentence: 'The file is new to VirusTotal; it was uploaded for analysis. The report appears at the link below in a minute or two.', link: `https://www.virustotal.com/gui/file/${sha256}` }
        }
      } catch { /* no token to analyse with is not a failure of the download */ }
    }
    return { status: 'unknown', checked: 'hash', sentence: 'VirusTotal has never seen this file (its hash is unknown), so nothing is known about it. Uploading it for analysis is off unless you enabled it.', link: `https://www.virustotal.com/gui/file/${sha256}` }
  }

  const stats = report?.data?.attributes?.last_analysis_stats
  const { flagged, total, status } = summarise(stats)
  const name = report?.data?.attributes?.meaningful_name
  const sentence = status === 'clean'
    ? `VirusTotal: no engine flagged the downloaded file${name ? ` (${name})` : ''} (${total} engines).`
    : `VirusTotal: ${flagged} of ${total} engines flagged the downloaded file${name ? ` (${name})` : ''} — do not run it.`
  return { status, flagged, total, checked: 'hash', sentence, link: `https://www.virustotal.com/gui/file/${sha256}` }
}
