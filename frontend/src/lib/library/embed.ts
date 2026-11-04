/**
 * Which sites refuse to be embedded, and where the local proxy lives.
 *
 * The browser tab of the source viewer tries the real page first, but half
 * the interesting web answers a frame with `frame-ancestors` and a "refused
 * to connect" interstitial. For the hosts below that refusal is policy, so
 * the viewer goes straight to the proxied view: the app's own server fetches
 * the page and serves it without the site's frame-blocking headers (see
 * backend/src/services/reader/proxy.ts — the list there must match this one,
 * and a test reads both files and fails if they drift).
 */

export const EMBED_HOSTILE = [
  'awwwards.com', 'dribbble.com', 'refero.design', 'behance.net', 'mobbin.com',
  'pinterest.com', 'instagram.com', 'facebook.com', 'linkedin.com', 'threads.net',
  'x.com', 'twitter.com', 'medium.com', 'google.com', 'youtube.com', 'notion.so',
]

export function isHostileToEmbedding(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return EMBED_HOSTILE.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** The viewer points its frame here for a proxied page. */
export const proxyPath = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`
