/**
 * "Humanize" — rewrite an answer so it reads like a person wrote it.
 *
 * The rewrite runs through the user's own configured provider (same key, same
 * shielding, same connection log as a normal turn) and streams back into the
 * message, so the text arrives the way a human types it: unevenly. When no
 * provider is configured we fall back to an on-device pass — no fake answer,
 * just a lexical de-AI-ification of the text the user already has.
 */
import { generateText } from './generate'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'

/**
 * The rules matter more than the model here. Detectors (Turnitin, GPTZero,
 * ZeroGPT and friends) score low perplexity and flat rhythm, so the instructions
 * target exactly that: uneven sentence length, spoken vocabulary, no stock
 * transitions, no tricolons, sparing dashes — while every fact, number,
 * citation, link, code block and list stays exactly where it was.
 */
export const HUMANIZE_SYSTEM = `You are a copy editor who rewrites text so it reads as if a specific human typed it by hand, in one sitting. You rewrite; you never explain, summarise, comment on, or apologise for the text. Output only the rewritten text.

Hard rules:
- Preserve every fact, number, date, name, citation marker, link, code block, table and list item exactly. Drop nothing, invent nothing. If a sentence carries a citation like [3], it keeps [3].
- Keep the original's structure (headings, bullets, numbering, markdown) and its meaning. No new claims, no softening of results.
- Vary sentence length hard: follow a 27-word sentence with a 4-word one. Let the rhythm be uneven, even abrupt.
- Prefer the word people say out loud: "use" over "utilise", "show" over "demonstrate", "about" over "regarding", "help" over "facilitate", "so" over "therefore", "but" over "however" (mid-sentence too).
- Kill AI tells: delve, moreover, furthermore, additionally, in conclusion, in summary, it is important to note, it's worth noting, when it comes to, in today's world, navigate the landscape, unlock the potential, a testament to, tapestry, realm, crucial, pivotal, robust, seamless, leverage (as a verb), embark, harness, myriad, plethora, holistic, underscore (as a verb).
- Never write "It's not just X, it's Y". Never write three parallel clauses in a row. Never open three sentences the same way. Never end with a tidy "In conclusion" summary unless the source had one.
- Use contractions (it's, doesn't, you're, that's) and the occasional fragment for emphasis. Start some sentences with And, But, So.
- At most one em dash in the whole text. Mix commas, parentheses and short asides instead.
- Add small human framing where it fits — "Here's the thing", "In practice", "What that means", "The catch", "So what?" — but never filler, and never twice in a row.
- Keep the register appropriate: technical stays technical, casual stays casual. No slang in formal text.
- Do not mention being an AI, do not add disclaimers, do not add a closing offer to help.`

