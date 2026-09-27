/**
 * The updater.
 *
 * The promise this file has to keep is narrow and absolute: **it may replace the
 * program, and it may never touch your library.** So the whole thing is built
 * around two rules.
 *
 * 1. *Nothing outside the app folder is written.* Every path the updater moves,
 *    deletes or creates goes through `guard()`, which refuses anything that is
 *    not strictly inside the app root — and refuses anything at all inside the
 *    data directory. The data directory (`~/.research-engine`) is not merely
 *    left alone by convention: the guard makes writing to it an error.
 *
 * 2. *A version that cannot boot is put back.* The swap is a rename, the previous
 *    files are kept, and a marker file records the change. If the new version
 *    dies on boot (or crash-loops), the old files are restored automatically and
 *    the reason is written next to them for the UI to show. Nothing is deleted
 *    until the new version has proved it can serve a page.
 *
 * Verification: the archive is checked against the `SHA256SUMS` committed at the
 * same release tag before a single file moves. That protects against a
 * truncated, corrupted or substituted download; it is not a signature, and the
 * docs say so rather than implying more.
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { extractArchive, rmrf } from './archive'
import {
  archiveNameFor, compareVersions, isNewer, pickLatest, parseSha256Sums,
  type ReleaseInfo, type ReleaseLike,
} from './version'

export const REPO = 'timetorepo/researchengine'
export const UPDATE_DIR = '.update'
/** Exit code the server uses to say "I swapped my own files — start me again". */
export const EXIT_RESTART = 75
/** How long a new version must serve pages before the swap is called good. */
export const HEALTHY_AFTER_MS = 20_000
/**
 * How many chances a freshly installed version gets. One: if it has already
 * tried once and we are looking at the marker again, the next thing that happens
 * is a rollback. (A version that throws outright never gets that far — the fatal
 * handler puts the old one back immediately.)
 */
export const MAX_BOOT_ATTEMPTS = 1

export type UpdatePhase =
  | 'idle' | 'checking' | 'downloading' | 'verifying' | 'extracting' | 'swapping' | 'ready' | 'error'

export interface UpdateProgress {
  phase: UpdatePhase
  pct: number
  received: number
  total: number
  message: string
  from?: string
  to?: string
  error?: string
}

export interface PendingUpdate {
  from: string
  to: string
  at: number
  attempts: number
  backup: string
  platform: string
}

export interface UpdateDeps {
  /** App root — the folder holding `server/` and `frontend-dist/`. Null in a checkout. */
  appRoot: string | null
  dataDir: string
  currentVersion: string
  platform: string
  kind: 'checkout' | 'portable' | 'desktop'
  fetchImpl?: typeof fetch
  /** Override the API/raw hosts — the tests point these at a local server. */
  apiBase?: string
  rawBase?: string
  /**
   * Which repository to read. A private repo works exactly like a public one
   * once a read-only token is supplied — the only difference is the header.
   */
  repo?: string
  /**
   * A read-only token for a private repository. Sent to GitHub hosts only, and
   * never written to a log: a token is a credential, not a setting to echo.
   */
  token?: string
  /**
   * A release manifest you host yourself — a static JSON file anywhere. This is
   * the way out of GitHub entirely: no API quota, no token, no visibility
   * question, and it works from a LAN share or an internal server.
   */
  manifestUrl?: string
  log?: (message: string) => void
  now?: () => number
}

/* ------------------------------------------------------------- the guard ---- */

/**
 * The safety property, in one function: `target` must be strictly inside the app
 * folder and must not be inside the data directory. Everything that touches disk
 * calls this first, so "the update cannot corrupt your data" is enforced rather
 * than promised.
 */
export function guard(appRoot: string, dataDir: string, target: string, what = 'path') {
  const app = resolve(appRoot)
  const t = resolve(target)
  const relApp = relative(app, t)
  if (!relApp || relApp.startsWith('..') || isAbsolute(relApp)) {
    throw new Error(`refusing to touch ${what} outside the app folder: ${t}`)
  }
  if (dataDir) {
    const relData = relative(resolve(dataDir), t)
    if (!relData.startsWith('..') && !isAbsolute(relData)) {
      throw new Error(`refusing to touch ${what} inside the data directory: ${t}`)
    }
  }
  return t
}

/* ----------------------------------------------------------------- files ---- */

export const updateDir = (deps: UpdateDeps) => join(resolve(deps.appRoot!), UPDATE_DIR)
const stageDir = (deps: UpdateDeps) => join(updateDir(deps), 'stage')
const backupDir = (deps: UpdateDeps) => join(updateDir(deps), 'backup')
const pendingFile = (deps: UpdateDeps) => join(updateDir(deps), 'pending.json')
const resultFile = (deps: UpdateDeps) => join(updateDir(deps), 'last-update.json')

