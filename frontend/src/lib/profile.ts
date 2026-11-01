/**
 * The local profile: who the app is for.
 *
 * There is no account here and there never will be — this is a name, a handle
 * and a face, stored next to everything else in your own data directory. The
 * face is a **blobatar**: a geometric creature derived deterministically from
 * the handle, so the same handle always draws the same blobatar, on any machine
 * (https://blobatar.dev). Pick a handle, get a face; add salt to re-roll the
 * look without changing who you are.
 */

/** What to show as your face: a generated blobatar, or plain initials. */
export type AvatarKind = 'blobatar' | 'initials'
export type AvatarShape = 'circle' | 'squircle' | 'square'
export type AvatarMotion = 'hover' | 'always' | 'off'
export type AvatarExpression =
  | 'idle' | 'happy' | 'thinking' | 'smug' | 'surprised' | 'wink' | 'sleepy' | 'unsure' | 'shy' | 'love'

export interface Profile {
  /** What we call you in the interface. */
  name: string
  /** The handle the blobatar is derived from. */
  handle: string
  /** One line about you, shown in Settings → Profile. */
  bio: string
  /**
   * A few things you are into. Shown as chips on the profile card (in a
   * different order each visit) and sent along with research context.
   */
  hobbies: string[]
  avatar: {
    kind: AvatarKind
    shape: AvatarShape
    motion: AvatarMotion
    expression: AvatarExpression
    /** Locks the hue in degrees; null lets the handle decide the colour. */
    hue: number | null
    /** Salt re-rolls the look while the handle stays the same. */
    salt: string
  }
}

export const EXPRESSIONS: { id: AvatarExpression; label: string }[] = [
  { id: 'idle', label: 'Neutral' },
  { id: 'happy', label: 'Happy' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'smug', label: 'Smug' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'wink', label: 'Wink' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'unsure', label: 'Unsure' },
  { id: 'shy', label: 'Shy' },
  { id: 'love', label: 'Delighted' },
]

export const DEFAULT_PROFILE: Profile = {
  name: 'Researcher',
  handle: 'researcher',
  bio: 'Local-first, key-in-hand, no telemetry.',
  hobbies: ['research', 'reading', 'writing'],
  avatar: { kind: 'blobatar', shape: 'circle', motion: 'hover', expression: 'idle', hue: null, salt: '' },
}

/** Merge whatever was persisted over the defaults (older layouts, new fields). */
export function withProfileDefaults(p?: Partial<Profile> | null): Profile {
  return {
    ...DEFAULT_PROFILE,
    ...(p ?? {}),
    hobbies: Array.isArray(p?.hobbies) ? p!.hobbies : DEFAULT_PROFILE.hobbies,
    avatar: { ...DEFAULT_PROFILE.avatar, ...(p?.avatar ?? {}) },
  }
}

/**
 * Bring a stored profile up to date.
 *
 * Older installs only had `settings.profileName` — no profile object at all —
 * so that name is promoted into the profile once, and a profile that predates
 * `avatar` gains the avatar defaults without losing anything the user set.
 */
export function migrateProfile(profileName: string | undefined, stored: Partial<Profile> | null | undefined): Profile {
  const base = stored ?? {}
  const seeded = !base.name && profileName ? { ...base, name: profileName } : base
  return withProfileDefaults(seeded)
}

/** The string a blobatar is derived from — handle, salt, then a stable fallback. */
export function blobatarSeed(profile: Profile): string {
  const base = (profile.handle || profile.name || 'researcher').trim().toLowerCase()
  const salt = profile.avatar.salt.trim()
  return salt ? `${base}#${salt}` : base
}

/** Initials, for the (brief) moment before a blobatar can render. */
export function initialsOf(profile: Profile): string {
  const source = (profile.name || profile.handle || 'Researcher').trim()
  return source.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'R'
}

const HANDLE_RE = /[^a-z0-9._-]/g

/** Handles are lowercase, no spaces — the way a username usually works. */
export function normalizeHandle(raw: string): string {
  const clean = String(raw ?? '').toLowerCase().trim().replace(/\s+/g, '-').replace(HANDLE_RE, '').slice(0, 32)
  // A handle of only dots and dashes is not a handle.
  return /[a-z0-9]/.test(clean) ? clean : ''
}
