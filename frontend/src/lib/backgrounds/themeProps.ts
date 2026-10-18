/**
 * Theme → background props adapter.
 * Animated backgrounds never hardcode colors: they receive palette vectors
 * derived from the active theme's swatches, so switching themes re-tints
 * them live. ShapeGrid is the exception by design — it stays neutral/crisp
 * regardless of the theme accent (only light-vs-dark parity changes).
 */
import { THEMES } from '@/lib/themes/meta'
import type { ThemeId } from '@/types'
import type { AnimatedBgKind } from '@/types'

export type Vec3 = [number, number, number]

export interface BgThemeProps {
  bg: Vec3
  surface: Vec3
  primary: Vec3
  secondary: Vec3
  isLight: boolean
}

export function hexToVec3(hex: string): Vec3 {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function mixVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function scaleVec3(a: Vec3, t: number): Vec3 {
  return [Math.min(1, a[0] * t), Math.min(1, a[1] * t), Math.min(1, a[2] * t)]
}

const cache = new Map<ThemeId, BgThemeProps>()

export function getPropsForTheme(themeId: ThemeId): BgThemeProps {
  const hit = cache.get(themeId)
  if (hit) return hit
  const meta = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const [bg, surface, primary, secondary] = meta.swatches.map(hexToVec3)
  const props: BgThemeProps = { bg, surface, primary, secondary, isLight: meta.kind === 'light' }
  cache.set(themeId, props)
  return props
}

/** Per-kind default intensity + human labels for the settings UI. */
export const ANIMATED_BG_META: Record<AnimatedBgKind, { label: string; desc: string; defaultIntensity: number }> = {
  'shape-grid': { label: 'Shape Grid', desc: 'Crisp drifting geometry in neutral tones. Stays neutral under any theme.', defaultIntensity: 0.6 },
  'dark-veil': { label: 'Dark Veil', desc: 'Slow flowing dark smoke, tinted by the active theme.', defaultIntensity: 0.6 },
  'floating-lines': { label: 'Floating Lines', desc: 'Soft horizontal light lines drifting through depth, theme-tinted.', defaultIntensity: 0.55 },
  dither: { label: 'Dither', desc: 'Animated dithered wave pattern in theme tones.', defaultIntensity: 0.5 },
  'animated-gradient': { label: 'Animated Gradient', desc: 'Slow silk-like mist in a soft magenta, drifting behind the page.', defaultIntensity: 0.8 },
  'etched-accretion': { label: 'Etched Accretion', desc: 'A black hole in crimson and silver line work. It drifts toward the pointer and flares when you press.', defaultIntensity: 0.9 },
}
