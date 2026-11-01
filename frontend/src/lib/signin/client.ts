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

/** The state of one attempt, with the reason when the provider gave one. */
export async function signInDetail(id: string): Promise<{ state: SignInState; reason?: string }> {
  try {
    const res = await fetch(`/api/signin/${encodeURIComponent(id)}`)
    if (!res.ok) return { state: 'unknown' }
    const body = await res.json()
    const state = typeof body?.state === 'string' ? (body.state as SignInState) : 'unknown'
    return typeof body?.reason === 'string' ? { state, reason: body.reason } : { state }
  } catch {
    return { state: 'unknown' }
  }
}

/**
 * What to tell the person when the provider could not sign them in. Apps that are
 * listed in the provider's catalogue but are not among its managed sign-ins need the
 * person's own OAuth app; the fix is in the provider's project, so the message says so.
 */
export function providerFailureMessage(appName: string, reason?: string): string {
  if (reason === 'provider_error') {
    return `Pipedream could not sign you in to ${appName}. Apps outside Pipedream's managed sign-ins need your own OAuth client for that app: in your Pipedream project, add a custom OAuth client for ${appName} (Authentication tab), then connect again.`
  }
  return 'The sign-in did not finish.'
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
