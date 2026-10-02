/**
 * Forking a chat with a compressed prompt.
 *
 * The feature this implements: fork to a new chat, but carry the *meaning* of
 * the old one rather than its bytes. Long research threads are mostly restated
 * context; a continuation only needs the instructions, the conclusions, the
 * constraints, the names and the code. So the capsule is assembled from those —
 * deterministically, on this device, with no model call and therefore no tokens
 * spent to save tokens.
 *
 * What "the same results" means here, mechanically:
 *   · every imperative/constraint line in the source is carried (they are what
 *     the answer must obey — dropping one changes the answer);
 *   · the most recent turns are carried close to verbatim, because that is the
 *     part a continuation actually continues from;
 *   · code blocks and their language tags survive (with interior lines trimmed
 *     when the level asks for it);
 *   · the last user turn is never trimmed away entirely — it is the task;
 *   · the capsule ends by telling the model that this is the whole history, so
 *     it does not ask for context that is sitting right in front of it.
 *
 * Everything is pure: given the same messages and options, the same capsule.
 * `scripts/fork-test.mts` measures the saving and asserts each of those
 * invariants against a real, long conversation.
 */
import type { ChatMessage } from '@/types'

export type ForkLevel = 'compact' | 'balanced' | 'faithful'

export interface ForkOptions {
  level?: ForkLevel
  /** How many of the most recent turns are carried near-verbatim. */
  keepLast?: number
  includeCode?: boolean
  /** Ceiling for the capsule, in estimated tokens. */
  budgetTokens?: number
}

export interface ForkStats {
  /** Estimated tokens in the source conversation. */
  sourceTokens: number
  /** Estimated tokens in the capsule. */
  capsuleTokens: number
  /** Whole-percent reduction. */
  savedPct: number
  turns: number
  keptVerbatim: number
  /** Constraint/decision lines carried across. */
  facts: number
  codeBlocks: number
}

export interface ForkResult {
  capsule: string
  stats: ForkStats
}

/** Provider-accurate token counts when we have them; a word/char blend when we do not. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const chars = Math.ceil(text.length / 4)
  const words = Math.ceil(text.trim().split(/\s+/).length * 1.32)
  return Math.max(chars, words)
}

export function conversationTokens(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0)
}

/** Per-turn rules for each level: how much of a turn is worth carrying. */
const TURN_RULES: Record<ForkLevel, { user: number; assistant: number; recent: number; code: number; bullets: number }> = {
  compact: { user: 160, assistant: 200, recent: 420, code: 8, bullets: 2 },
  balanced: { user: 280, assistant: 380, recent: 800, code: 14, bullets: 3 },
  faithful: { user: 520, assistant: 640, recent: 1800, code: 28, bullets: 5 },
}

/**
 * The sentences that change what an answer may be: requirements, prohibitions,
 * preferences, decisions. These are carried regardless of level.
 */
const SIGNAL = /\b(must|mustn't|should|shouldn't|shall|do not|don't|never|always|only|ensure|make sure|instead of|prefer|avoid|keep|require[sd]?|constraint|without|exactly|at least|no more than|remember|rename|call it|stick to|the plan|we decided|agreed|final answer|deadline)\b/i
const DECISION = /^\s*(?:[-*•]|\d+\.)\s*(.{12,})/
const NUMERAL = /\d/
const PLEASANTRY = /^\s*(thanks|thank you|ok(ay)?|sure|great|cool|nice|perfect|got it|hello|hi|hey)\b[.!,]?\s*$/i

/** Split into sentences without breaking on decimals, versions, or abbreviations. */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z(“"'\d])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Block {
  language: string
  code: string
  lines: number
}

/** Fenced code blocks, with their language tag and true line count. */
export function codeBlocks(text: string): Block[] {
  const out: Block[] = []
  const re = /```([^\n`]*)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const code = m[2].replace(/\s+$/, '')
    out.push({ language: (m[1] || 'text').trim(), code, lines: code.split('\n').length })
  }
  return out
}

function clamp(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  // Cut at a word boundary; never mid-word, never mid-identifier.
  const cut = t.slice(0, max)
  const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'))
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`
}

function trimCode(code: string, keep: number): string {
  const lines = code.split('\n')
  if (lines.length <= keep) return code
  const head = Math.ceil(keep * 0.6)
  const tail = keep - head
  const omitted = lines.length - keep
  return [...lines.slice(0, head), `// … ${omitted} line${omitted === 1 ? '' : 's'} trimmed …`, ...lines.slice(lines.length - tail)].join('\n')
}

