// Theme engine — mirrors frontend/src/lib/themes/meta.ts applyTheme() semantics
// exactly (docs/mobile/01-tokens.md). Swatch data comes from the generated
// tokens dist so mobile cannot drift from the JSON by construction.
import themesJson from '../../../packages/tokens/dist/themes.json'
import tokens from '../../../packages/tokens/dist/tokens.json'

export type ThemeId = (typeof themesJson)[number]['id']

export interface ThemeMetaLite {
  id: string
  name: string
  kind: 'dark' | 'light'
  swatches: [string, string, string, string]
  codeTheme: string
  caption?: string
}

export const THEMES = themesJson as unknown as ThemeMetaLite[]
export const THEME_IDS = THEMES.map((t) => t.id)
export const RADIUS = tokens.radius
export const MOTION_MS = tokens.motion.durations
export const FRAME = tokens.frameBudget
export const LATENCY = tokens.latency

export interface ThemeOpts {
  fontScale?: number
  compact?: boolean
  reduceMotion?: boolean
}

/**
 * Switching a theme must be repaint-only (docs/mobile/11-latency.md tier 1):
 * we mutate the root element's dataset/classes/vars and nothing else. No
 * re-mount, no fetch, no state churn. Tested at ≤10 ms p95 in
 * mobile/scripts/test.mts (JS-side; the device-side paint assertion runs in
 * the on-device harness, see docs/mobile/10-performance.md).
 */
export function applyTheme(id: string, opts: ThemeOpts = {}) {
  const el = document.documentElement
  el.dataset.theme = id
  el.style.setProperty('--font-scale', String(opts.fontScale ?? 1))
  el.classList.toggle('compact', !!opts.compact)
  el.classList.toggle('reduce-motion', !!opts.reduceMotion)
  const scheme = THEMES.find((t) => t.id === id)?.kind ?? 'dark'
  el.style.colorScheme = scheme
  // keep the meta theme-color tag in sync with the theme bg (status bar)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', (THEMES.find((t) => t.id === id)?.swatches ?? ['#0A0A0B'])[0])
}
