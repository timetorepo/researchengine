/** Locally bundled interface families. Saved IDs retain their original stacks;
 * Allo is the fresh-profile recommendation, never a migration over a saved choice. */

export interface TypefaceOption {
  id: string
  label: string
  /** CSS font stack written to --font-ui and --font-body. */
  stack: string
  /** What the family is good for, shown under the option. */
  feel: string
  /** Weights bundled for the family, shown when the family is limited. */
  note?: string
}

const SANS_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

export const TYPEFACES: TypefaceOption[] = [
  { id: 'geist-rounded', label: 'Geist Rounded', stack: '"Geist Rounded", ' + SANS_FALLBACK,
    feel: 'A softer shell with clear, compact shapes.', note: 'Optional local variable family, weights 100–900. SIL OFL.' },
  { id: 'sn-pro', label: 'SN Pro', stack: '"SN Pro", ' + SANS_FALLBACK,
    feel: 'A rounded, Markdown-oriented reading alternative.', note: 'Local normal and italic variable fonts, weights 200–900. SIL OFL.' },
  { id: 'allo', label: 'Allo', stack: '"Allo", ' + SANS_FALLBACK,
    feel: 'Native Studio: warm, compact and legible.', note: 'Local variable font, weights 100–900. SIL OFL.' },
  { id: 'work-sans', label: 'Work Sans', stack: '"Work Sans", ' + SANS_FALLBACK,
    feel: 'A quieter screen-oriented alternative.', note: 'Local variable font, weights 100–900. SIL OFL.' },
  {
    id: 'default',
    label: 'Research Engine',
    stack: '"HK Guise", "Avenir Next", "Satoshi", "Geist Sans", "Inter", ' + SANS_FALLBACK,
    feel: 'The original look of the app.',
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: '"Inter", ' + SANS_FALLBACK,
    feel: 'Neutral and very legible at small sizes. Good for dense screens.',
  },
  {
    id: 'geist',
    label: 'Geist',
    stack: '"Geist Sans", "Inter", ' + SANS_FALLBACK,
    feel: 'Tight and technical, close to developer tools.',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    stack: '"Plus Jakarta Sans", "Inter", ' + SANS_FALLBACK,
    feel: 'Friendly geometric shapes with open counters.',
    note: 'Bundled at weight 600. Other weights are synthesised.',
  },
  {
    id: 'bricolage',
    label: 'Bricolage Grotesque',
    stack: '"Bricolage Grotesque", "Inter", ' + SANS_FALLBACK,
    feel: 'Characterful headlines. Best for titles, less for long reading.',
    note: 'Bundled at weights 600 and 700.',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    stack: '"Poppins", "Inter", ' + SANS_FALLBACK,
    feel: 'Round, confident and easy to scan.',
    note: 'Bundled at weights 500 and 600.',
  },
  {
    id: 'lora',
    label: 'Lora (serif)',
    stack: '"Lora", Georgia, serif',
    feel: 'A book-like serif for long reading and articles.',
    note: 'Bundled at weight 600. Regular text uses the browser serif.',
  },
  {
    id: 'system',
    label: 'System',
    stack: SANS_FALLBACK,
    feel: 'The font your operating system uses everywhere.',
  },
]

export const TYPEFACE_IDS = TYPEFACES.map((t) => t.id)

export function typefaceFor(id: string | undefined): TypefaceOption {
  return TYPEFACES.find((t) => t.id === id) ?? TYPEFACES.find((t) => t.id === 'default')!
}

/** Write the chosen stack to the page. Unknown ids fall back to the default. */
export function applyTypeface(id: string | undefined): void {
  const { stack } = typefaceFor(id)
  const root = document.documentElement
  root.style.setProperty('--font-ui', stack)
  root.style.setProperty('--font-body', stack)
  root.dataset.typeface = typefaceFor(id).id
}

/** Rendered code only. Embedded editors retain their own font settings. */
export function applyCodeTypeface(id: string | undefined, ligatures: boolean | undefined): void {
  const root = document.documentElement
  if (id === 'lilex') {
    root.style.setProperty('--font-mono', '"Lilex Variable", "Geist Mono", ui-monospace, monospace')
    root.dataset.codeTypeface = 'lilex'
    root.dataset.codeLigatures = ligatures === true ? 'on' : 'off'
  } else {
    root.style.removeProperty('--font-mono')
    delete root.dataset.codeTypeface
    delete root.dataset.codeLigatures
  }
}
