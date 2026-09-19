// Shared project-path helpers. Both the IDE routes and the preview/dev-server
// manager must agree on where a project lives and what counts as a safe name,
// so the rules live here and nowhere else.
import { join, resolve } from 'node:path'

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

/** Back-compat wrapper: the normalised name, or null when unusable. */
export function safeProjectName(name: string): string | null {
  return normalizeProjectName(name)?.name ?? null
}

/** Absolute project directory, guaranteed to sit inside the projects root. */
export function projectDirOf(projectsRoot: string, name: string): string | null {
  const n = safeProjectName(name)
  if (!n) return null
  const abs = resolve(join(projectsRoot, n))
  return abs.startsWith(projectsRoot + '/') ? abs : null
}

/** Absolute directory + the (possibly normalised) name that produced it. */
export function projectDirFor(projectsRoot: string, name: string): ({ dir: string } & ProjectName) | null {
  const normalized = normalizeProjectName(name)
  if (!normalized) return null
  const abs = resolve(join(projectsRoot, normalized.name))
  if (!abs.startsWith(projectsRoot + '/')) return null
  return { dir: abs, ...normalized }
}