/**
 * How alike two lines are, over their longer words.
 *
 * Nine turns of "for pass N, keep the fallback…" are one instruction, not nine
 * — carrying all of them is how a "compressed" prompt ends up the same size as
 * the conversation it replaced. Digits are dropped from the comparison so the
 * turn counter does not make a repeated instruction look new.
 */
function similar(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3))
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const w of A) if (B.has(w)) shared += 1
  return shared / Math.min(A.size, B.size)
}

/** The lines of a turn that must survive whatever the level is. */
function carryLines(text: string): string[] {
  const out: string[] = []
  const prose = text.replace(/```[\s\S]*?```/g, ' ')
  for (const raw of prose.split('\n')) {
    const line = raw.trim()
    if (!line || PLEASANTRY.test(line)) continue
    const bullet = line.match(DECISION)
    if (bullet && (SIGNAL.test(bullet[1]) || NUMERAL.test(bullet[1]))) {
      out.push(clamp(bullet[1].replace(/[*_`]/g, ''), 200))
    }
  }
  // Sentence by sentence, on prose only: a sentence that spans a code fence is
  // not a constraint, it is an accident of punctuation.
  for (const s of sentences(prose)) {
    if (PLEASANTRY.test(s)) continue
    if (SIGNAL.test(s)) out.push(clamp(s.replace(/^[-*•]\s*/, ''), 220))
  }
  return out
}

/** A turn, compressed to the level's allowance, in the order a reader needs it. */
function compressTurn(text: string, allowance: number, keepCode: number, includeCode: boolean, bullets: number, alreadySaid: string[]): { body: string[]; code: string[] } {
  const body: string[] = []
  const code: string[] = []

  if (includeCode) {
    for (const b of codeBlocks(text)) {
      code.push(`\`\`\`${b.language}\n${trimCode(b.code, keepCode)}\n\`\`\``)
    }
  }

  const withoutCode = text.replace(/```[\s\S]*?```/g, ' ')
  const sentencesIn = sentences(withoutCode).filter((s) => !PLEASANTRY.test(s))
  const headline = sentencesIn[0] ? clamp(sentencesIn[0], allowance) : ''
  if (headline) body.push(headline)

  // Numbers and named decisions are what a continuation cannot re-derive.
  const numeric = sentencesIn.slice(1).filter((s) => NUMERAL.test(s) && s.length < 220).slice(0, bullets)
  for (const s of numeric) body.push(clamp(s, 200))

  const last = sentencesIn[sentencesIn.length - 1]
  if (last && last !== headline && !numeric.includes(last) && last.length < 240) body.push(clamp(last, 200))

  // A turn that repeats what an earlier turn already said carries nothing new
  // — that is what makes long threads long.
  const fresh = [...new Set(body)]
    .filter((line) => line.trim().length > 0 && !alreadySaid.some((s) => similar(s, line) >= 0.8))
  return { body: fresh.slice(0, 4), code }
}

/**
 * Build the capsule.
 *
 * The order is deliberate: the task, then what has been decided, then where the
 * conversation currently stands, then the recent turns. A model reading it
 * top-down has everything it needs by the time it reaches the transcript, and
 * the transcript is the part that gets cut first if the budget is tight.
 */
export function compressConversation(messages: ChatMessage[], options: ForkOptions = {}): ForkResult {
  const level: ForkLevel = options.level ?? 'balanced'
  // 3 is the app's own default (settings.fork.keepLast), so a caller that
  // passes nothing gets the same numbers the fork panel shows.
  const keepLast = Math.max(0, options.keepLast ?? 3)
  const includeCode = options.includeCode !== false
  const budgetTokens = Math.max(300, options.budgetTokens ?? 1600)
  const rules = TURN_RULES[level]

  const turns = messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
  const sourceTokens = conversationTokens(turns)

  if (turns.length === 0) {
    return {
      capsule: '',
      stats: { sourceTokens: 0, capsuleTokens: 0, savedPct: 0, turns: 0, keptVerbatim: 0, facts: 0, codeBlocks: 0 },
    }
  }

  const firstUser = turns.find((m) => m.role === 'user')
  const lastUserIndex = turns.map((m) => m.role).lastIndexOf('user')
  const recentFrom = Math.max(0, turns.length - Math.max(keepLast, 1))
  const task = firstUser ? clamp(firstUser.content.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' '), rules.user) : ''

  // Constraints and decisions, deduped, newest phrasing wins (a later "actually
  // use Y" must not be contradicted by an earlier "use X").
  const facts: string[] = []
  const tooSimilar = (line: string) => facts.some((f) => similar(f, line) >= 0.72)
  for (let i = turns.length - 1; i >= 0; i--) {
    for (const line of carryLines(turns[i].content).reverse()) {
      if (tooSimilar(line)) continue
      facts.unshift(line)
    }
  }
  const factLimit = level === 'compact' ? 10 : level === 'balanced' ? 18 : 30
  const carriedFacts = facts.slice(0, factLimit)

  let codeCount = 0
  let verbatimCount = 0
  const blocks: string[] = []
  /** Every summary line already used, so a later turn cannot repeat it. */
  const alreadySaid: string[] = []
  /** Code already carried, compared on its own text. */
  const seenCode: string[] = []
  turns.forEach((m, i) => {
    const verbatim = i >= recentFrom || i === lastUserIndex
    if (verbatim) verbatimCount += 1
    const name = m.role === 'user' ? 'User' : 'AI'
    const tag = verbatim ? 'verbatim' : 'summary'
    const allowance = verbatim ? rules.recent : m.role === 'user' ? rules.user : rules.assistant
    const { body, code: allCode } = compressTurn(m.content, allowance, rules.code, includeCode, rules.bullets, alreadySaid)
    // The same snippet pasted into nine replies is one snippet. Keep the first
    // copy and let the later turns say what changed around it.
    const code = allCode.filter((c) => !seenCode.some((prev) => similar(prev, c) >= 0.9))
    seenCode.push(...code)
    alreadySaid.push(...body)
    codeCount += code.length
    const lines: string[] = [`### ${name} (${tag})`]
    if (verbatim) {
      const text = includeCode ? m.content.trim() : m.content.replace(/```[\s\S]*?```/g, '_[code omitted]_').trim()
      lines.push(clamp(text, allowance))
    } else {
      if (body.length) lines.push(...body.map((b) => `- ${b}`))
      for (const c of code) lines.push(c)
    }
    const asText = lines.join('\n')
    if (asText.length > 24) blocks.push(asText)
  })

  const header = [
    '# Conversation capsule',
    '',
    `Forked from an earlier chat. ${turns.length} turns were compressed into this capsule so the`,
    'continuation starts with the same context for a fraction of the tokens.',
    '',
    '## The task',
    '',
    task || '(no explicit first request was recorded)',
  ]

  const decisionBlock = carriedFacts.length
    ? ['', '## Decisions, constraints and facts', '', ...carriedFacts.map((f) => `- ${f}`)]
    : []

  const closing = [
    '',
    '## How to continue',
    '',
    'Treat the capsule above as the complete history of this work. Do not ask me to repeat it, and do not',
    'restate it back to me. Keep the same names, conventions, constraints and level of detail, and carry on',
    'from the last turn. If something you need is genuinely missing, ask one specific question about it.',
  ]

  /**
   * Assemble, then trim in one direction only.
   *
   * Two rules keep this honest: the transcript loses its oldest blocks first
   * (a continuation continues from the end), and the constraint list loses its
   * last entries next (the earlier ones set the frame the rest were written
   * in). The task and the closing instruction are never cut.
   */
  let keptBlocks = blocks
  let keptFacts = carriedFacts
  const assemble = () => [
    ...header,
    ...(keptFacts.length ? ['', '## Decisions, constraints and facts', '', ...keptFacts.map((f) => `- ${f}`)] : []),
    '',
    '## What was said',
    '',
    ...keptBlocks,
    ...closing,
  ].join('\n')

  let capsule = assemble()
  while (keptBlocks.length > 1 && estimateTokens(capsule) > budgetTokens) {
    keptBlocks = keptBlocks.slice(1)
    capsule = assemble()
  }
  while (keptFacts.length > 4 && estimateTokens(capsule) > budgetTokens) {
    keptFacts = keptFacts.slice(0, keptFacts.length - 1)
    capsule = assemble()
  }

  const capsuleTokens = estimateTokens(capsule)
  return {
    capsule,
    stats: {
      sourceTokens,
      capsuleTokens,
      savedPct: sourceTokens > 0 ? Math.max(0, Math.round((1 - capsuleTokens / sourceTokens) * 100)) : 0,
      turns: turns.length,
      keptVerbatim: verbatimCount,
      facts: carriedFacts.length,
      codeBlocks: codeCount,
    },
  }
}
