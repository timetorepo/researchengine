/**
 * What the AI is allowed to reach on this computer.
 *
 * Three modes, chosen by the user, enforced here rather than in the UI:
 *
 *   • `project`  — the open project folder only. The default.
 *   • `selected` — the project plus folders the user listed.
 *   • `full`     — the whole machine, which the user must say out loud.
 *
 * Enforcement is a real path check on the command runner: any absolute path in
 * a command must resolve inside the allowed roots, or the command is refused
 * with the reason. It cannot make a shell safe — nothing can — but it stops the
 * ordinary accident of an agent reading a home directory it was never given,
 * and it makes the boundary visible instead of implied.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

export type AccessMode = 'project' | 'selected' | 'full'

export interface AgentAccess {
  mode: AccessMode
  /** Extra roots, for `selected`. Absolute paths, `~` expanded. */
  roots: string[]
}

const DEFAULTS: AgentAccess = { mode: 'project', roots: [] }

const file = (dataDir: string) => join(dataDir, 'agent-access.json')

export async function getAccess(dataDir: string): Promise<AgentAccess> {
  try {
    const raw = JSON.parse(await readFile(file(dataDir), 'utf8'))
    const mode: AccessMode = raw?.mode === 'full' || raw?.mode === 'selected' ? raw.mode : 'project'
    const roots = Array.isArray(raw?.roots) ? raw.roots.filter((r: unknown) => typeof r === 'string') : []
    return { mode, roots }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function setAccess(dataDir: string, next: Partial<AgentAccess>): Promise<AgentAccess> {
  const current = await getAccess(dataDir)
  const mode: AccessMode = next.mode === 'full' || next.mode === 'selected' || next.mode === 'project' ? next.mode : current.mode
  const roots = Array.isArray(next.roots) ? next.roots.map(expand).filter(Boolean) : current.roots
  const value: AgentAccess = { mode, roots: roots.slice(0, 32) }
  await mkdir(dirname(file(dataDir)), { recursive: true })
  await writeFile(file(dataDir), JSON.stringify(value, null, 2) + '\n', 'utf8')
  return value
}

export const expand = (p: string): string => {
  const s = String(p ?? '').trim()
  if (!s) return ''
  if (s === '~') return homedir()
  if (s.startsWith('~/') || s.startsWith('~\\')) return join(homedir(), s.slice(2))
  return isAbsolute(s) ? s : ''
}

const within = (root: string, path: string): boolean => {
  const r = resolve(root)
  const p = resolve(path)
  return p === r || p.startsWith(r.endsWith(sep) ? r : r + sep)
}

/**
 * The absolute paths a shell command mentions. Catches `/etc/passwd`,
 * `~/Documents`, `$HOME/.ssh` and Windows drive paths; deliberately simple,
 * because a clever parser here would be a false sense of safety.
 */
export function absolutePathsIn(command: string): string[] {
  const out: string[] = []
  const re = /(?:^|[\s"'=<>(|;&])((?:~|\/|[A-Za-z]:[\\/])[^\s"'`|;&)>]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(command))) {
    const p = m[1]
    if (!p || p === '/' ) continue
    if (p.startsWith('/dev/') || p.startsWith('/tmp/')) continue
    out.push(expand(p.startsWith('~') ? p : p))
  }
  return out
}

export interface AccessVerdict {
  allowed: boolean
  reason?: string
  /** The paths that failed, for the sentence shown to the user. */
  offending?: string[]
}

/**
 * May this command run under the current access settings?
 * The project folder is always allowed; extra roots are allowed in `selected`;
 * everything is allowed in `full`.
 */
export function checkCommand(command: string, access: AgentAccess, projectDir: string | null, worktreesRoot?: string): AccessVerdict {
  if (access.mode === 'full') return { allowed: true }
  const roots = [projectDir, worktreesRoot, ...access.roots].filter(Boolean) as string[]
  const offending = absolutePathsIn(command).filter((p) => !roots.some((root) => within(root, p)))
  if (!offending.length) return { allowed: true }
  const shown = offending.slice(0, 3).join(', ')
  return {
    allowed: false,
    offending,
    reason: access.mode === 'project'
      ? `This command reaches outside the open project (${shown}). Turn on more access in Settings → Coding & MCP, or name the knowledge it needs inside the project.`
      : `This command reaches outside the folders the AI was given (${shown}). Add that folder in Settings → Coding & MCP if it should be reachable.`,
  }
}

/** Human-readable roots, for the UI and the report. */
export function describeAccess(a: AgentAccess, projectDir: string | null): string {
  if (a.mode === 'full') return 'The whole computer.'
  if (a.mode === 'project') return `Only the open project${projectDir ? ` (${projectDir})` : ''}.`
  return [`The open project`, ...a.roots].join(' · ') || 'Only the open project.'
}
