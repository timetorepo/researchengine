/**
 * Searching the component catalog by the screen you are building.
 *
 * The catalog is indexed by what a component *is* ("sheet", "carousel",
 * "pricing"), which is not how anyone asks for one. People ask for the screen:
 * the empty state, the onboarding, the paywall. So this file holds the small
 * fixed bridge between screen words and component words, and the scorer that
 * uses it — deliberately in one place, because three callers need the same
 * answer: the Library's expanded search, the design hub's suggestion strip, and
 * the agent's `library_search` tool.
 *
 * Two rules keep it honest. A phrase is a requirement on the *phrase*: "empty
 * state" is one request, not the two words "empty" and "state", so a component
 * is never matched on the word "state" alone. And when the catalog genuinely has
 * nothing for a request, the answer is nothing — a component invented to fill
 * the gap would install nothing and waste the click.
 */

import { CATALOG, type CatalogItem } from '@/lib/design/catalog'
import { commandsFor, uiProviderById } from '@/lib/design/providers'
import { PATTERN_TERMS, expandPattern, phrasesIn, scoreItem } from '@/lib/design/patterns'

// The vocabulary bridge is a leaf module shared with the design hub and the
// agent's tool; re-exported here so an importer of component-search has one door.
export { PATTERN_TERMS, expandPattern, phrasesIn }

export interface ComponentMatch {
  item: CatalogItem
  score: number
}

/**
 * The catalog, ranked for one query. Exposed on its own (rather than only as
 * hits) because the tool the agent calls reports the install command, which
 * needs the catalog item, not the display line.
 */
export function searchComponents(query: string, limit = 4): ComponentMatch[] {
  if (query.trim().length < 2) return []
  return CATALOG
    .map((item) => ({ item, score: scoreItem(query, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * The command that installs a catalog item, for the manager the user works in.
 * Returns null when the provider has nothing installable — which is the honest
 * answer for a copy-paste library whose code is hand-copied.
 */
export function installLineFor(item: CatalogItem, manager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm'): string | null {
  const provider = uiProviderById(item.provider)
  if (!provider) return null
  const lines = commandsFor(provider, item.name, manager)
  return lines.length ? lines.map((l) => l.command).join(' && ') : null
}

/** One search result, in the shape every caller displays or hands to a model. */
export interface ComponentHit {
  id: string
  vertical: 'ui'
  title: string
  url: string
  snippet: string
  source: string
  action: 'open'
  /** The command that installs it, when there is one. */
  install?: string
}

/** The catalog, as hits: title, provenance, and how to install it. */
export function componentHits(query: string, limit = 4): ComponentHit[] {
  return searchComponents(query, limit).map(({ item }) => {
    const install = installLineFor(item)
    return {
      id: `cmp-${item.id}`,
      vertical: 'ui' as const,
      title: item.name,
      url: `app://component/${item.id}`,
      snippet: `${item.what} — ${item.provider}`,
      source: `Design hub · ${item.provider}`,
      action: 'open' as const,
      ...(install ? { install } : {}),
    }
  })
}
