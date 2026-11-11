// The keyboard's preferences, kept apart from the keyboard itself. The 3D keyboard
// pulls in three.js and react-three-fiber (about 2.5 MB of code), so anything that
// only needs the setting names or the readers must import this file, not the dock.
export type Perspective = 'fixed' | 'custom'

export const KEYBOARD_PREF = 'kb3d.enabled'
export const KEYBOARD_PERSPECTIVE = 'kb3d.perspective'
/** Dispatched on window whenever the keyboard settings change, so every surface stays in step. */
export const KEYBOARD_EVENT = 'kb3d-change'

export function readKeyboardEnabled(): boolean {
  try { return localStorage.getItem(KEYBOARD_PREF) === '1' } catch { return false }
}
export function readKeyboardPerspective(): Perspective {
  try { return (localStorage.getItem(KEYBOARD_PERSPECTIVE) as Perspective) || 'fixed' } catch { return 'fixed' }
}

/**
 * The person has read the disclaimer and agreed to the keyboard listening to keys.
 * Recorded once, the first time they turn the keyboard on; it is never sent anywhere.
 */
export const KEYBOARD_CONSENT = 'kb3d.consent'

export function readKeyboardConsent(): boolean {
  try { return localStorage.getItem(KEYBOARD_CONSENT) === '1' } catch { return false }
}
export function grantKeyboardConsent(): void {
  try { localStorage.setItem(KEYBOARD_CONSENT, '1') } catch { /* private mode: asked again next time */ }
}

/** Listening is allowed only when the keyboard is on AND the person has agreed. */
export function keyboardListening(): boolean {
  return readKeyboardEnabled() && readKeyboardConsent()
}

/** Turns the keyboard on or off and tells every surface that reads the setting. */
export function setKeyboardEnabled(on: boolean): void {
  try { localStorage.setItem(KEYBOARD_PREF, on ? '1' : '0') } catch { /* private mode */ }
  window.dispatchEvent(new Event(KEYBOARD_EVENT))
}