export function readPending(deps: UpdateDeps): PendingUpdate | null {
  try {
    if (!deps.appRoot) return null
    const file = pendingFile(deps)
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8')) as PendingUpdate
  } catch { return null }
}

export function writePending(deps: UpdateDeps, pending: PendingUpdate) {
  const file = guard(deps.appRoot!, deps.dataDir, pendingFile(deps), 'the update marker')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(pending, null, 2))
}

export function clearPending(deps: UpdateDeps) {
  if (!deps.appRoot) return
  const file = guard(deps.appRoot, deps.dataDir, pendingFile(deps), 'the update marker')
  rmrf(file)
}

export interface UpdateOutcome {
  ok: boolean
  from: string
  to: string
  at: number
  restored?: boolean
  reason?: string
}

/** What the last update (or rollback) did — read once by the UI, then shown as a notice. */
export function readOutcome(deps: UpdateDeps): UpdateOutcome | null {
  try {
    if (!deps.appRoot) return null
    const file = resultFile(deps)
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8')) as UpdateOutcome
  } catch { return null }
}

export function writeOutcome(deps: UpdateDeps, outcome: UpdateOutcome) {
  if (!deps.appRoot) return
  const file = guard(deps.appRoot, deps.dataDir, resultFile(deps), 'the update result file')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(outcome, null, 2))
}

export function clearOutcome(deps: UpdateDeps) {
  if (!deps.appRoot) return
  const file = guard(deps.appRoot, deps.dataDir, resultFile(deps), 'the update result file')
  rmrf(file)
}

/* --------------------------------------------------------------- release ---- */

const apiBase = (deps: UpdateDeps) => deps.apiBase ?? 'https://api.github.com'
const rawBase = (deps: UpdateDeps) => deps.rawBase ?? 'https://raw.githubusercontent.com'
/** Which repo this build reads from. */
export const repoOf = (deps: UpdateDeps) => deps.repo?.trim() || REPO

/** Hosts that may see the token. A custom manifest host never does. */
const GITHUB_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'github.com', 'objects.githubusercontent.com', 'codeload.github.com'])
function authFor(deps: UpdateDeps, url: string): Record<string, string> {
  if (!deps.token) return {}
  try {
    const host = new URL(url).hostname
    const base = new URL(apiBase(deps)).hostname
    return GITHUB_HOSTS.has(host) || host === base ? { authorization: `Bearer ${deps.token}` } : {}
  } catch { return {} }
}

/**
 * Two ways to read the same file out of the same immutable tag:
 *
 *   1. raw.githubusercontent.com — the fast path, no API quota;
 *   2. the contents API with `Accept: application/vnd.github.raw` — the same
 *      bytes, served by api.github.com.
 *
 * Both are tried in order, so a network that blocks one (corporate proxies and
 * some sandboxes block raw.githubusercontent) still updates. Both are the same
 * file from the same release, so the checksum means the same thing either way.
 */
export function fileUrls(deps: UpdateDeps, version: string, name: string): string[] {
  return [
    `${rawBase(deps)}/${repoOf(deps)}/v${version}/downloads/${name}`,
    `${apiBase(deps)}/repos/${repoOf(deps)}/contents/downloads/${name}?ref=v${version}`,
  ]
}

/** The same file, in the shape a fetch needs (the API path wants a different accept). */
function requestFor(deps: UpdateDeps, url: string): { url: string; init: RequestInit } {
  const isApi = url.includes('/contents/')
  return {
    url,
    init: {
      headers: {
        accept: isApi ? 'application/vnd.github.raw' : 'application/octet-stream',
        'user-agent': 'research-engine-updater',
        ...authFor(deps, url),
      },
    },
  }
}

async function getJson(deps: UpdateDeps, url: string): Promise<any> {
  const doFetch = deps.fetchImpl ?? fetch
  const res = await doFetch(url, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'research-engine-updater', ...authFor(deps, url) },
  })
  if (!res.ok) {
    // 404 on a private repo means "no token, or a token without repo access".
    if (res.status === 404 && deps.token === undefined) throw new Error('GitHub replied 404 — if this repository is private, add a read-only token in Settings → Updates')
    if (res.status === 401 || res.status === 403) throw new Error(`GitHub refused the token (${res.status}) — it needs read-only repository access`)
    throw new Error(`GitHub replied ${res.status} for ${url}`)
  }
  return await res.json()
}

/**
 * A release manifest you host yourself.
 *
 * Accepted shapes, so it can be hand-written in ten seconds:
 *
 *   { "releases": [ { "tag_name": "v1.2.0", "body": "…", "assets": [...] } ] }
 *   [ { "tag_name": "v1.2.0", … } ]
 *   { "tag_name": "v1.2.0", "version": "1.2.0", "notes": "…",
 *     "archive": "https://…/research-engine-1.2.0-linux-x64.tar.gz",
 *     "sums":    "https://…/SHA256SUMS" }
 *
 * The single-release form is the one to reach for: it needs no per-platform
 * asset table, because `archive` names the file directly.
 */
