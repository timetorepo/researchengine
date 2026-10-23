/**
 * The startup lock.
 *
 * Research Engine holds everything: chats, sources, notes, provider keys, the
 * works. On a shared machine, or a laptop that leaves the house, that should
 * not be readable by whoever picks it up. This puts a code in front of the app.
 *
 * Three codes, and they are not three levels of the same thing:
 *
 *   main     — yours. Everything is here.
 *   duress   — the one you type when someone is making you unlock. It looks
 *              like it worked and it deletes everything. Covert on purpose:
 *              a duress code that announces itself is no use to anyone.
 *   guest    — hands the app to somebody else. They get a working Research
 *              Engine with none of your data in it, and what they create is
 *              kept apart so you can read it and they cannot read yours.
 *
 * A code is never stored. PBKDF2 over the code with a per-install salt, and
 * only the derived key is kept, so a copy of local storage does not hand over
 * the codes. The comparison is constant-time.
 *
 * This is a lock, not a safe. It protects against someone picking up an
 * unlocked-or-locked device and reading what is on screen or in local storage.
 * It does not protect against someone with the code, against a compromised
 * browser, or against a determined attacker with the disk. What it does do is
 * make the honest case work: a locked app that a stranger cannot open.
 */

const enc = new TextEncoder()

/** Where the lock's own configuration lives. Never holds a code. */
export const LOCK_CONFIG_KEY = 're.lock.config'
/** The role unlocked in this tab. In-memory only, cleared on close. */
export const LOCK_SESSION_KEY = 're.lock.session'
/** Storage namespace for the main user's data. */
export const MAIN_NAMESPACE = 're.data.main'
/** Storage namespace for a guest's data. */
export const GUEST_NAMESPACE = 're.data.guest'

export type LockRole = 'main' | 'duress' | 'guest'

export interface LockConfig {
  version: 1
  /** Base64, 16 random bytes. Regenerated if the lock is re-armed. */
  salt: string
  /** Base64 PBKDF2 output per role. `null` means that role is not set. */
  hashes: Record<LockRole, string | null>
  createdAt: number
  /** True once a duress code exists. The wipe is armed by its presence. */
  duressArmed: boolean
}

export interface LockSession {
  role: LockRole
  since: number
}

/* --------------------------------------------------------------- hashing -- */

/**
 * A fixed string folded into every derivation. Not a secret and not meant to
 * be: it costs an attacker one extra pass to rebuild a table, and it is here so
 * a hash from this app is not interchangeable with a hash of the same code from
 * some other tool.
 */
const PEPPER = 'research-engine:lock:v1'

const ITERATIONS = 150_000

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(`${PEPPER}\u0000${pin}`), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    256,
  )
  return toB64(bits)
}

