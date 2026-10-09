/**
 * Turning a brief into directions.
 *
 * The user asked for "manus level design skill" — the part of that which can be
 * put in a file honestly is this: given the answers, produce directions with
 * real values (a type pairing, actual hex tokens, a motion rule, named
 * components), not adjectives. Everything here is editable, and the UI says so.
 *
 * Three directions are offered because one is a guess and two is a comparison.
 * They differ in *idea*, not in decoration: a SaaS instrument, an editorial
 * page, a characterful product site.
 */
import type { BriefAnswers, Direction } from '@/stores/useDesign'
import { CATALOG } from './catalog'
import { UI_PROVIDERS } from './providers'

interface Recipe {
  id: string
  title: (b: BriefAnswers) => string
  style: string
  idea: (b: BriefAnswers) => string
  type: string
  palette: string[]
  motion: string
  /** Tags used to pick components from the catalog. */
  wants: string[]
}

const RECIPES: Recipe[] = [
  {
    id: 'instrument',
    title: () => 'The instrument',
    style: 'SAAS look',
    idea: (b) => `A calm, dense product surface for ${b.subject || 'the product'} — every number legible, every control where the hand expects it.`,
    type: 'Geist Sans for the interface, Geist Mono for every number and identifier; one display size used once.',
    palette: ['#0A0A0B background', '#131316 surface', '#1F1F24 raised', '#2A2A31 line', '#F4F4F5 text', '#A1A1AA muted', '#6C8EEF accent'],
    motion: '90 ms state changes, nothing decorative, numbers that roll rather than jump.',
    wants: ['table', 'chart', 'tab', 'command', 'stat', 'sidebar', 'number', 'combobox', 'data'],
  },
  {
    id: 'editorial',
    title: () => 'The editorial page',
    style: 'unique website',
    idea: () => 'A page that reads like a magazine: one idea per screen, type doing the work, images given room.',
    type: 'A serif display used once at a size that earns it, a neutral sans for body, generous 1.4 line-height on the display and 1.6 on body.',
    palette: ['#0B0A09 background (warm near-black)', '#141210 surface', '#F5F1EA text', '#B8AFA3 muted', '#C2410C accent (one only)'],
    motion: 'Content enters once, never loops; a single reveal per screen.',
    wants: ['scroll', 'reveal', 'marquee', 'timeline', 'hero', 'text'],
  },
  {
    id: 'character',
    title: () => 'The characterful one',
    style: 'unique website',
    idea: () => 'A product with a face: one memorable interaction the visitor will describe to someone else.',
    type: 'A grotesque in three weights, tight tracking on headlines; no second family.',
    palette: ['#0E0F13 background', '#171922 surface', '#E8EAF2 text', '#9AA1B4 muted', '#34D399 accent'],
    motion: 'One signature gesture — a card that follows the pointer, a text mask that swaps — everything else still.',
    wants: ['dock', 'cursor', 'card', 'glow', 'gradient', 'spotlight'],
  },
]

/** Pick the components that fit a direction, spread across providers. */
function pickComponents(wants: string[], count = 5): string[] {
  const scored = CATALOG.map((item) => {
    const hay = `${item.name} ${item.tags.join(' ')}`.toLowerCase()
    const score = wants.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
    return { item, score }
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)

  const out: string[] = []
  const usedProviders = new Set<string>()
  for (const s of scored) {
    if (out.length >= count) break
    // Prefer variety: no more than two from one provider until we have enough.
    const seen = [...out].filter((o) => o.startsWith(`${s.item.provider}:`)).length
    if (usedProviders.has(s.item.provider) && seen >= 2) continue
    usedProviders.add(s.item.provider)
    out.push(`${s.item.provider}:${s.item.name}`)
  }
  return out.map((id) => {
    const provider = UI_PROVIDERS.find((p) => p.id === id.split(':')[0])
    return `${provider?.name ?? id.split(':')[0]} — ${id.split(':')[1]}`
  })
}

export function suggestDirections(brief: BriefAnswers): Omit<Direction, 'id' | 'createdAt'>[] {
  const filtered = brief.style
    ? RECIPES.filter((r) => (brief.style === 'SaaS look' ? r.style === 'SAAS look' : r.style === 'unique website'))
    : RECIPES
  const recipes = filtered.length ? filtered : RECIPES
  return recipes.slice(0, 3).map((r) => ({
    title: r.title(brief),
    style: r.style,
    idea: r.idea(brief),
    type: r.type,
    palette: r.palette,
    motion: r.motion,
    components: pickComponents(r.wants),
  }))
}

/**
 * The brief as a prompt block. This is what gets attached to the agent's design
 * work, so the answers survive the trip from the questionnaire into the code.
 */
export function briefAsPrompt(brief: BriefAnswers): string {
  const rows: [string, string][] = [
    ['What it is', brief.subject],
    ['Who it is for', brief.audience],
    ['What “premium” means here', brief.style],
    ['Density', brief.density],
    ['Motion', brief.motion],
    ['Theme', brief.theme],
    ['Type', brief.type],
    ['Accent', brief.accent],
    ['References', brief.references],
    ['Must be on the first screen', brief.mustHave],
    ['Avoid', brief.avoid],
  ]
  const filled = rows.filter(([, v]) => v && v.trim())
  if (!filled.length) return 'No design brief answered yet. Ask the questions in the Design Brief before designing.'
  return ['DESIGN BRIEF (answered by the user — treat as binding):', ...filled.map(([k, v]) => `• ${k}: ${v.trim()}`)].join('\n')
}

export const briefIsComplete = (b: BriefAnswers) =>
  Boolean(b.subject.trim() && b.style && b.density && b.motion && b.theme)