export function manifestReleases(json: any, fallbackUrl = ''): ReleaseLike[] {
  const raw = Array.isArray(json) ? json : Array.isArray(json?.releases) ? json.releases : [json]
  return raw.filter(Boolean).map((r: any) => {
    const version = String(r.version ?? r.tag_name ?? r.tag ?? '').replace(/^v/, '')
    const assets = Array.isArray(r.assets) ? r.assets : []
    if (r.archive) {
      assets.push({
        name: String(r.archive).split('/').pop() ?? archiveNameFor(version, 'linux-x64'),
        browser_download_url: String(r.archive),
        size: Number(r.size ?? 0),
      })
    }
    return {
      tag_name: r.tag_name ?? `v${version}`,
      name: r.name ?? `v${version}`,
      body: r.body ?? r.notes ?? '',
      published_at: r.published_at ?? r.publishedAt ?? '',
      html_url: r.html_url ?? r.url ?? fallbackUrl,
      prerelease: r.prerelease ?? true,
      draft: r.draft ?? false,
      assets,
      sums: r.sums ?? r.sumsUrl ?? null,
    }
  })
}

/** Newest published release, prereleases included (see version.ts for why). */
export async function latestRelease(deps: UpdateDeps): Promise<ReleaseInfo | null> {
  if (deps.manifestUrl) {
    const json = await getJson(deps, deps.manifestUrl)
    const list = manifestReleases(json, deps.manifestUrl)
    const latest = pickLatest(list, 'beta')
    if (latest && !latest.sums) latest.sums = findSumsIn(list)
    return latest
  }
  const list = await getJson(deps, `${apiBase(deps)}/repos/${repoOf(deps)}/releases?per_page=30`)
  if (!Array.isArray(list)) throw new Error('unexpected release list from GitHub')
  return pickLatest(list as ReleaseLike[], 'beta')
}

/** A `sums` URL from any entry in the manifest, so a single-release file needs none. */
function findSumsIn(list: ReleaseLike[]): string | null {
  for (const r of list) if (r.sums) return r.sums
  return null
}

/**
 * The checksum list's URLs: the manifest's own `sums` link when it has one,
 * otherwise the file committed beside the archive at the same tag.
 */
export function hashUrlsFor(deps: UpdateDeps, version: string, release?: ReleaseInfo | null): string[] {
  if (release?.sums) return [release.sums]
  return fileUrls(deps, version, 'SHA256SUMS')
}

/**
 * The URLs for one release asset, best-first.
 *
 * There are two ways to fetch an asset and they are good in opposite cases:
 * the API form (`/releases/assets/<id>`) is the only one a token can
 * authenticate, while GitHub's browser download URL returns **404 on those
 * same private repositories even with a token**. So the API form is queued
 * first, and the browser form is kept as the no-token fallback.
 */
export function assetUrlsFor(deps: UpdateDeps, asset: { url?: string; id?: number }): string[] {
  const urls: string[] = []
  if (typeof asset.id === 'number') urls.push(`${apiBase(deps)}/repos/${repoOf(deps)}/releases/assets/${asset.id}`)
  if (asset.url) urls.push(asset.url)
  return urls
}

/**
 * Which archive URLs to try for a version, in the order most likely to work:
 *
 *   1. the committed copy at the tag (raw, then the contents API) — the one a
 *      read-only token can always read, private repository or not;
 *   2. the uploaded release asset, API form first;
 *   3. a manifest's own `archive` link, which is all a self-hosted manifest has.
 */
export function archiveUrlsFor(deps: UpdateDeps, version: string, release?: ReleaseInfo | null, asset?: { name?: string; url?: string; urls?: string[]; id?: number } | null): string[] {
  if (asset?.urls?.length) return asset.urls
  const name = asset?.name || archiveNameFor(version, deps.platform)
  const manifestOwned = !!deps.manifestUrl
  const committed = manifestOwned ? [] : fileUrls(deps, version, name)
  const uploaded = asset ? assetUrlsFor(deps, asset) : []
  const all = [...committed, ...uploaded]
  return all.filter((u, i) => !!u && all.indexOf(u) === i)
}

export interface CheckResult {
  current: string
  latest: string | null
  available: boolean
  behind: number
  notes: string
  url: string
  publishedAt: string
  asset: { name: string; urls: string[]; size: number } | null
  hashUrls: string[]
  kind: UpdateDeps['kind']
  canSelfUpdate: boolean
  reason?: string
}