/** Same length, same time, whatever the answer. */
function equalB64(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ---------------------------------------------------------------- config -- */

const emptyHashes = (): Record<LockRole, string | null> => ({ main: null, duress: null, guest: null })

export function readLockConfig(): LockConfig | null {
  try {
    const raw = localStorage.getItem(LOCK_CONFIG_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LockConfig
    if (p?.version !== 1 || typeof p.salt !== 'string') return null
    return { ...p, hashes: { ...emptyHashes(), ...(p.hashes ?? {}) } }
  } catch {
    return null
  }
}

export function isLocked(): boolean {
  const c = readLockConfig()
  return !!c && !!c.hashes.main
}

/** The roles a person can actually type. A role with no code is not a role. */
export function armedRoles(c: LockConfig | null): LockRole[] {
  if (!c) return []
  return (['main', 'duress', 'guest'] as LockRole[]).filter((r) => !!c.hashes[r])
}

/**
 * Write the lock.
 *
 * A role left out keeps the code it already has, so a guest code can be added
 * later without being told the main code again. Passing an empty string for a
 * role clears it, which is how a code is removed.
 */
export async function writeLockConfig(input: {
  main?: string
  duress?: string
  guest?: string
}): Promise<LockConfig> {
  const prev = readLockConfig()
  const salt = prev?.salt ?? toB64(crypto.getRandomValues(new Uint8Array(16)))
  const hashes = { ...emptyHashes() }
  const saltBytes = fromB64(salt)

  for (const role of ['main', 'duress', 'guest'] as LockRole[]) {
    const pin = input[role]
    if (pin === undefined) {
      hashes[role] = prev?.hashes[role] ?? null
      continue
    }
    if (pin === '') {
      hashes[role] = null
      continue
    }
    hashes[role] = await derive(pin, saltBytes)
  }

  const config: LockConfig = {
    version: 1,
    salt,
    hashes,
    createdAt: prev?.createdAt ?? Date.now(),
    duressArmed: !!hashes.duress,
  }
  localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(config))
  return config
}

/**
 * Which role a code belongs to, or null. Every armed role is checked so the
 * answer does not leak by timing, and a wrong code costs the same as a right
 * one.
 */
export async function roleForPin(pin: string): Promise<LockRole | null> {
  const config = readLockConfig()
  if (!config) return null
  const salt = fromB64(config.salt)
  const derived = await derive(pin, salt)
  // duress first: it is the one that must never be mistaken for a miss.
  for (const role of ['duress', 'main', 'guest'] as LockRole[]) {
    const stored = config.hashes[role]
    if (stored && equalB64(derived, stored)) return role
  }
  return null
}

/* --------------------------------------------------------------- session -- */

export function readLockSession(): LockSession | null {
  try {
    const raw = sessionStorage.getItem(LOCK_SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LockSession
    return p && (p.role === 'main' || p.role === 'duress' || p.role === 'guest') ? p : null
  } catch {
    return null
  }
}

export function writeLockSession(role: LockRole): LockSession {
  const session: LockSession = { role, since: Date.now() }
  sessionStorage.setItem(LOCK_SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearLockSession(): void {
  sessionStorage.removeItem(LOCK_SESSION_KEY)
}

/* ------------------------------------------------- namespaced app storage -- */

/**
 * The store's persistence layer, scoped to whoever is signed in.
 *
 * zustand's `persist` takes one storage object for the life of the app, so the
 * namespace is read on every call instead of being baked in: a guest's writes
 * land in `re.data.guest:…` and never touch `re.data.main:…`. That separation is
 * the whole point of the guest code — a guest who can see your chats is not a
 * guest, they are you.
 *
 * This is the plain string interface (`StateStorage`), so it is wrapped in
 * `createJSONStorage` where the store is configured.
 */
export const scopedStorage = {
  getItem(name: string): string | null {
    return localStorage.getItem(`${activeNamespace()}:${name}`)
  },
  setItem(name: string, value: string): void {
    const key = `${activeNamespace()}:${name}`
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      // Browser storage is about 5 MB. A long session can fill it; without this
      // the store update throws and the app can break. Trim the oldest detail
      // and retry, and tell the user what was trimmed.
      if (!isQuotaError(err)) throw err
      const trimmed = trimForQuota(value)
      try {
        localStorage.setItem(key, trimmed.value)
        notifyStorageTrimmed(trimmed.note)
      } catch {
        notifyStorageTrimmed('Browser storage is full. Newer changes stay in memory until you export or clear older chats.')
      }
    }
  },
  removeItem(name: string): void {
    localStorage.removeItem(`${activeNamespace()}:${name}`)
  },
}

/**
 * Which namespace a storage call belongs to, read fresh every time.
 *
 * Derived rather than cached, so there is no ordering requirement between this
 * module and the store: nothing has to be set before the store hydrates, and a
 * stale namespace cannot outlive the session that chose it. A role change is
 * followed by a reload, which re-hydrates the store from the right namespace.
 */
export function activeNamespace(): string {
  return readLockSession()?.role === 'guest' ? GUEST_NAMESPACE : MAIN_NAMESPACE
}

/** Everything the app has persisted for a namespace, as raw JSON text. */
export function readNamespaceKeys(ns: string): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${ns}:`)) out.push(key)
  }
  return out
}

/* ------------------------------------------------------------------ wipe -- */

export interface WipeReport {
  /** Local storage keys removed. */
  keys: number
  /** Whether the server-side store was reached. */
  server: 'wiped' | 'unreachable' | 'skipped'
  /** Anything worth telling the user, in one line. */
  note: string
}

/**
 * Delete everything, everywhere this app put it.
 *
 * The duress code's whole value is that it is indistinguishable from a
 * successful unlock until the data is already gone, so this runs before
 * anything is rendered and does not stop to ask. It is also the only function
 * here that is irreversible, which is why it lives next to the lock that calls
 * it and nowhere else.
 */
export async function wipeEverything(): Promise<WipeReport> {
  const before = localStorage.length + sessionStorage.length
  const keys = readNamespaceKeys(MAIN_NAMESPACE).length + readNamespaceKeys(GUEST_NAMESPACE).length

  // The app's own data, then everything else in the origin. A leftover key from
  // an older build is still this app's data.
  for (const k of [...readNamespaceKeys(MAIN_NAMESPACE), ...readNamespaceKeys(GUEST_NAMESPACE)]) {
    localStorage.removeItem(k)
  }
  const leftovers: string[] = []
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key) continue
    // The lock config goes last: without it there is nothing left to unlock.
    if (key === LOCK_CONFIG_KEY) continue
    if (key.startsWith('re.') || key.startsWith('research-engine')) leftovers.push(key)
  }
  for (const k of leftovers) localStorage.removeItem(k)
  sessionStorage.clear()

  let server: WipeReport['server'] = 'skipped'
  try {
    const res = await fetch('/api/data/wipe', { method: 'POST' })
    server = res.ok ? 'wiped' : 'unreachable'
  } catch {
    server = 'unreachable'
  }

  const removed = before + keys
  return {
    keys: removed,
    server,
    note: server === 'wiped'
      ? `${removed} stored item${removed === 1 ? '' : 's'} and the server-side store were deleted.`
      : `${removed} stored item${removed === 1 ? '' : 's'} were deleted. The server-side store could not be reached, so remove its data folder by hand.`,
  }
}

/** Remove the lock itself. Used by Settings when the lock is turned off. */
export function removeLockConfig(): void {
  localStorage.removeItem(LOCK_CONFIG_KEY)
  clearLockSession()
}

/* ------------------------------------------------------------ validation -- */

export const MIN_PIN_LENGTH = 4

export function normalisePin(pin: string): string {
  return pin.trim()
}

export function pinProblem(pin: string): string | null {
  const p = normalisePin(pin)
  if (p.length < MIN_PIN_LENGTH) return `Use at least ${MIN_PIN_LENGTH} characters.`
  if (p.length > 64) return 'That is longer than 64 characters.'
  if (/^\s+$/.test(p)) return 'A code of only spaces is not a code.'
  return null
}

/** Codes that are the first thing anybody tries. */
const WEAK = new Set([
  '0000', '1111', '1234', '1212', '7777', '2020', '2024', '2025', '2026',
  'password', 'letmein', 'qwerty', 'abc123', 'iloveyou', 'admin', 'root',
])

export function pinWarning(pin: string): string | null {
  const p = normalisePin(pin)
  if (WEAK.has(p.toLowerCase())) return 'That is one of the first codes anyone tries. Pick something else.'
  if (/^(\d)\1+$/.test(p)) return 'A code of one repeated digit is guessed in seconds.'
  if (p.length <= 4) return 'Four characters is short. Six or more holds up better.'
  return null
}

import { isQuotaError, trimForQuota } from './quota'

const STORAGE_EVENT = 'storage-trimmed'
function notifyStorageTrimmed(note: string) {
  try { window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: note })) } catch { /* no window */ }
}
export const STORAGE_TRIMMED_EVENT = STORAGE_EVENT
