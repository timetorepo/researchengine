/**
 * Every system prompt in the app, in one sorted list, each one named.
 *
 * There are three sources and they never talked to each other: the master
 * prompts that shape a mode, the persona archive (836 prompts leaked from real
 * products, 24 of them vendored), and the built-in skills. Asking "what system
 * prompts do I have, and which model is this one for?" meant knowing all three
 * and reading three code paths.
 *
 * So they are merged here, named, and sortable. The name is the point: a prompt
 * called `claude-code-fable-5-1` is useless at a glance and `Fable 5.1, Claude
 * Code` is not. Where the archive does not say, the model is read off the slug,
 * and where that is guesswork the entry says so rather than inventing a name.
 *
 * This is an index, not a loader. The text still comes from `personaText()` on
 * demand, because 1.5 MB of prompt text is not something to pull into a bundle
 * to render a list.
 */
import { MASTERS, type MasterKey } from './masters'
import { PERSONAS_MANIFEST, type PersonaEntry } from '@/content/personas/manifest'
import { builtinSkills } from '@/lib/skills/builtins'
import { SKILL_PACKS } from '@/content/skills/catalog'

export type PromptKind = 'master' | 'persona' | 'skill' | 'pack'

export interface PromptEntry {
  /** Stable id: the slug for personas, the key or skill id for the rest. */
  id: string
  /** The name a person reads. */
  name: string
  kind: PromptKind
  /** Who wrote it. `Research Engine` for the app's own. */
  vendor: string
  /** The product it belongs to, when the archive says. */
  product: string
  /** The model this prompt is written for, when that is known. */
  model: string | null
  /** Characters of prompt text. 0 when only the manifest knows it exists. */
  chars: number
  /** True when the full text ships in the app and can be read offline. */
  vendored: boolean
  /** Sort key, lowercased. */
  sortName: string
}

/**
 * Family words a model name is made of. A chain of these followed by a version
 * number is a model; anything else is a product, a tool or a descriptor.
 */
const FAMILY_WORD =
  'claude|chatgpt|gpt|gemini|grok|kimi|qwen|deepseek|mistral|codex|fable|opus|sonnet|haiku|' +
  'pro|flash|max|sol|spark|astra|lite|nano|mini|code|banana|warp|minimax|muse|plus|t3|4o|medium|high|low'

/**
 * A chain of family words, then a version, then optionally more family words:
 * `claude-code-opus-4.8`, `gpt-6-astra`, `nano-banana-2-api`, `gpt-4o-mini`.
 *
 * The version may end in a letter (`4o`, `m2`), and the separator may be absent
 * (`qwen3.6`), because the archive is machine-made and inconsistent about both.
 */
// Every alternation is wrapped in `(?:…)`. Without that, `A|B{0,4}` binds the
// quantifier to the last alternative only and the whole thing parses as
// `A | (B{0,4})`, which silently matches the wrong span.
const F = `(?:${FAMILY_WORD})`
// The leading boundary is a lookbehind rather than `\b` because the archive
// joins words with underscores (`personality_friendly_gpt-5.5`), and `_` counts
// as a word character, so `\b` never fires there.
const CHAIN_RE = new RegExp(
  `(?<![a-z0-9])(${F}(?:[-\\s]+${F}){0,4})[-\\s]*v?(\\d+(?:\\.\\d+)?[a-z]?)` +
  `(?:[-\\s]+(${F}(?:[-\\s]+${F}){0,3}))?(?![a-z0-9])`, 'i')
/** The same, with the family and version glued: `qwen3.6-plus`, `gpt5`. */
const GLUED_RE = new RegExp(
  `(?<![a-z0-9])(${F})v?(\\d+(?:\\.\\d+)?[a-z]?)(?:[-\\s]+(${F}(?:[-\\s]+${F}){0,3}))?(?![a-z0-9])`, 'i')
/** OpenAI's reasoning models, which are named by shape rather than family. */
const O_RE = /\bo(\d)((?:[\s-]*(?:mini|high|medium|low))+)?\b/i

