// Shared project-path helpers. Both the IDE routes and the preview/dev-server
// manager must agree on where a project lives and what counts as a safe name,
// so the rules live here and nowhere else.
import { isAbsolute, join, relative, resolve } from 'node:path'

export function projectsRootOf(dataDir: string): string {
  return resolve(join(dataDir, 'projects'))
}

/** Directories under projects/ that are ours to manage, not projects to list. */
const INTERNAL_PREFIX = ['.import-', '.tmp-', '.trash-']
export function isInternalEntry(name: string): boolean {
  return INTERNAL_PREFIX.some((p) => name.startsWith(p))
}

/**
 * Characters that cannot appear in a folder name on at least one supported OS
 * (Windows forbids < > : " / \ | ? * and the device names below; POSIX only
 * forbids "/"). We normalise instead of rejecting — "Project #2 (draft)." is a
 * perfectly reasonable name and should not cost the user a project.
 */
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f\u007f]/g
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export interface ProjectName {
  /** The folder name that will actually be used. */
  name: string
  /** True when `name` differs from what the caller asked for. */
  changed: boolean
}

/** Strip trailing dots/spaces — Windows silently drops them, which made a
 *  project vanish from the list after being created. A name made only of dots
 *  is not a name at all, so it collapses to "". */
function tidy(n: string): string {
  return n.replace(/[. ]+$/, '')
}

/**
 * Normalise a user-supplied project name: never fails for a name a human could
 * reasonably type, only returns null when there is nothing usable left.
 */
export function normalizeProjectName(raw: string): ProjectName | null {
  const original = String(raw ?? '')
  // Strip the illegal characters, then collapse the gaps they leave behind.
  let n = original
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  n = tidy(n)
  if (!n) return null
  // "." and ".." are the projects root itself — prefix instead of rejecting.
  if (n === '.' || n === '..') n = `project${n === '.' ? '' : '-dot'}`
  // Reserved device names can't be created on Windows at all.
  if (WINDOWS_DEVICE.test(n)) n = `${n}-project`
  // Keep the folder name inside every filesystem's limits (byte-safe slice).
  if (Buffer.byteLength(n, 'utf8') > 128) {
    while (Buffer.byteLength(n, 'utf8') > 128) n = n.slice(0, -1)
    n = tidy(n)
  }
  if (!n) return null
  return { name: n, changed: n !== original.trim().replace(/\s+/g, ' ') }
}

/* ------------------------------------------------------------------ */
/* Path containment                                                    */
/*                                                                     */
/* The check that decides whether a path is inside a folder has to work */
/* on Windows, where a resolved path is `C:\\…\\projects\\demo` and the */
/* root is `C:\\…\\projects`. Comparing with a hardcoded "/" made        */
/* `abs.startsWith(root + '/')` false for EVERY project on Windows, so  */
/* the IDE could not open, create or preview anything there — the       */
/* create route then fell through to a null dereference and answered    */
/* "500 Cannot read properties of null (reading 'name')".              */
/*                                                                     */
/* `relative()` is the platform-correct test; the normalised-prefix     */
/* fallback covers a path built with the *other* platform's separator   */
/* (a Windows path checked on POSIX, or the reverse) and keeps the      */
/* whole thing unit-testable without a Windows machine.                 */
/* ------------------------------------------------------------------ */

/** Trailing separators dropped and separators unified, so `/a/b/` === `/a/b`
 *  and `C:\\a\\b` === `C:/a/b`. Lower-cased on Windows, where the filesystem
 *  itself is case-insensitive. */
function normPath(p: string): string {
  const unified = p.replace(/[\\/]+/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? unified.toLowerCase() : unified
}

/** True when `child` is `parent` or sits inside it. */
export function isWithinDir(parent: string, child: string): boolean {
  if (normPath(parent) === normPath(child)) return true
  const rel = relative(parent, child)
  if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) return true
  return normPath(child).startsWith(normPath(parent) + '/')
}

/** True only when `child` sits *inside* `parent` — a project is never the
 *  projects root, and a file is never the folder it lives in. */
export function isStrictlyWithinDir(parent: string, child: string): boolean {
  return normPath(parent) !== normPath(child) && isWithinDir(parent, child)
}

/** Back-compat wrapper: the normalised name, or null when unusable. */
export function safeProjectName(name: string): string | null {
  return normalizeProjectName(name)?.name ?? null
}

/** Absolute project directory, guaranteed to sit inside the projects root. */
export function projectDirOf(projectsRoot: string, name: string): string | null {
  const n = safeProjectName(name)
  if (!n) return null
  const abs = resolve(join(projectsRoot, n))
  return isStrictlyWithinDir(projectsRoot, abs) ? abs : null
}

/** Absolute directory + the (possibly normalised) name that produced it. */
export function projectDirFor(projectsRoot: string, name: string): ({ dir: string } & ProjectName) | null {
  const normalized = normalizeProjectName(name)
  if (!normalized) return null
  const abs = resolve(join(projectsRoot, normalized.name))
  if (!isStrictlyWithinDir(projectsRoot, abs)) return null
  return { dir: abs, ...normalized }
}
