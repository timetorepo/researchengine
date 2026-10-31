// Sign-in flights: one record per connect attempt, so the app knows what happened
// in the sign-in window even when that window is in the default browser.
//
// States:
//   open       the sign-in link was handed out and nothing has come back yet
//   returned   the provider sent the person back to our done page (they signed in)
//   closed     the sign-in window was closed before the provider sent them back
//   connected  the app saw the new account and says so (closes the sign-in window)
//   failed     the app gave up on the attempt
//
// Nothing secret is stored here: only the sign-in link the provider gave us, which
// the app already holds. Records expire after 30 minutes and the table is bounded.
export type SignInState = 'open' | 'returned' | 'closed' | 'connected' | 'failed'
export type SignInProvider = 'composio' | 'pipedream'

export interface SignInFlight {
  id: string
  provider: SignInProvider
  target: string
  state: SignInState
  updatedAt: number
  /** Why the attempt failed, when the provider said so (for example 'provider_error'). */
  reason?: SignInReason
}

/** A failure the provider reported on its own error address, as opposed to a silent timeout. */
export type SignInReason = 'provider_error'

const TTL_MS = 30 * 60_000
const MAX = 200
const ID = /^[A-Za-z0-9_-]{8,64}$/

const flights = new Map<string, SignInFlight>()

export const SIGNIN_ID = ID

/** A sign-in link must be https, or plain http to this machine (the desktop app's own server). */
export function isSignInTarget(url: string): boolean {
  if (url.length > 2000) return false
  try {
    const u = new URL(url)
    if (u.username || u.password) return false
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
}

function prune(now: number): void {
  for (const [id, f] of flights) if (now - f.updatedAt > TTL_MS) flights.delete(id)
  while (flights.size >= MAX) {
    const oldest = flights.keys().next().value
    if (oldest === undefined) break
    flights.delete(oldest)
  }
}

export function startSignIn(id: string, provider: SignInProvider, target: string, now = Date.now()): SignInFlight | null {
  if (!ID.test(id) || !isSignInTarget(target)) return null
  prune(now)
  const f: SignInFlight = { id, provider, target, state: 'open', updatedAt: now }
  flights.set(id, f)
  return f
}

export function getSignIn(id: string, now = Date.now()): SignInFlight | undefined {
  if (!ID.test(id)) return undefined
  const f = flights.get(id)
  if (f && now - f.updatedAt > TTL_MS) { flights.delete(id); return undefined }
  return f
}

const ALLOWED: Record<SignInState, SignInState[]> = {
  open: ['returned', 'closed', 'connected', 'failed'],
  // A closed window cannot come back; a returned one may still be confirmed or fail.
  returned: ['connected', 'failed'],
  closed: ['connected', 'failed'],
  connected: [],
  failed: [],
}

/**
 * Move a flight to a new state. Returns false when the move is not allowed, for
 * example a late 'closed' after the person already came back.
 */
export function moveSignIn(id: string, next: SignInState, now = Date.now(), reason?: SignInReason): SignInFlight | null {
  const f = getSignIn(id, now)
  if (!f) return null
  if (f.state === next) return f
  if (!ALLOWED[f.state].includes(next)) return null
  f.state = next
  f.updatedAt = now
  if (reason) f.reason = reason
  return f
}

/** Test helper. */
export function signInCount(): number {
  return flights.size
}
