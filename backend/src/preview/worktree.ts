// Parallel-agent working copies.
//
// Several agents can work on one project at the same time as long as they never
// touch the same bytes. Two mechanisms give that guarantee:
//
//   1. isolation — every agent gets its own copy of the project on disk, so a
//      half-finished edit by one agent is invisible to the others (and to you);
//   2. a checked merge — the copy records the hash of every file it was forked
//      from, so when the agent hands its work back we can tell "nobody else
//      touched this" from "you both edited it", and refuse the second one
//      instead of silently clobbering it.
//
// Everything here is plain fs + hashes, deliberately free of HTTP so it can be
// exercised by tests: fork → edit → merge → conflict.
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** Folders that are never worth copying into a working copy. */
export const WT_SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output', 'out',
  'coverage', '__pycache__', '.venv', 'venv', '.turbo', '.cache', '.parcel-cache',
  'target', 'vendor', '.pytest_cache', '.mypy_cache', '.idea', '.vscode', '.gradle',
])

const MAX_FILES = 4000
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024

export function sha1(text: string | Buffer): string {
  return createHash('sha1').update(text).digest('hex')
}

/** Agent ids come from the client — keep them to a shape that is safe in a path. */
export function agentIdOk(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(id)
}

async function walk(root: string, rel = '', out: string[] = []): Promise<string[]> {
  let entries
  try { entries = await readdir(join(root, rel), { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.re-agent')) continue
    if (e.isDirectory()) {
      if (WT_SKIP.has(e.name)) continue
      await walk(root, rel ? `${rel}/${e.name}` : e.name, out)
    } else {
      out.push(rel ? `${rel}/${e.name}` : e.name)
    }
  }
  return out
}

/** `path → sha1(content)` for everything that would be copied. */
export async function snapshotTree(root: string): Promise<Record<string, string>> {
  const files = await walk(root)
  const out: Record<string, string> = {}
  for (const rel of files.slice(0, MAX_FILES)) {
    try {
      const st = await stat(join(root, rel))
      if (st.size > MAX_FILE_BYTES) continue
      out[rel] = sha1(await readFile(join(root, rel)))
    } catch { /* unreadable file: not part of the snapshot */ }
  }
  return out
}

export interface ForkResult {
  files: number
  bytes: number
  /** Hashes at the moment of the fork — the merge base. */
  base: Record<string, string>
  skipped: string[]
}

/** Copy `project` into `worktree` and record the merge base. */
export async function forkTree(projectDir: string, worktreeDir: string): Promise<ForkResult> {
  await rm(worktreeDir, { recursive: true, force: true })
  await mkdir(worktreeDir, { recursive: true })
  const files = await walk(projectDir)
  const base: Record<string, string> = {}
  const skipped: string[] = []
  let bytes = 0
  for (const rel of files) {
    if (Object.keys(base).length >= MAX_FILES) { skipped.push(rel); continue }
    const src = join(projectDir, rel)
    try {
      const st = await stat(src)
      if (st.size > MAX_FILE_BYTES) { skipped.push(rel); continue }
      if (bytes + st.size > MAX_TOTAL_BYTES) { skipped.push(rel); continue }
      const content = await readFile(src)
      const dest = join(worktreeDir, rel)
      await mkdir(join(dest, '..'), { recursive: true })
      await writeFile(dest, content)
      base[rel] = sha1(content)
      bytes += st.size
    } catch { skipped.push(rel) }
  }
  await writeFile(join(worktreeDir, '.re-agent-base.json'), JSON.stringify(base, null, 2), 'utf8')
  return { files: Object.keys(base).length, bytes, base, skipped }
}

export async function readBase(worktreeDir: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(join(worktreeDir, '.re-agent-base.json'), 'utf8')) } catch { return {} }
}

export type ChangeKind = 'added' | 'modified' | 'deleted'

export interface Change {
  path: string
  kind: ChangeKind
  added: number
  removed: number
}

