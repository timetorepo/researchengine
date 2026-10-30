// Sign-in tracking for connectors. The server keeps one record per connect attempt
// (see backend/src/routes/signin.ts). None of these calls carries a key.

export type SignInState = 'open' | 'returned' | 'closed' | 'connected' | 'failed' | 'unknown'

/** A fresh id for one connect attempt. Sent to the server with the connect request. */
export function newSignInId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Where a successful sign-in sends the person. Our own done page closes itself. */
export function signInDoneUrl(id: string): string {
  return `${window.location.origin}/api/signin/${id}/done`
}

/** The state of one attempt. A network failure is 'unknown', never a verdict. */
export async function signInState(id: string): Promise<SignInState> {
  try {
    const res = await fetch(`/api/signin/${encodeURIComponent(id)}`)
    if (res.status === 404) return 'unknown'
    if (!res.ok) return 'unknown'
    const body = await res.json()
    return typeof body?.state === 'string' ? (body.state as SignInState) : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Desktop app: open the launch page in the default browser. */
export async function openSignInInDefaultBrowser(id: string): Promise<void> {
  const res = await fetch(`/api/signin/${encodeURIComponent(id)}/open`, { method: 'POST' })
  if (res.ok) return
  const body = await res.json().catch(() => ({} as any))
  throw new Error(typeof body?.error === 'string' ? body.error : 'The default browser could not be started.')
}

/** Tell the server what the app decided, so the sign-in window can close. Best effort. */
export function reportSignIn(id: string, state: 'connected' | 'failed'): void {
  void fetch(`/api/signin/${encodeURIComponent(id)}/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state }),
    keepalive: true,
  }).catch(() => {})
}
