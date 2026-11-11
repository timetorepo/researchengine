// Preferences for the launch intro, kept apart from the intro itself so that the
// Settings screen and the app shell can read them without loading the WebGL logo.

/** Set once the intro has been shown on this machine. */
export const INTRO_SEEN = 'intro.logo.seen'
/** When on, the intro plays on every launch, not only the first. */
export const INTRO_EVERY = 'intro.logo.every'
/** Window event that plays the intro now (Settings → Appearance → "Play intro"). */
export const INTRO_PLAY_EVENT = 'logo-intro:play'

function read(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function write(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? '1' : '0') } catch { /* private mode */ }
}

export const readIntroSeen = () => read(INTRO_SEEN)
export const markIntroSeen = () => write(INTRO_SEEN, true)
export const readIntroEvery = () => read(INTRO_EVERY)
export const setIntroEvery = (on: boolean) => write(INTRO_EVERY, on)

/** True when the intro should play at this launch. */
export function introDue(): boolean {
  return !readIntroSeen() || readIntroEvery()
}

export function playIntroNow(): void {
  window.dispatchEvent(new Event(INTRO_PLAY_EVENT))
}