export async function checkForUpdate(deps: UpdateDeps): Promise<CheckResult> {
  const latest = await latestRelease(deps)
  const name = latest ? archiveNameFor(latest.version, deps.platform) : ''
  const asset = latest?.assets.find((a) => a.name === name) ?? null
  const portable = deps.kind === 'portable' && !!deps.appRoot
  return {
    current: deps.currentVersion,
    latest: latest?.version ?? null,
    available: !!latest && isNewer(latest.version, deps.currentVersion),
    behind: latest ? (isNewer(latest.version, deps.currentVersion) ? 1 : 0) : 0,
    notes: latest?.notes ?? '',
    url: latest?.url ?? '',
    publishedAt: latest?.publishedAt ?? '',
    // The portable archive is committed inside the tagged tree, so the download
    // and its checksum come from the same immutable release.
    asset: latest && portable
      ? { name, urls: archiveUrlsFor(deps, latest.version, latest, asset), size: asset?.size ?? 0 }
      : asset ? { name: asset.name, urls: assetUrlsFor(deps, asset), size: asset.size } : null,
    hashUrls: latest ? hashUrlsFor(deps, latest.version, latest) : [],
    kind: deps.kind,
    canSelfUpdate: portable,
    reason: portable ? undefined
      : deps.kind === 'checkout' ? 'this is a source checkout — update with git pull && npm run build'
      : deps.kind === 'desktop' ? 'the desktop app updates through its installer — Research Engine will fetch it for you'
      : 'this build cannot update itself in place',
  }
}

/* -------------------------------------------------------------- download ---- */

export interface DownloadResult { buffer: Buffer; sha256: string }

export async function download(
  deps: UpdateDeps,
  url: string,
  onProgress: (received: number, total: number) => void,
  maxBytes = 200 * 1024 * 1024,
  init?: RequestInit,
): Promise<DownloadResult> {
  const doFetch = deps.fetchImpl ?? fetch
  const res = await doFetch(url, init ?? { headers: { accept: 'application/octet-stream', 'user-agent': 'research-engine-updater' } })
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  const chunks: Buffer[] = []
  let received = 0
  if (res.body) {
    const reader = (res.body as any).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const buf = Buffer.from(value)
      received += buf.length
      if (received > maxBytes) throw new Error(`download exceeded ${maxBytes} bytes — refusing it`)
      chunks.push(buf)
      onProgress(received, total)
    }
  } else {
    const buf = Buffer.from(await res.arrayBuffer())
    received = buf.length
    chunks.push(buf)
    onProgress(received, total)
  }
  const buffer = Buffer.concat(chunks)
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex') }
}

/**
 * Download from the first source that answers. Records which one worked, so a
 * failure message can say what was tried.
 */
export async function downloadAny(
  deps: UpdateDeps,
  urls: string[],
  onProgress: (received: number, total: number) => void,
  maxBytes = 200 * 1024 * 1024,
): Promise<DownloadResult & { url: string }> {
  const errors: string[] = []
  for (const url of urls) {
    try {
      const req = requestFor(deps, url)
      const out = await download(deps, req.url, onProgress, maxBytes, req.init)
      return { ...out, url }
    } catch (e: any) {
      errors.push(`${new URL(url).hostname}: ${e?.message ?? e}`)
    }
  }
  throw new Error(`could not download from any source — ${errors.join('; ')}`)
}

/** Read a small text file (the checksum list) from the first source that answers. */
export async function fetchTextAny(deps: UpdateDeps, urls: string[]): Promise<{ text: string; url: string }> {
  const doFetch = deps.fetchImpl ?? fetch
  const errors: string[] = []
  for (const url of urls) {
    try {
      const req = requestFor(deps, url)
      const res = await doFetch(req.url, req.init)
      if (!res.ok) { errors.push(`${new URL(url).hostname}: HTTP ${res.status}`); continue }
      return { text: await res.text(), url }
    } catch (e: any) {
      errors.push(`${new URL(url).hostname}: ${e?.message ?? e}`)
    }
  }
  throw new Error(`could not read the release checksum — ${errors.join('; ')}`)
}

/** Which hash does the release say this file should have? */
export function expectedHash(sumsText: string, fileName: string): string | null {
  const sums = parseSha256Sums(sumsText)
  return sums[fileName] ?? null
}

/* ------------------------------------------------------- staging + swap ---- */

export interface StageCheck { ok: boolean; reason?: string; version?: string }

/** Does this extraction actually contain a Research Engine build of `version`? */
export function validateStage(root: string, version: string): StageCheck {
  const entry = join(root, 'server', 'index.js')
  const pkgFile = join(root, 'server', 'package.json')
  const index = join(root, 'frontend-dist', 'index.html')
  if (!existsSync(entry)) return { ok: false, reason: 'the archive has no server/index.js' }
  if (!existsSync(index)) return { ok: false, reason: 'the archive has no frontend-dist/index.html' }
  if (!existsSync(pkgFile)) return { ok: false, reason: 'the archive has no server/package.json' }
  try {
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { name?: string; version?: string }
    if (pkg.name !== 'research-engine-server') return { ok: false, reason: `the archive's server package is "${pkg.name ?? 'unnamed'}", not a Research Engine server` }
    if (pkg.version && pkg.version !== version) return { ok: false, reason: `the archive says it is ${pkg.version} but this update is for ${version}` }
    return { ok: true, version: pkg.version ?? version }
  } catch (e: any) {
    return { ok: false, reason: `could not read the archive's server/package.json (${e?.message ?? e})` }
  }
}