/** What the agent changed inside its working copy, versus the fork point. */
export async function changesIn(worktreeDir: string): Promise<Change[]> {
  const base = await readBase(worktreeDir)
  const now = await snapshotTree(worktreeDir)
  const paths = new Set([...Object.keys(base), ...Object.keys(now)])
  const out: Change[] = []
  for (const path of paths) {
    if (path === '.re-agent-base.json') continue
    const was = base[path]
    const is = now[path]
    if (was && is && was === is) continue
    if (was && !is) { out.push({ path, kind: 'deleted', added: 0, removed: 0 }); continue }
    out.push({ path, kind: was ? 'modified' : 'added', added: 0, removed: 0 })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Added/removed line counts between two versions: trim the common head and
 * tail, then run an LCS over what is left. Small, exact enough for a review
 * badge, and it never lies about a file that only grew at the end.
 */
export function lineDelta(baseText: string, nextText: string): { added: number; removed: number } {
  const a = baseText.split('\n')
  const b = nextText.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)
  if (!midA.length) return { added: midB.length, removed: 0 }
  if (!midB.length) return { added: 0, removed: midA.length }
  if (midA.length * midB.length > 250_000) {
    // Too big to align line by line (a minified bundle): report the crude delta.
    return { added: midB.length, removed: midA.length }
  }
  let dp = new Array(midB.length + 1).fill(0)
  for (let i = 1; i <= midA.length; i++) {
    const next = new Array(midB.length + 1).fill(0)
    for (let j = 1; j <= midB.length; j++) {
      next[j] = midA[i - 1] === midB[j - 1] ? dp[j - 1] + 1 : Math.max(dp[j], next[j - 1])
    }
    dp = next
  }
  const common = dp[midB.length]
  return { added: midB.length - common, removed: midA.length - common }
}

export interface MergeResult {
  merged: string[]
  conflicts: { path: string; reason: string }[]
  unchanged: string[]
  missing: string[]
}

/**
 * Bring an agent's work back into the project — but only where nobody else has
 * written since the fork. Two agents editing the same file never interleave:
 * the first merge wins and the second is reported, with both versions kept on
 * disk so nothing is lost.
 */
export async function mergeTree(opts: {
  worktreeDir: string
  projectDir: string
  /** Restrict the merge to these paths (the review pane's accepted files). */
  only?: string[]
  now?: number
}): Promise<MergeResult> {
  const { worktreeDir, projectDir } = opts
  const base = await readBase(worktreeDir)
  const changes = await changesIn(worktreeDir)
  const only = opts.only && opts.only.length ? new Set(opts.only) : null
  const merged: string[] = []
  const conflicts: MergeResult['conflicts'] = []
  const unchanged: string[] = []
  const missing: string[] = []

  for (const change of changes) {
    const path = change.path
    if (only && !only.has(path)) { unchanged.push(path); continue }
    const projectPath = join(projectDir, path)
    const worktreePath = join(worktreeDir, path)
    const baseHash = base[path]

    if (change.kind === 'deleted') {
      // A deletion only lands when the file in the project is still the one the
      // agent forked from.
      let current: string | null = null
      try { current = sha1(await readFile(projectPath)) } catch { current = null }
      if (current === null) { unchanged.push(path); continue }
      if (baseHash && current !== baseHash) { conflicts.push({ path, reason: 'Changed in the project since this agent started — kept, nothing deleted.' }); continue }
      await rm(projectPath, { force: true })
      merged.push(path)
      continue
    }

    let agentContent: Buffer
    try { agentContent = await readFile(worktreePath) } catch { missing.push(path); continue }
    const agentHash = sha1(agentContent)

    if (baseHash && agentHash === baseHash) { unchanged.push(path); continue }

    let currentHash: string | null = null
    try { currentHash = sha1(await readFile(projectPath)) } catch { currentHash = null }

    if (currentHash === null) {
      // The file is new (or was removed here): create it.
      await mkdir(join(projectPath, '..'), { recursive: true })
      await writeFile(projectPath, agentContent)
      merged.push(path)
      continue
    }
    if (!baseHash || currentHash === baseHash || currentHash === agentHash) {
      await mkdir(join(projectPath, '..'), { recursive: true })
      await writeFile(projectPath, agentContent)
      merged.push(path)
      continue
    }

    // Both sides moved: keep both, prefer nothing.
    const stamp = new Date(opts.now ?? Date.now()).toISOString().replace(/[:.]/g, '-')
    const aside = `${projectPath}.agent-conflict-${stamp}`
    try { await copyFile(worktreePath, aside) } catch { /* conflict copy is best-effort */ }
    conflicts.push({
      path,
      reason: baseHash
        ? 'You (or another agent) edited this file after the fork — this agent\'s version was kept aside.'
        : 'This file already existed in the project — this agent\'s version was kept aside.',
    })
  }

  return { merged, conflicts, unchanged, missing }
}

/** Where working copies live for a project. */
export function worktreePathFor(worktreesRoot: string, project: string, agent: string, projectIsSafe: (p: string) => boolean): string | null {
  if (!agentIdOk(agent)) return null
  if (!projectIsSafe(project)) return null
  return join(worktreesRoot, project, agent)
}

/** Human summary used by the UI and by the agent's own log line. */
export function describeChanges(changes: Change[]): string {
  if (!changes.length) return 'no file changes'
  const added = changes.filter((c) => c.kind === 'added').length
  const modified = changes.filter((c) => c.kind === 'modified').length
  const deleted = changes.filter((c) => c.kind === 'deleted').length
  const bits = [added ? `${added} added` : '', modified ? `${modified} edited` : '', deleted ? `${deleted} deleted` : ''].filter(Boolean)
  return `${changes.length} file${changes.length === 1 ? '' : 's'} — ${bits.join(', ')}`
}

/** Relative path of `abs` inside `root`, or null when it escapes. */
export function relInside(root: string, abs: string): string | null {
  const rel = relative(root, abs)
  if (!rel || rel.startsWith('..') || rel.includes('\u0000')) return null
  return rel.split('\\').join('/')
}
