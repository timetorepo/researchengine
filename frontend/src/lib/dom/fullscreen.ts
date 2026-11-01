/**
 * Fullscreen, for the whole app.
 *
 * One toggle in the top bar asks the browser (or the desktop shell's webview)
 * to give the window to the app. Everything is feature-detected: a webview
 * without the API simply reports "not supported" and the button explains it
 * instead of doing nothing in silence.
 */

type AnyDoc = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type AnyEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as AnyDoc
  const el = document.documentElement as AnyEl
  return !!(document.exitFullscreen ?? d.webkitExitFullscreen) || !!el.webkitRequestFullscreen
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as AnyDoc
  return !!(document.fullscreenElement ?? d.webkitFullscreenElement)
}

/** Enter or leave fullscreen. Resolves true when the request went through. */
export async function toggleFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const d = document as AnyDoc
  const el = document.documentElement as AnyEl
  try {
    if (isFullscreen()) {
      const exit = document.exitFullscreen?.bind(document) ?? d.webkitExitFullscreen?.bind(d)
      if (!exit) return false
      await exit()
      return true
    }
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el)
    if (!req) return false
    await req()
    return true
  } catch {
    // Browsers refuse programmatic fullscreen without a user gesture; the
    // toggle is a user gesture, but a webview may still say no.
    return false
  }
}

/** Subscribe to enter/leave so the button's icon never lies. */
export function onFullscreenChange(fn: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const d = document as AnyDoc
  document.addEventListener('fullscreenchange', fn)
  d.addEventListener?.('webkitfullscreenchange', fn as EventListener)
  return () => {
    document.removeEventListener('fullscreenchange', fn)
    d.removeEventListener?.('webkitfullscreenchange', fn as EventListener)
  }
}
