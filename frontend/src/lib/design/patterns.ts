/**
 * How a search for an interface is read.
 *
 * The component catalog is indexed by what a component *is* ("sheet", "stepper",
 * "pricing"), which is not how anyone asks for one. People ask for the screen:
 * the empty state, the onboarding, the paywall. This file is the single, fixed
 * bridge between the two vocabularies, kept as a leaf module (it imports
 * nothing) so every consumer reads a query the same way — the Library's expanded
 * search, the design hub, and the agent's `library_search` tool.
 *
 * The rule that matters: a phrase is a requirement on the *phrase*, not on its
 * words. "empty state" is one request, so nothing is ever matched on the word
 * "state" alone — and when the catalog genuinely has nothing for a request, the
 * caller should show nothing rather than the nearest component.
 */

/**
 * Screen words as component words. Keys are matched as substrings of the
 * lowercased query, longest key first, so "profile page" wins over "profile".
 */
export const PATTERN_TERMS: Record<string, string[]> = {
  'bottom sheet': ['sheet', 'drawer'],
  'command palette': ['command', 'combobox', 'palette'],
  calendar: ['date', 'picker', 'calendar'],
  chat: ['message', 'prompt', 'composer'],
  checkout: ['form', 'card', 'stepper'],
  dashboard: ['chart', 'card', 'table', 'meter'],
  'data table': ['table', 'datagrid', 'pagination'],
  'empty state': ['empty', 'skeleton', 'placeholder'],
  feed: ['list', 'card', 'marquee'],
  list: ['list', 'rows', 'items'],
  'loading state': ['loader', 'skeleton', 'spinner', 'loading'],
  login: ['form', 'input', 'dialog'],
  modal: ['dialog', 'sheet', 'popover'],
  notifications: ['badge', 'toast', 'notification'],
  onboarding: ['steps', 'progress', 'stepper', 'wizard'],
  paywall: ['pricing', 'dialog', 'card'],
  'pricing table': ['pricing', 'table', 'card'],
  profile: ['avatar', 'card', 'hover'],
  'profile page': ['avatar', 'card', 'hover'],
  'search screen': ['command', 'combobox', 'input'],
  settings: ['switch', 'select', 'accordion', 'tabs'],
  'sign in': ['form', 'input', 'dialog'],
  'sign up': ['form', 'input', 'dialog'],
  stepper: ['steps', 'progress'],
}

/** Which phrases this query is asking about, longest first. */
export function phrasesIn(query: string): string[] {
  const lower = query.trim().toLowerCase()
  return Object.keys(PATTERN_TERMS).filter((p) => lower.includes(p)).sort((a, b) => b.length - a.length)
}

/** The words a query stands for, including the ones its phrases imply. */
export function expandPattern(query: string): string[] {
  const lower = query.toLowerCase()
  const base = lower.split(/\s+/).filter(Boolean)
  const extra: string[] = []
  for (const phrase of phrasesIn(query)) extra.push(...PATTERN_TERMS[phrase])
  return [...new Set([...base, ...extra])]
}

export interface QueryParts {
  /** Words that must all be present. */
  required: string[]
  /** Terms where at least one must be present, once a phrase is in play. */
  alternatives: string[]
  /** The phrases the query contains. */
  phrases: string[]
}

/** One query, split into what is required and what a phrase merely implies. */
export function splitQuery(query: string): QueryParts {
  const lower = query.trim().toLowerCase()
  const typed = lower.split(/\s+/).filter(Boolean)
  const phrases = phrasesIn(query)
  const covered = new Set<string>()
  const extras: string[] = []
  for (const phrase of phrases) {
    for (const w of phrase.split(/\s+/)) covered.add(w)
    extras.push(...PATTERN_TERMS[phrase])
  }
  return {
    phrases,
    required: typed.filter((w) => !covered.has(w)),
    alternatives: [...new Set(extras.filter((w) => !typed.includes(w)))],
  }
}

/** The text a catalog item is matched against. */
export function haystackOf(item: { name: string; what: string; tags: string[]; provider: string }): string {
  return `${item.name} ${item.what} ${item.tags.join(' ')} ${item.provider}`.toLowerCase()
}

/**
 * Does this item answer the query, and how well? Returns -1 for no match, so
 * callers can rank without re-deriving the rules.
 */
export function scoreItem(query: string, item: { name: string; what: string; tags: string[]; provider: string }): number {
  const lower = query.trim().toLowerCase()
  if (!lower) return 0
  const { required, alternatives, phrases } = splitQuery(query)
  const hay = haystackOf(item)
  if (required.some((w) => !hay.includes(w))) return -1
  const alternativeHits = alternatives.filter((w) => hay.includes(w)).length
  if (phrases.length && alternatives.length && alternativeHits === 0) return -1
  let score = required.length * 3 + alternativeHits * 2
  if (item.name.toLowerCase().includes(lower)) score += 8
  if (required.length && item.name.toLowerCase().startsWith(required[0])) score += 3
  if (!phrases.length && item.name.toLowerCase() === lower) score += 6
  return score
}