/** Words that mean a product, not a model. Keeps the guess honest. */
// `code` is deliberately absent: it is a descriptor in `claude-code/agents` but
// half of the name in `Claude Code Opus 4.8`, and dropping it there loses the
// product the prompt belongs to.
const NOT_A_MODEL = /^(agents?|commands?|skills?|prompts?|references?|examples?|old|raw|api|readme|index|setup|config|docs?|text|only|and|images|full|system|message|with|all|tools|new|personality|local|web|agent|cloud|desktop|headless|interval|heartbeat|chat)$/i

const prettyWord = (w: string) => {
  const l = w.toLowerCase()
  if (l === 'gpt') return 'GPT'
  if (l === 'chatgpt') return 'ChatGPT'
  if (l === '4o') return '4o'
  if (l === 't3') return 'T3'
  return l.charAt(0).toUpperCase() + l.slice(1)
}

const prettyChain = (chain: string, version: string, suffix?: string) => {
  const head = chain.split(/[-\s]+/).filter(Boolean).filter((w) => !NOT_A_MODEL.test(w)).map(prettyWord)
  const tail = (suffix ?? '').split(/[-\s]+/).filter(Boolean).filter((w) => !NOT_A_MODEL.test(w)).map(prettyWord)
  // A chain that is only descriptors is not a model name.
  if (head.length === 0) return null
  // The version sits between the family and any trailing tier: `GPT 6 Astra`,
  // `Qwen 3.6 Plus`, `Claude Code Opus 4.8`.
  return [...head, version, ...tail].join(' ')
}

/**
 * The model a prompt is for, or null when nothing says.
 *
 * Returns null rather than a guess whenever the only candidate is a product
 * name: "Claude Code" is a tool, not a model, and labelling a prompt with the
 * wrong model is worse than labelling it with nothing.
 */
export function modelOf(slug: string, product = '', file = ''): string | null {
  // The file name is the best signal: it is the one field written for a person.
  const raw = (file || slug).replace(/\.(md|markdown|txt)$/i, '')
  const base = raw.replace(/^\d{4}-\d{2}-\d{2}-/, '')

  const o = base.match(O_RE)
  if (o) {
    const tiers = (o[2] ?? '').split(/[-\s]+/).filter(Boolean).map((t) => t.toLowerCase())
    return `o${o[1]}${tiers.length ? ` ${tiers.join(' ')}` : ''}`
  }

  for (const re of [CHAIN_RE, GLUED_RE]) {
    const m = base.match(re)
    if (m) {
      const named = prettyChain(m[1], m[2], m[3])
      if (named) return named
    }
  }

  // Nothing in the file name: try the slug, then the product.
  for (const candidate of [slug, product]) {
    if (!candidate) continue
    const c = candidate.match(CHAIN_RE)
    if (c) {
      const named = prettyChain(c[1], c[2], c[3])
      if (named) return named
    }
  }
  return null
}

/** Title-case a slug's last segment into something readable. */
function titleFromFile(file: string, slug: string): string {
  const base = (file || slug).replace(/\.(md|markdown|txt)$/i, '').split('/').pop() || slug
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || slug
}

/* ------------------------------------------------------------- the index -- */

/** The app's own master prompts, one per mode. */
function masterEntries(): PromptEntry[] {
  return MASTERS.map((m) => ({
    id: `master:${m.key}`,
    name: m.label,
    kind: 'master' as PromptKind,
    vendor: 'Research Engine',
    product: modeName(m.key),
    model: null,
    chars: m.text.length,
    vendored: true,
    sortName: m.label.toLowerCase(),
  }))
}

const MODE_NAMES: Record<MasterKey, string> = {
  research: 'Research',
  flow: 'AIFlowEngine',
  math: 'Math',
  quality: 'Quality',
  reader: 'Read & Quiz',
  replicate: 'Replicate',
  article: 'Article',
}
const modeName = (k: MasterKey) => MODE_NAMES[k] ?? k

