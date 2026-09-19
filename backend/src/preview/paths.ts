// Shared project-path helpers. Both the IDE routes and the preview/dev-server
// manager must agree on where a project lives and what counts as a safe name,
// so the rules live here and nowhere else.
import { join, resolve } from 'node:path'

export function projectsRootOf(dataDir: string): string {
  return resolve(join(dataDir, 'projects'))
}

/** Normalise + validate a user-supplied project name (no separators, 1-128 chars). */
export function safeProjectName(name: string): string | null {
  const normalized = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > 128 || normalized === '.' || normalized === '..') return null
  if (/[/\\\u0000]/.test(normalized)) return null
  return normalized
}

/** Absolute project directory, guaranteed to sit inside the projects root. */
export function projectDirOf(projectsRoot: string, name: string): string | null {
  const n = safeProjectName(name)
  if (!n) return null
  const abs = resolve(join(projectsRoot, n))
  return abs.startsWith(projectsRoot + '/') ? abs : null
}
