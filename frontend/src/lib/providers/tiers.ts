/**
 * Free or paid?
 *
 * Model lists are fetched live, so pricing cannot be. This module is a small,
 * *explainable* rule set over what providers publish, and every answer carries a
 * reason the UI can show. Where the answer is genuinely unknown it says so
 * (returns null) rather than guessing — and the user can override any model, and
 * that override always wins.
 *
 * Honest limitation, stated in the UI as well: providers change their free tiers
 * without notice, so a "Free" chip means "free tier as published", not a promise.
 */

export type Tier = 'free' | 'paid'

export interface TierInfo {
  tier: Tier | null
  /** Why the detector says so — shown in the tooltip, so it can be checked. */
  why: string
  /** Where the answer came from: the rules, or the user's own correction. */
  source: 'auto' | 'user' | 'none'
}

/** Providers that never bill per token: local models and the free-tier router. */
const NEVER_BILLED = new Set(['ollama', 'lmstudio', 'custom'])

/** Providers that are known to bill per token, so anything from them is paid
 *  unless a free rule above applies. */
const BILLS = new Set(['openai', 'anthropic', 'deepseek', 'grok', 'kimi', 'minimax', 'mistral', 'together', 'mercury', 'glm', 'gemini'])

export const TIER_REF = (providerId: string, model: string) => `${providerId}:${model}`

/**
 * The detector. Ordered: the most specific rule that matches wins, and the first
 * rule is always the user's own answer.
 */
export function modelTier(
  providerId: string,
  model: string,
  overrides: Record<string, Tier> = {},
): TierInfo {
  const override = overrides[TIER_REF(providerId, model)]
  if (override) return { tier: override, why: 'you set this', source: 'user' }

  if (NEVER_BILLED.has(providerId)) {
    return {
      tier: 'free',
      why: providerId === 'ollama' ? 'runs on this machine'
        : providerId === 'lmstudio' ? 'runs on this machine'
        : 'your own endpoint, on this machine',
      source: 'auto',
    }
  }

  const id = String(model ?? '')

  // OpenRouter and Together label their free endpoints in the id itself.
  if (/:free$/i.test(id) || /-free$/i.test(id) || /(^|[/_-])free$/i.test(id)) {
    return { tier: 'free', why: 'the model id is marked free by the provider', source: 'auto' }
  }

  // Z.ai publishes the Flash line as free.
  if (/glm-[\d.]+(-[\w]+)?-?flash/i.test(id) || /^glm-.*flash/i.test(id)) {
    return { tier: 'free', why: 'Z.ai publishes the Flash models as free', source: 'auto' }
  }

  // Google's free tier covers Flash and the small open models.
  if (providerId === 'gemini' && (/(^|[/_-])gemini-[\d.]+-flash/i.test(id) || /flash-lite/i.test(id) || /gemma/i.test(id))) {
    return { tier: 'free', why: 'covered by the Google AI Studio free tier', source: 'auto' }
  }

  // Groq's hosted models are on a free tier (rate limited, not billed).
  if (providerId === 'groq') {
    return { tier: 'free', why: 'Groq serves its models on a free, rate-limited tier', source: 'auto' }
  }

  // Open weights on a host that does not bill for them.
  if (providerId === 'nim' && /(llama|qwen|mistral|mixtral|gemma|phi|deepseek|nemotron)/i.test(id)) {
    return { tier: 'free', why: 'NVIDIA hosts open models on its public endpoint', source: 'auto' }
  }

  if (BILLS.has(providerId)) {
    return { tier: 'paid', why: 'billed per token by the provider', source: 'auto' }
  }

  return { tier: null, why: 'no pricing information for this provider', source: 'none' }
}

/** The filter used by the picker's segmented control. */
export type TierFilter = 'all' | 'free' | 'paid'

export function matchesFilter(info: TierInfo, filter: TierFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'free') return info.tier === 'free'
  if (filter === 'paid') return info.tier === 'paid'
  return true
}

/** How the list is ordered. */
export type TierSort = 'provider' | 'name' | 'free-first'

export function sortModels<T extends { model: string; provider: string; tier: TierInfo }>(rows: T[], sort: TierSort): T[] {
  const copy = [...rows]
  if (sort === 'name') return copy.sort((a, b) => a.model.localeCompare(b.model))
  if (sort === 'free-first') {
    const rank = (t: TierInfo) => (t.tier === 'free' ? 0 : t.tier === 'paid' ? 2 : 1)
    return copy.sort((a, b) => rank(a.tier) - rank(b.tier) || a.model.localeCompare(b.model))
  }
  return copy.sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
}

/* ------------------------------------------------------- the picker's list ---- */

export interface ModelRow {
  provider: string
  providerName: string
  model: string
  ref: string
}

export interface SelectOptions {
  /** Refs the user has taken out of the picker (`provider:model`). */
  hidden?: string[]
  /** Per-model corrections from the user, which beat the rules. */
  overrides?: Record<string, Tier>
  filter?: TierFilter
  sort?: TierSort
  query?: string
}

export interface Selection {
  /** What the picker shows, in order. */
  visible: ModelRow[]
  /** What the user has unlisted — kept, never deleted. */
  hidden: ModelRow[]
  counts: { free: number; paid: number; total: number; unlisted: number }
}

/**
 * Everything the picker's list does, in one pure function: search, the free/paid
 * filter, the sort, and which models are unlisted. Kept out of the component so
 * the behaviour can be tested without a browser.
 */
export function selectModels(rows: ModelRow[], opts: SelectOptions = {}): Selection {
  const hiddenSet = new Set(opts.hidden ?? [])
  const overrides = opts.overrides ?? {}
  const filter = opts.filter ?? 'all'
  const q = (opts.query ?? '').trim().toLowerCase()

  const searched = rows.filter((r) =>
    !q || r.model.toLowerCase().includes(q) || (r.providerName ?? '').toLowerCase().includes(q) || r.provider.includes(q))

  const hidden = searched.filter((r) => hiddenSet.has(r.ref))
  const shown = searched.filter((r) => !hiddenSet.has(r.ref))

  const counts = {
    free: shown.filter((r) => modelTier(r.provider, r.model, overrides).tier === 'free').length,
    paid: shown.filter((r) => modelTier(r.provider, r.model, overrides).tier === 'paid').length,
    total: rows.length,
    unlisted: (opts.hidden ?? []).length,
  }

  const filtered = shown.filter((r) => matchesFilter(modelTier(r.provider, r.model, overrides), filter))
  const visible = sortModels(
    filtered.map((r) => ({ ...r, tier: modelTier(r.provider, r.model, overrides) })),
    opts.sort ?? 'provider',
  ).map(({ tier, ...row }) => row)

  return { visible, hidden, counts }
}