/** Stock phrases → the way a person would put it. Order matters (longest first). */
const PHRASES: [RegExp, string][] = [
  [/\bit is important to note that\b/gi, 'note that'],
  [/\bit's important to note that\b/gi, 'note that'],
  [/\bit is worth noting that\b/gi, 'note that'],
  [/\bit's worth noting that\b/gi, 'note that'],
  [/\bwhen it comes to\b/gi, 'with'],
  [/\bin today's fast-paced world,?\s*/gi, ''],
  [/\bin the realm of\b/gi, 'in'],
  [/\ba testament to\b/gi, 'proof of'],
  [/\bnavigate the (complexities|landscape) of\b/gi, 'deal with'],
  [/\bdelv(e|ing) into\b/gi, 'dig into'],
  [/\bunlock the (full )?potential of\b/gi, 'get more out of'],
  [/\bembark on\b/gi, 'start'],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\ba (myriad|plethora) of\b/gi, 'many'],
  [/\bplethora of\b/gi, 'lot of'],
  [/\bleverage\b/gi, 'use'],
  [/\butilise\b/gi, 'use'],
  [/\butilize\b/gi, 'use'],
  [/\bfacilitate\b/gi, 'help'],
  [/\bdemonstrate\b/gi, 'show'],
  [/\bapproximately\b/gi, 'about'],
  [/\bnumerous\b/gi, 'many'],
  [/\bsubsequently\b/gi, 'then'],
  [/\bconsequently\b/gi, 'so'],
  [/\bfurthermore\b/gi, 'and'],
  [/\bmoreover\b/gi, 'also'],
  [/\badditionally\b/gi, 'also'],
  [/\bin conclusion\b/gi, 'so'],
  [/\bcrucial\b/gi, 'key'],
  [/\bpivotal\b/gi, 'key'],
  [/\brobust\b/gi, 'solid'],
  [/\bseamless(ly)?\b/gi, 'smooth'],
  [/\bcomprehensive\b/gi, 'full'],
  [/\bdelve\b/gi, 'dig'],
]

/**
 * On-device fallback: no provider needed, meaning preserved, and it removes the
 * worst detector bait (stock transitions, inflated vocabulary, dash overuse).
 */
export function localHumanize(input: string): string {
  // Never touch code: fenced blocks and inline spans are copied verbatim, so a
  // word like `leverage` inside a snippet stays exactly as the author wrote it.
  const parts = input.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts.map((part, i) => (i % 2 === 1 ? part : localHumanizeProse(part))).join('')
}

function localHumanizeProse(input: string): string {
  let out = input
  for (const [re, to] of PHRASES) out = out.replace(re, to)
  // Sentence-start "However," / "Therefore," / "Thus," → how people actually talk.
  out = out.replace(/(^|[.!?]\s+)(However|Therefore|Thus|Hence|Nevertheless|Nonetheless)(,)/g,
    (_m, pre, _w, comma) => `${pre}${comma === ',' ? 'But' : 'But'}`)
  // Keep at most one em dash in the whole answer.
  let dashes = 0
  out = out.replace(/\s—\s/g, () => (++dashes > 1 ? ', ' : ' — '))
  // Collapse doubled spaces and stray blank lines the substitutions left behind.
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

/**
 * Which writer will do the work. Split out so it can be reasoned about (and
 * tested) without a network: no provider configured → on-device; a provider
 * that needs a key but has none → on-device; anything else → the model.
 */
export function humanizeRoute(
  modelRef: string,
  providers: Record<string, { apiKey?: string; baseUrl?: string; enabled?: boolean } | undefined>,
): 'provider' | 'local' {
  const [providerId] = (modelRef ?? '').split(':')
  const meta = providerById(providerId)
  if (!meta) return 'local'
  if (!meta.needsKey) return 'provider'
  const key = providers?.[providerId]?.apiKey ?? ''
  return key.length > 0 ? 'provider' : 'local'
}

export interface HumanizeResult {
  text: string
  /** Human-readable attribution for the badge ("OpenAI · gpt-4o", "on-device"). */
  by: string
  /** True when the on-device pass produced the text. */
  local: boolean
}

/**
 * Rewrite `text`. `onChunk` receives the text so far, so the caller can stream
 * it into the message instead of freezing the UI for a second or two.
 */
export async function humanizeText(opts: {
  text: string
  modelOverride?: string
  signal?: AbortSignal
  onChunk?: (soFar: string) => void
}): Promise<HumanizeResult> {
  const settings = useStore.getState().settings
  const modelRef = opts.modelOverride ?? settings.defaultModel
  const [providerId] = modelRef.split(':')
  const pconf = providerId ? settings.providers[providerId] : undefined
  const route = humanizeRoute(modelRef, settings.providers)
  let apiKey = ''
  if (route === 'provider' && pconf?.apiKey) {
    try { apiKey = await usableKey(pconf.apiKey) } catch { apiKey = '' }
  }

  if (route === 'local') {
    // Nothing to stream from — the local pass is instant and offline.
    const text = localHumanize(opts.text)
    opts.onChunk?.(text)
    return { text, by: 'on-device pass', local: true }
  }

  let soFar = ''
  const res = await generateText({
    system: HUMANIZE_SYSTEM,
    prompt: opts.text,
    // Warmer than a normal turn: the point is to break the model's rhythm.
    temperature: 0.9,
    maxTokens: Math.min(4000, Math.max(600, Math.round(opts.text.length / 3))),
    signal: opts.signal,
    onChunk: (chunk) => { soFar += chunk; opts.onChunk?.(soFar) },
  })
  const text = res.text.trim() || localHumanize(opts.text)
  return { text, by: `${res.provider} · ${res.model}`, local: res.usedDemo }
}
