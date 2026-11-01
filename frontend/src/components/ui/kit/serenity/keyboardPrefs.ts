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
