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
    `${rawBase(deps)}/${REPO}/v${version}/downloads/${name}`,
    `${apiBase(deps)}/repos/${REPO}/contents/downloads/${name}?ref=v${version}`,
  ]
}

/** The same file, in the shape a fetch needs (the API path wants a different accept). */
function requestFor(url: string): { url: string; init: RequestInit } {
  const isApi = url.includes('/contents/')
  return {
    url,
    init: {
      headers: {
        accept: isApi ? 'application/vnd.github.raw' : 'application/octet-stream',
        'user-agent': 'research-engine-updater',
      },
    },
  }
}

async function getJson(deps: UpdateDeps, url: string): Promise<any> {
  const doFetch = deps.fetchImpl ?? fetch
  const res = await doFetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'research-engine-updater' } })
  if (!res.ok) throw new Error(`GitHub replied ${res.status} for ${url}`)
  return await res.json()
}

/** Newest published release, prereleases included (see version.ts for why). */
export async function latestRelease(deps: UpdateDeps): Promise<ReleaseInfo | null> {
  const list = await getJson(deps, `${apiBase(deps)}/repos/${REPO}/releases?per_page=30`)
  if (!Array.isArray(list)) throw new Error('unexpected release list from GitHub')
  return pickLatest(list as ReleaseLike[], 'beta')
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
      ? { name, urls: fileUrls(deps, latest.version, name), size: asset?.size ?? 0 }
      : asset ? { name: asset.name, urls: [asset.url], size: asset.size } : null,
    hashUrls: latest ? fileUrls(deps, latest.version, 'SHA256SUMS') : [],
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
      const req = requestFor(url)
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
      const req = requestFor(url)
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
export async function downloadInstaller(deps: UpdateDeps, downloadDir: string): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const check = await checkForUpdate(deps)
    if (!check.latest || !check.available) return { ok: false, error: `${check.current} is already the newest release` }
    const all = await latestRelease(deps)
    const asset = all?.assets.find((a) => deps.platform.startsWith('win')
      ? /setup\.exe$/i.test(a.name)
      : deps.platform.startsWith('darwin') ? /\.dmg$/i.test(a.name) : /\.AppImage$/i.test(a.name))
    if (!asset) return { ok: false, error: `the ${check.latest} release has no installer for ${deps.platform}` }
    setProgress({ phase: 'downloading', message: `Downloading ${asset.name}…`, pct: 0, received: 0, total: asset.size, to: check.latest })
    const { buffer, sha256 } = await download(deps, asset.url, (received, total) => {
      setProgress({ phase: 'downloading', received, total, pct: total ? Math.round((received / total) * 100) : 0, message: `Downloading ${asset.name}…` })
    })
    mkdirSync(downloadDir, { recursive: true })
    const file = join(downloadDir, asset.name)
    writeFileSync(file, buffer)
    writeFileSync(`${file}.sha256`, `${sha256}  ${asset.name}\n`)
    setProgress({ phase: 'ready', pct: 100, message: `${asset.name} downloaded — open it to install.` })
    return { ok: true, file }
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