/** The parts of the install an update replaces. The launcher and README stay. */
export const SWAPPED = ['server', 'frontend-dist', 'bin'] as const

/** Move a folder, falling back to copy+delete across filesystems. */
function moveDir(from: string, to: string) {
  mkdirSync(dirname(to), { recursive: true })
  try { renameSync(from, to) }
  catch { cpSync(from, to, { recursive: true }); rmrf(from) }
}

/**
 * Put the staged build in place, keeping the current one as `backup/`.
 * Pure filesystem work — no network, so the test can drive it directly.
 */
export function swapIn(deps: UpdateDeps, stage: string, version: string, fromVersion: string): PendingUpdate {
  const app = resolve(deps.appRoot!)
  const backup = guard(app, deps.dataDir, backupDir(deps), 'the backup folder')
  rmrf(backup) // the previous backup belongs to a version that already booted us
  mkdirSync(backup, { recursive: true })

  const movedOut: string[] = []
  try {
    for (const name of SWAPPED) {
      const live = guard(app, deps.dataDir, join(app, name), `the installed ${name}`)
      const staged = guard(app, deps.dataDir, join(stage, name), `the staged ${name}`)
      if (!existsSync(staged)) continue
      if (existsSync(live)) moveDir(live, join(backup, name))
      moveDir(staged, live)
      movedOut.push(name)
    }
  } catch (e) {
    // Put back whatever we already moved, then rethrow — a half-swapped install
    // is exactly what must never be left behind.
    for (const name of movedOut) {
      const live = join(app, name)
      const saved = join(backup, name)
      if (existsSync(saved)) { rmrf(live); moveDir(saved, live) }
    }
    throw e
  }

  const pending: PendingUpdate = {
    from: fromVersion,
    to: version,
    at: (deps.now ?? Date.now)(),
    attempts: 0,
    backup,
    platform: deps.platform,
  }
  writePending(deps, pending)
  rmrf(stage)
  return pending
}

/**
 * Restore the previous version. Called automatically when a new version fails
 * to boot, and available by hand from Settings → Updates.
 */
export function rollback(deps: UpdateDeps, reason: string): UpdateOutcome {
  const pending = readPending(deps)
  if (!deps.appRoot) throw new Error('this build has no app folder to roll back')
  const app = resolve(deps.appRoot)
  const from = pending?.to ?? deps.currentVersion
  const to = pending?.from ?? ''
  const backup = guard(app, deps.dataDir, pending?.backup ?? backupDir(deps), 'the backup folder')
  if (!existsSync(backup)) throw new Error('there is no previous version on disk to roll back to')

  for (const name of SWAPPED) {
    const saved = join(backup, name)
    if (!existsSync(saved)) continue
    const live = guard(app, deps.dataDir, join(app, name), `the installed ${name}`)
    rmrf(live)
    moveDir(saved, live)
  }
  rmrf(backup)
  clearPending(deps)
  const outcome: UpdateOutcome = { ok: false, from, to, at: (deps.now ?? Date.now)(), restored: true, reason }
  writeOutcome(deps, outcome)
  return outcome
}

/* ------------------------------------------------- install from a file ---- */

/**
 * Install an archive the user already has.
 *
 * This is the answer to "the repository is private — how does a user update?":
 * they download the release archive from wherever they can reach it (the GitHub
 * UI, a shared drive, an e-mail attachment), hand it to the app, and the app
 * does exactly what the online path does — checks it against SHA256SUMS, unpacks
 * it, verifies it is a real build, and swaps. The checksum still has to come
 * from somewhere the user trusts, so it is either pasted in with the file or
 * read from the same tag.
 */
export function versionFromArchiveName(name: string): string | null {
  const m = name.match(/research-engine-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)-(?:linux|win|mac)/)
  return m ? m[1] : null
}

