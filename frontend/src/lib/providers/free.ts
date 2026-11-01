/**
 * Free routing.
 *
 * FreeRoute used to be a *provider* — a nineteenth card in the picker with its
 * own keys and its own endpoint. It never was one: there is no company called
 * FreeRoute, no API to sign up to, no model it owns. It was a routing idea
 * wearing a provider's clothes, which is why it looked wrong in a list of labs.
 *
 * This is that idea as what it actually is: when free routing is on and no model
 * has been chosen, the chat asks *your* providers for the best free model among
 * the ones you have connected, and moves to the next if one refuses. Nothing to
 * configure, no keys of its own, no extra provider in the list.
 *
 * The ranking is deliberately simple and explainable, and every candidate carries
 * the sentence that justifies it.
 */
import { modelTier } from './tiers'

export interface FreeCandidate {
  provider: string
  providerName: string
  model: string
  ref: string
  /** Higher wins. See `rank()`. */
  score: number
  why: string
}

export interface FreeRoutingInput {
  /** Providers the user has added in Settings → Providers. */
  added: string[]
  /** Live model lists, keyed by provider id. */
  models: Record<string, string[] | undefined>
  /** Providers whose key is present (or that need none). */
  usable: Record<string, { name: string; ready: boolean } | undefined>
  /** Models the user unlisted — never route to those. */
  hidden?: string[]
  overrides?: Record<string, 'free' | 'paid'>
}

/**
 * How good a free candidate is:
 *   3 — runs on this machine (Ollama, LM Studio, custom): nothing to run out of
 *   2 — a published free tier, or a model the provider marks free in its id
 *   1 — free-labelled lines (Flash, Gemma…) on an otherwise billed provider
 * and then, inside a rank, bigger model names first: a `-70b` beats a `-8b`
 * because bigger checkpoints usually answer better, and this is free either way.
 */
function rank(providerId: string, model: string, overrides?: Record<string, 'free' | 'paid'>): { score: number; why: string } | null {
  const info = modelTier(providerId, model, overrides)
  if (info.tier !== 'free') return null
  let score = 1
  if (/^(ollama|lmstudio|llamacpp|custom)$/.test(providerId)) score = 3
  else if (/free tier|rate-limited|marked free/i.test(info.why)) score = 2
  return { score, why: info.why }
}

/** How many parameters a model name claims, for the within-rank tie-break. */
function sizeHint(model: string): number {
  const m = model.match(/(\d+(?:\.\d+)?)\s*[bx](?![a-z0-9])/i)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isFinite(n) ? n : 0
}

/**
 * Every model free routing is allowed to use, best first. Pure: same inputs,
 * same order, no network, so the chat path can be reasoned about and tested.
 */
export function freeCandidates(input: FreeRoutingInput): FreeCandidate[] {
  const hidden = new Set(input.hidden ?? [])
  const out: FreeCandidate[] = []
  for (const providerId of input.added) {
    const meta = input.usable[providerId]
    if (!meta?.ready) continue
    for (const model of input.models[providerId] ?? []) {
      const ref = `${providerId}:${model}`
      if (hidden.has(ref)) continue
      const r = rank(providerId, model, input.overrides)
      if (!r) continue
      out.push({ provider: providerId, providerName: meta.name, model, ref, score: r.score, why: r.why })
    }
  }
  out.sort((a, b) =>
    b.score - a.score
    || sizeHint(b.model) - sizeHint(a.model)
    || a.provider.localeCompare(b.provider)
    || a.model.localeCompare(b.model))
  return out
}

/**
 * The next candidate to try. `tried` holds refs that already failed (rate limit,
 * no such model, a 5xx) so a chat walks down the list instead of giving up on
 * the first refusal.
 */
export function pickFreeModel(candidates: FreeCandidate[], tried: Iterable<string> = []): FreeCandidate | null {
  const skip = new Set(tried)
  for (const c of candidates) if (!skip.has(c.ref)) return c
  return null
}

/**
 * Did this failure mean "try the next one"? Rate limits, capacity errors and
 * missing models are detours; a bad API key or a malformed request is not, and
 * walking the whole list on those would just hide the real problem.
 */
export function isFailoverWorthy(status: number | null, message: string): boolean {
  if (status === 429 || status === 408 || status === 409) return true
  if (status !== null && status >= 500) return true
  return /rate limit|too many requests|quota|capacity|overloaded|temporarily unavailable|try again later|no such model|not found/i.test(message)
}

/** One line for the UI: "Free routing → llama-3.3-70b on Groq (free tier)". */
export function freeRouteSummary(c: FreeCandidate): string {
  return `${c.model} · ${c.providerName} — ${c.why}`
}
