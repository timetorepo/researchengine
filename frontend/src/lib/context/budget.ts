// Context budget. Every piece that reaches a model is capped, so a long session
// stops growing: older turns shrink, old tool output is compacted, and attached
// material is clipped. The newest turns and the current round stay in full, so
// the quality of the answer in front of the user is never traded away.
import { estimateTokens } from '@/lib/flow/pruner'

export const LIMITS = {
  /** Whole-history budget per prompt, in estimated tokens, by flow mode. */
  historyTokens: { efficient: 12_000, balanced: 32_000, fidelity: 96_000 } as Record<string, number>,
  /** The newest messages are always sent verbatim (up to `verbatimChars` each). */
  verbatimMessages: 6,
  verbatimChars: 12_000,
  /** Older messages keep this much of their text (the start carries the gist). */
  olderChars: 700,
  /** One tool result is never larger than this when it is produced. */
  toolResultChars: 12_000,
  /** Tool results from earlier rounds are shortened to this much. */
  toolStubChars: 800,
  roleText: 6_000,
  skillPacks: 12_000,
  connectorRefs: 12_000,
  retrieved: 16_000,
  projectTree: 4_000,
  mcpBlock: 6_000,
} as const

/** Clip text to `max` characters, saying so out loud when it happens. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…[${text.length - max} characters left out to fit the context budget]`
}

export interface BudgetMsg { role: 'user' | 'assistant'; content: string }

export interface HistoryFit {
  messages: BudgetMsg[]
  capsule: string | null
  /** Messages that did not fit and were summarised into the capsule. */
  folded: number
  /** Messages that were shortened but still sent. */
  shortened: number
}

/**
 * Fit a conversation into the history budget. Walks from the newest message
 * back; recent messages are kept (shortened only past `verbatimChars`), older
 * ones are shortened to `olderChars`, and anything beyond the budget is folded
 * into a short capsule of first lines.
 */
export function fitHistory(msgs: BudgetMsg[], budgetTokens: number): HistoryFit {
  const n = msgs.length
  const kept: BudgetMsg[] = []
  const folded: BudgetMsg[] = []
  let used = 0
  let shortened = 0
  for (let i = n - 1; i >= 0; i--) {
    const m = msgs[i]
    const recent = n - 1 - i < LIMITS.verbatimMessages
    const text = clip(m.content, recent ? LIMITS.verbatimChars : LIMITS.olderChars)
    const t = estimateTokens(text)
    if (text.length < m.content.length) shortened++
    if (!recent && used + t > budgetTokens) {
      folded.unshift(m)
      continue
    }
    kept.unshift({ role: m.role, content: text })
    used += t
  }
  let capsule: string | null = null
  if (folded.length) {
    const shown = folded.slice(-12)
    const gist = shown
      .map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${(m.content.split('\n').filter(Boolean)[0] ?? '').slice(0, 96)}`)
      .join('\n')
    const more = folded.length > shown.length ? `, ${folded.length - shown.length} condensed further` : ''
    capsule = `[Context capsule — summary of ${folded.length} earlier messages${more}]\n${gist}`
  }
  return { messages: kept, capsule, folded: folded.length, shortened }
}

/**
 * Compact tool output from earlier rounds. The current round keeps its full
 * results; older ones keep their head and say how much was dropped, so the
 * model still sees what each tool returned without re-reading all of it.
 */
export function compactToolRounds<T extends { role: string; content?: unknown }>(msgs: T[]): T[] {
  let lastCall = -1
  msgs.forEach((m: any, i) => { if (m.role === 'assistant' && m.toolCalls?.length) lastCall = i })
  return msgs.map((m: any, i) => {
    if (m.role !== 'tool' || i >= lastCall || typeof m.content !== 'string') return m
    if (m.content.length <= LIMITS.toolStubChars) return m
    const head = m.content.slice(0, LIMITS.toolStubChars)
    return { ...m, content: `${head}\n…[earlier ${m.name ?? 'tool'} output, ${m.content.length - LIMITS.toolStubChars} characters left out]` }
  })
}

/** Total estimated tokens of a message list, for logs and tests. */
export function tokensOf(msgs: { content?: unknown }[]): number {
  return msgs.reduce((a, m) => a + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')), 0)
}