export async function installFromFile(
  deps: UpdateDeps,
  file: { name: string; buffer: Buffer },
  opts: { version?: string; sumsText?: string } = {},
): Promise<{ ok: true; pending: PendingUpdate } | { ok: false; error: string }> {
  if (busy) return { ok: false, error: 'an update is already running' }
  if (deps.kind !== 'portable' || !deps.appRoot) {
    return { ok: false, error: 'this build cannot update itself in place' }
  }
  busy = true
  try {
    const name = file.name.split(/[/\\]/).pop() ?? file.name
    const version = opts.version?.trim() || versionFromArchiveName(name) || ''
    if (!version) {
      const error = `the file name "${name}" does not carry a version — rename it like research-engine-1.2.3-${deps.platform}.tar.gz, or pass the version`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }
    setProgress({ phase: 'verifying', pct: 0, from: deps.currentVersion, to: version, message: `Checking ${name}…` })

    // 1. The checksum. Pasted, or read from the release when the network allows.
    let sumsText = opts.sumsText ?? ''
    if (!sumsText) {
      try {
        sumsText = (await fetchTextAny(deps, hashUrlsFor(deps, version, null))).text
      } catch (e: any) {
        const error = `no checksum to check ${name} against — paste the SHA256SUMS line, or let this app reach the release (${e?.message ?? e})`
        setProgress({ phase: 'error', error, message: error })
        return { ok: false, error }
      }
    }
    const want = expectedHash(sumsText, name)
    if (!want) {
      const error = `${name} is not listed in the checksums you gave — refusing to install unverified`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    // 2. Verify the bytes before touching them.
    const sha256 = createHash('sha256').update(file.buffer).digest('hex')
    if (sha256 !== want) {
      const error = `checksum mismatch — expected ${want.slice(0, 12)}…, got ${sha256.slice(0, 12)}… (nothing was changed)`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    // 3. Unpack, then 4. check it is a real build of that version.
    const stage = guard(deps.appRoot, deps.dataDir, stageDir(deps), 'the staging folder')
    rmrf(stage)
    mkdirSync(stage, { recursive: true })
    setProgress({ phase: 'extracting', pct: 0, message: 'Unpacking…' })
    try {
      extractArchive(file.buffer, stage, { strip: 1 })
    } catch (e: any) {
      rmrf(stage)
      const error = `the archive could not be unpacked: ${e?.message ?? e}`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }
    const checkStage = validateStage(stage, version)
    if (!checkStage.ok) {
      rmrf(stage)
      const error = `the archive is not a usable build: ${checkStage.reason}`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    setProgress({ phase: 'swapping', pct: 100, message: 'Putting the new version in place…' })
    const pending = swapIn(deps, stage, version, deps.currentVersion)
    deps.log?.(`updated ${pending.from} → ${pending.to} from a local archive`)
    setProgress({
      phase: 'ready', pct: 100,
      message: `Updated to ${version}. Restart to run it — your library was not touched.`,
      from: pending.from, to: pending.to,
    })
    return { ok: true, pending }
  } catch (e: any) {
    const error = String(e?.message ?? e)
    setProgress({ phase: 'error', error, message: error })
    return { ok: false, error }
  } finally {
    busy = false
  }
}

/* --------------------------------------------------------------- install ---- */

let progress: UpdateProgress = { phase: 'idle', pct: 0, received: 0, total: 0, message: '' }
let busy = false

export const updateProgress = (): UpdateProgress => progress
export const isBusy = () => busy

function setProgress(patch: Partial<UpdateProgress>) {
  progress = { ...progress, ...patch }
}

/**
 * Check, download, verify, stage, swap. Never touches the data directory; on any
 * failure at all the install is left exactly as it was found.
 */
export async function installUpdate(deps: UpdateDeps, opts: { version?: string } = {}): Promise<{ ok: true; pending: PendingUpdate } | { ok: false; error: string }> {
  if (busy) return { ok: false, error: 'an update is already running' }
  if (deps.kind !== 'portable' || !deps.appRoot) {
    return { ok: false, error: new Error('this build cannot update itself in place').message }
  }
  busy = true
  try {
    setProgress({ phase: 'checking', pct: 0, message: 'Looking for the newest release…', error: undefined })
    const check = await checkForUpdate(deps)
    const target = opts.version ?? check.latest
    if (!target) return { ok: false, error: 'no release found' }
    if (!check.available && !opts.version) {
      setProgress({ phase: 'ready', pct: 100, message: `${check.current} is already the newest release.` })
      return { ok: false, error: `${check.current} is already the newest release` }
    }

    const name = archiveNameFor(target, deps.platform)
    const urls = check.latest === target && check.asset?.name === name
      ? check.asset.urls
      : fileUrls(deps, target, name)
    const hashUrls = check.latest === target && check.hashUrls.length
      ? check.hashUrls
      : fileUrls(deps, target, 'SHA256SUMS')
    setProgress({ phase: 'downloading', from: deps.currentVersion, to: target, pct: 0, received: 0, total: 0, message: `Downloading ${name}…` })

    // 1. The checksum, from the same tag as the archive.
    let sumsText = ''
    try {
      sumsText = (await fetchTextAny(deps, hashUrls)).text
    } catch (e: any) {
      const error = `could not read SHA256SUMS for ${target} (${e?.message ?? e}) — refusing to update unverified`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }
    const want = expectedHash(sumsText, name)
    if (!want) return { ok: false, error: `${name} is not listed in SHA256SUMS for ${target} — refusing to update unverified` }

    // 2. Download, with progress.
    const { buffer, sha256 } = await downloadAny(deps, urls, (received, total) => {
      setProgress({
        phase: 'downloading', received, total,
        pct: total ? Math.min(99, Math.round((received / total) * 100)) : Math.min(95, Math.round(received / 200_000)),
        message: total ? `Downloading ${name} — ${Math.round((received / total) * 100)}%` : `Downloading ${name} — ${(received / 1e6).toFixed(1)} MB`,
      })
    })

    // 3. Verify before anything is unpacked or moved.
    setProgress({ phase: 'verifying', pct: 100, message: 'Checking the download against the release checksum…' })
    if (sha256 !== want) {
      const error = `checksum mismatch — expected ${want.slice(0, 12)}…, got ${sha256.slice(0, 12)}… (nothing was changed)`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    // 4. Unpack into the app's own staging folder.
    const stage = guard(deps.appRoot, deps.dataDir, stageDir(deps), 'the staging folder')
    rmrf(stage)
    mkdirSync(stage, { recursive: true })
    setProgress({ phase: 'extracting', pct: 0, message: 'Unpacking…' })
    try {
      extractArchive(buffer, stage, { strip: 1 })
    } catch (e: any) {
      rmrf(stage)
      const error = `the archive could not be unpacked: ${e?.message ?? e}`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    const checkStage = validateStage(stage, target)
    if (!checkStage.ok) {
      rmrf(stage)
      const error = `the archive is not a usable build: ${checkStage.reason}`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }

    // 5. Swap, keeping the current version as the backup.
    setProgress({ phase: 'swapping', pct: 100, message: 'Putting the new version in place…' })
    const pending = swapIn(deps, stage, target, deps.currentVersion)
    deps.log?.(`updated ${pending.from} → ${pending.to}; previous version kept at ${pending.backup}`)
    setProgress({
      phase: 'ready', pct: 100,
      message: `Updated to ${target}. Restart to run it — your library was not touched.`,
      from: pending.from, to: pending.to,
    })
    return { ok: true, pending }
  } catch (e: any) {
    const error = String(e?.message ?? e)
    setProgress({ phase: 'error', error, message: error })
    return { ok: false, error }
  } finally {
    busy = false
  }
}

/** A new version proved it can serve pages — the swap is final. */
export function markHealthy(deps: UpdateDeps, pending: PendingUpdate) {
  clearPending(deps)
  writeOutcome(deps, { ok: true, from: pending.from, to: pending.to, at: (deps.now ?? Date.now)() })
  deps.log?.(`update to ${pending.to} is serving — keeping it`)
}

/** Record a boot attempt; returns the marker as it now stands. */
export function noteBootAttempt(deps: UpdateDeps, pending: PendingUpdate): PendingUpdate {
  const next = { ...pending, attempts: pending.attempts + 1 }
  writePending(deps, next)
  return next
}

/* ------------------------------------------------------------ the desktop ---- */

/**
 * The desktop app (Tauri) runs a single-file server the app owns, so it cannot
 * replace itself while running. What it *can* do is fetch the verified installer
 * and hand it to the OS — the installer swaps the program, and the library in
 * the data directory stays where it is.
 */
export interface InstallerResult {
  ok: boolean
  file?: string
  error?: string
  /** What actually got fetched, so the UI can say the right sentence. */
  via?: 'installer' | 'archive'
  message?: string
}

/** Installers are big files; nothing else this updater fetches comes close. */
const MAX_INSTALLER_BYTES = 400 * 1024 * 1024

export async function downloadInstaller(deps: UpdateDeps, downloadDir: string): Promise<InstallerResult> {
  try {
    const check = await checkForUpdate(deps)
    if (!check.latest) return { ok: false, error: 'no release found' }
    if (!check.available) return { ok: false, error: `${check.current} is already the newest release` }
    const version = check.latest
    const all = await latestRelease(deps)
    mkdirSync(downloadDir, { recursive: true })
    const onProgress = (name: string) => (received: number, total: number) => {
      setProgress({
        phase: 'downloading', received, total, to: version,
        pct: total ? Math.round((received / total) * 100) : 0,
        message: total ? `Downloading ${name} — ${Math.round((received / total) * 100)}%` : `Downloading ${name}…`,
      })
    }

    const installer = all?.assets.find((a) => deps.platform.startsWith('win')
      ? /setup\.exe$/i.test(a.name)
      : deps.platform.startsWith('darwin') ? /\.dmg$/i.test(a.name) : /\.(AppImage|deb)$/i.test(a.name))

    if (installer) {
      setProgress({ phase: 'downloading', message: `Downloading ${installer.name}…`, pct: 0, received: 0, total: installer.size, to: version })
      // Through `downloadAny`, so the token rides along and both the API and
      // browser forms are tried in turn. This used to call `download()` with the
      // bare browser URL and no Authorization header, which is a guaranteed 404
      // on a private repository — the "download failed" report.
      const { buffer, sha256 } = await downloadAny(deps, assetUrlsFor(deps, installer), onProgress(installer.name), MAX_INSTALLER_BYTES)
      const file = join(downloadDir, installer.name)
      writeFileSync(file, buffer)
      writeFileSync(`${file}.sha256`, `${sha256}  ${installer.name}\n`)
      setProgress({ phase: 'ready', pct: 100, message: `${installer.name} downloaded — open it to install.` })
      return { ok: true, file, via: 'installer', message: `${installer.name} downloaded — open it to finish the update. Your library stays where it is.` }
    }

    /*
     * No installer for this platform. Plenty of releases publish only the
     * portable archives — this repository's own releases do — and the honest
     * answer there is the same archive the in-place updater would use, verified
     * against the release's SHA256SUMS, saved somewhere the user can reach it.
     * (Failing with "no installer" was the other half of the download report.)
     */
    const name = archiveNameFor(version, deps.platform)
    const asset = all?.assets.find((a) => a.name === name) ?? null
    const urls = archiveUrlsFor(deps, version, all, asset)
    if (!urls.length) return { ok: false, error: `the ${version} release has nothing to download for ${deps.platform}` }

    let want: string | null = null
    try {
      const sumsText = (await fetchTextAny(deps, hashUrlsFor(deps, version, all))).text
      want = expectedHash(sumsText, name)
    } catch { /* the archive's own .sha256 below is written from the bytes we got */ }
    if (want === null && !asset) return { ok: false, error: `${name} is not part of the ${version} release` }

    setProgress({ phase: 'downloading', message: `Downloading ${name}…`, pct: 0, received: 0, total: asset?.size ?? 0, to: version })
    const { buffer, sha256 } = await downloadAny(deps, urls, onProgress(name), MAX_INSTALLER_BYTES)
    if (want && sha256 !== want) {
      const error = `checksum mismatch — expected ${want.slice(0, 12)}…, got ${sha256.slice(0, 12)}… (nothing was written)`
      setProgress({ phase: 'error', error, message: error })
      return { ok: false, error }
    }
    const file = join(downloadDir, name)
    writeFileSync(file, buffer)
    writeFileSync(`${file}.sha256`, `${sha256}  ${name}\n`)
    writeFileSync(join(downloadDir, `HOW-TO-INSTALL-${version}.txt`), [
      `Research Engine ${version} — ${name}`,
      '',
      'This release has no platform installer, so you have the portable build.',
      'Unpack it with:',
      '',
      name.endsWith('.zip')
        ? `  unzip ${name}      (then run research-engine.exe)`
        : `  tar -xzf ${name}   (then run ./research-engine)`,
      '',
      'Unpack it over the folder you already run Research Engine from — or into a',
      'new one. Your library, keys and settings live in the data folder',
      '(~/.research-engine) and are never part of the download.',
      '',
      'Check the download yourself with:',
      `  sha256sum -c ${name}.sha256`,
    ].join('\n'))
    setProgress({ phase: 'ready', pct: 100, message: `${name} downloaded to ${downloadDir}.` })
    return { ok: true, file, via: 'archive', message: `${name} downloaded to ${downloadDir} — unpack it over your install folder to update.` }
  } catch (e: any) {
    const error = String(e?.message ?? e)
    setProgress({ phase: 'error', error, message: error })
    return { ok: false, error }
  }
}

/** Hand a downloaded file to the OS. Used only for an installer the user asked for. */
export function openWithOs(file: string): boolean {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
    : process.platform === 'darwin' ? ['open', [file]]
    : ['xdg-open', [file]]
  try {
    const child = spawn(cmd[0] as string, cmd[1] as string[], { detached: true, stdio: 'ignore' })
    child.unref()
    return true
  } catch { return false }
}

/* ----------------------------------------------------------------- status ---- */

export function updateStatus(deps: UpdateDeps) {
  const pending = readPending(deps)
  let backupVersions: string[] = []
  try {
    if (deps.appRoot && existsSync(backupDir(deps))) {
      backupVersions = ['previous version kept']
    }
  } catch { /* ignore */ }
  return {
    kind: deps.kind,
    appRoot: deps.appRoot,
    dataDir: deps.dataDir,
    current: deps.currentVersion,
    platform: deps.platform,
    canSelfUpdate: deps.kind === 'portable' && !!deps.appRoot,
    pending,
    backupVersions,
    outcome: readOutcome(deps),
    progress,
  }
}

/** Compare two version strings — re-exported so routes and tests share one rule. */
export { compareVersions, isNewer }
