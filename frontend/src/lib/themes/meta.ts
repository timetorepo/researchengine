import type { ThemeId } from '@/types'

export interface ThemeMeta {
  id: ThemeId
  name: string
  kind: 'dark' | 'light'
  swatches: [string, string, string, string] // bg, surface, primary, secondary
  codeTheme: string
}

export const THEMES: ThemeMeta[] = [
  { id: 'dark', name: 'Default Dark', kind: 'dark', swatches: ['#0A0A0B', '#131316', '#6C8EEF', '#A78BFA'], codeTheme: 'dark-plus' },
  { id: 'light', name: 'Default Light', kind: 'light', swatches: ['#FAFAFA', '#FFFFFF', '#4F6FE0', '#8B5CF6'], codeTheme: 'light-plus' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', kind: 'light', swatches: ['#eff1f5', '#e6e9ef', '#1e66f5', '#8839ef'], codeTheme: 'catppuccin-latte' },
  { id: 'catppuccin-frappe', name: 'Catppuccin Frappé', kind: 'dark', swatches: ['#303446', '#292c3c', '#8caaee', '#ca9ee6'], codeTheme: 'catppuccin-frappe' },
  { id: 'catppuccin-macchiato', name: 'Catppuccin Macchiato', kind: 'dark', swatches: ['#24273a', '#1e2030', '#8aadf4', '#c6a0f6'], codeTheme: 'catppuccin-macchiato' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', kind: 'dark', swatches: ['#1e1e2e', '#181825', '#89b4fa', '#cba6f7'], codeTheme: 'catppuccin-mocha' },
  { id: 'nord', name: 'Nord', kind: 'dark', swatches: ['#2e3440', '#3b4252', '#88c0d0', '#b48ead'], codeTheme: 'nord' },
  { id: 'solarized-dark', name: 'Solarized Dark', kind: 'dark', swatches: ['#002b36', '#073642', '#268bd2', '#6c71c4'], codeTheme: 'solarized-dark' },
  { id: 'solarized-light', name: 'Solarized Light', kind: 'light', swatches: ['#fdf6e3', '#eee8d5', '#268bd2', '#6c71c4'], codeTheme: 'solarized-light' },
  { id: 'high-contrast', name: 'High Contrast', kind: 'dark', swatches: ['#000000', '#0d0d0d', '#82aaff', '#c4a7ff'], codeTheme: 'hc-dark' },
  { id: 're-os', name: 'ResearchEngineOS', kind: 'dark', swatches: ['#08080c', '#16161c', '#6C8EEF', '#A78BFA'], codeTheme: 'dark-plus' },
  { id: 'perplexity', name: 'Perplexity', kind: 'dark', swatches: ['#1F1F1F', '#2A2A2A', '#20B8CD', '#7BD8E6'], codeTheme: 'dark-plus' },
]

/** Small caption shown under a theme in the picker. */
export const THEME_CAPTIONS: Partial<Record<ThemeId, string>> = {
  perplexity: 'Inspired by a familiar research tool.',
}

/** Light or dark? Used by widget libraries that need an explicit hint. */
export function themeKind(id: ThemeId): 'light' | 'dark' {
  return THEMES.find((t) => t.id === id)?.kind ?? 'dark'
}

export function applyTheme(id: ThemeId, opts?: { fontScale?: number; compact?: boolean; reduceMotion?: boolean }) {
  document.documentElement.dataset.theme = id
  document.documentElement.style.setProperty('--font-scale', String(opts?.fontScale ?? 1))
  document.documentElement.classList.toggle('compact', !!opts?.compact)
  document.documentElement.classList.toggle('reduce-motion', !!opts?.reduceMotion)
}
