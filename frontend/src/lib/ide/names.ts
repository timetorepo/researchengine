/**
 * Project-name handling, mirroring `backend/src/preview/paths.ts`.
 *
 * The rule is "normalise, never refuse": a name a human could reasonably type
 * ("Project #2 (draft).", "Café notes", "my app / v2") becomes a valid folder
 * name instead of an error message. Only a name with nothing usable left is
 * rejected, and the caller always knows the exact folder name up front.
 */
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f\u007f]/g
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const MAX_BYTES = 128

export interface ProjectNameCheck {
  /** The folder name that will be used; empty when the input is unusable. */
  name: string
  /** The input was changed to make it createable. */
  changed: boolean
  /** Why the input is unusable (only set when `name` is empty). */
  reason?: string
}

export function normalizeProjectName(raw: string): ProjectNameCheck {
  const original = String(raw ?? '')
  const typed = original.replace(/\s+/g, ' ').trim()
  let name = original.replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim()
  name = name.replace(/[. ]+$/, '')
  if (!name) return { name: '', changed: false, reason: 'Use at least one letter, number or symbol.' }
  if (name === '.' || name === '..') name = 'project'
  if (WINDOWS_DEVICE.test(name)) name = `${name}-project`
  if (new TextEncoder().encode(name).length > MAX_BYTES) {
    let cut = name
    while (new TextEncoder().encode(cut).length > MAX_BYTES) cut = cut.slice(0, -1)
    name = cut.replace(/[. ]+$/, '')
  }
  if (!name) return { name: '', changed: false, reason: 'Use at least one letter, number or symbol.' }
  return { name, changed: name !== typed }
}