/**
 * The persona archive: 836 prompts, 24 with their text on disk.
 *
 * The id is the archive's `path`, which is unique for all 836. The `slug` is
 * only filled in for the vendored ones (24 of them), so it cannot be the id —
 * using it gives 790 entries the same id and a list where nothing can be
 * selected.
 */
function personaEntries(): PromptEntry[] {
  return PERSONAS_MANIFEST
    .filter((p: PersonaEntry) => p.file !== 'README.md')
    .map((p) => {
      const name = titleFromFile(p.file, p.slug || p.path)
      return {
        id: `persona:${p.path}`,
        name,
        kind: 'persona' as PromptKind,
        vendor: p.vendor,
        product: p.product || '',
        model: modelOf(p.slug, p.product, p.file),
        chars: p.chars,
        vendored: p.vendored,
        sortName: name.toLowerCase(),
      }
    })
}

/** Built-in skills, each of which is a prompt with parameters. */
function skillEntries(): PromptEntry[] {
  return builtinSkills.map((s) => ({
    id: `skill:${s.id}`,
    name: s.name,
    kind: 'skill' as PromptKind,
    vendor: 'Research Engine',
    product: s.category,
    model: null,
    chars: s.promptTemplate.length,
    vendored: true,
    sortName: s.name.toLowerCase(),
  }))
}

/** Vendored upstream packs, which are prompts of a different shape. */
function packEntries(): PromptEntry[] {
  return SKILL_PACKS.map((p) => ({
    id: `pack:${p.id}`,
    name: p.name,
    kind: 'pack' as PromptKind,
    vendor: p.credit ?? p.origin,
    product: 'Skill pack',
    model: modelOf(p.id),
    chars: 0,
    vendored: true,
    sortName: p.name.toLowerCase(),
  }))
}

let cached: PromptEntry[] | null = null

/**
 * Every prompt, sorted by name. Cached: the manifest is 836 entries and this is
 * read on every keystroke in the picker.
 */
export function allPrompts(): PromptEntry[] {
  if (cached) return cached
  cached = [...masterEntries(), ...personaEntries(), ...skillEntries(), ...packEntries()]
    .sort((a, b) => a.sortName.localeCompare(b.sortName) || a.id.localeCompare(b.id))
  return cached
}

export type PromptSort = 'name' | 'vendor' | 'model' | 'size'

export function sortPrompts(list: PromptEntry[], by: PromptSort, dir: 'asc' | 'desc' = 'asc'): PromptEntry[] {
  const sign = dir === 'asc' ? 1 : -1
  const key = (p: PromptEntry) => {
    if (by === 'vendor') return p.vendor.toLowerCase()
    if (by === 'model') return (p.model ?? '\uffff').toLowerCase()
    if (by === 'size') return String(p.chars).padStart(12, '0')
    return p.sortName
  }
  return [...list].sort((a, b) => sign * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
}

/** Search across name, vendor, product and model. Empty query returns all. */
export function filterPrompts(list: PromptEntry[], query: string): PromptEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  const terms = q.split(/\s+/)
  return list.filter((p) => {
    const hay = `${p.name} ${p.vendor} ${p.product} ${p.model ?? ''} ${p.kind}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

/** Counts by kind, for the header of the list. */
export function promptCounts(list: PromptEntry[]): Record<PromptKind, number> {
  const out: Record<PromptKind, number> = { master: 0, persona: 0, skill: 0, pack: 0 }
  for (const p of list) out[p.kind]++
  return out
}

/** The distinct models named across the list, sorted. */
export function knownModels(list: PromptEntry[]): string[] {
  return [...new Set(list.map((p) => p.model).filter((m): m is string => !!m))].sort()
}

/** Characters, as a person reads them. */
export function formatChars(n: number): string {
  if (n <= 0) return 'unknown'
  if (n < 1000) return `${n} chars`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k chars`
  return `${(n / 1_000_000).toFixed(2)}M chars`
}
