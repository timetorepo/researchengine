/**
 * Home-screen wallpapers.
 *
 * The set is Raycast's own collection (raycast.com/wallpapers) — the reference
 * this app's widget surfaces were styled against, and the art the home screen's
 * optional background is drawn from. Their originals are HEIC, up to 6016 px;
 * these are 1280×720 WebP crops (≈10–20 kB each) so a wallpaper costs less than
 * a route chunk. The full-size originals are one link away in the picker.
 *
 * A wallpaper is a *background*: it is drawn behind the composer and widgets
 * with a scrim, never on top of text, and it is off unless it is chosen.
 */

export interface Wallpaper {
  id: string
  name: string
  /** What it looks like, for the picker's caption. */
  note: string
  file: string
  /** Dark art needs light type over it; light art needs dark type. */
  tone: 'dark' | 'light'
}

const file = (id: string) => `/wallpapers/${id}.webp`

export const WALLPAPERS: Wallpaper[] = [
  { id: 'chromatic-dark-1', name: 'Chromatic Dark 1', note: 'Ink, teal and coral strata', file: file('chromatic-dark-1'), tone: 'dark' },
  { id: 'chromatic-dark-2', name: 'Chromatic Dark 2', note: 'Coral and white ribbons', file: file('chromatic-dark-2'), tone: 'dark' },
  { id: 'chromatic-light-2', name: 'Chromatic Light 2', note: 'Blue and violet haze', file: file('chromatic-light-2'), tone: 'light' },
  { id: 'mono-dark-1', name: 'Mono Dark 1', note: 'Graphite folds', file: file('mono-dark-1'), tone: 'dark' },
  { id: 'mono-dark-2', name: 'Mono Dark 2', note: 'Silver on black', file: file('mono-dark-2'), tone: 'dark' },
  { id: 'loupe-mono-dark', name: 'Loupe', note: 'One lit ring', file: file('loupe-mono-dark'), tone: 'dark' },
  { id: 'red-distortion-1', name: 'Red Distortion 1', note: 'Crimson smears', file: file('red-distortion-1'), tone: 'dark' },
  { id: 'red-distortion-4', name: 'Red Distortion 4', note: 'Deep red interference', file: file('red-distortion-4'), tone: 'dark' },
  { id: 'glaze-1', name: 'Glaze 1', note: 'Soft aurora glass', file: file('glaze-1'), tone: 'light' },
  { id: 'glass-rainbow', name: 'Glass Rainbow', note: 'Liquid ribbon', file: file('glass-rainbow'), tone: 'dark' },
]

export const WALLPAPER_BY_ID: Record<string, Wallpaper> =
  Object.fromEntries(WALLPAPERS.map((w) => [w.id, w]))

export function wallpaperOf(id?: string | null): Wallpaper | null {
  return id ? WALLPAPER_BY_ID[id] ?? null : null
}

/** Where the originals live, credited in the picker. */
export const WALLPAPER_SOURCE = 'https://www.raycast.com/wallpapers'

/**
 * The scrim over a wallpaper.
 *
 * Wallpapers are photographs of *light*, and text sits on them. Rather than
 * guess per image, every wallpaper is covered by the page colour at a fixed
 * strength, fading out toward the top where the hero type lives: the art reads
 * strongest where nothing is written on it, and the contrast under the
 * composer stays at the theme's own level.
 */
export function wallpaperScrim(dark: boolean): string {
  return dark
    ? 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 82%, transparent) 0%, color-mix(in srgb, var(--bg) 62%, transparent) 42%, color-mix(in srgb, var(--bg) 78%, transparent) 100%)'
    : 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 80%, transparent) 0%, color-mix(in srgb, var(--bg) 58%, transparent) 42%, color-mix(in srgb, var(--bg) 76%, transparent) 100%)'
}
