// AIFlowEngine — context pruning. Older messages are compressed into a
// compact "capsule"; the full history stays local, only the capsule is sent.
// Pruning is adaptive: if a capsule would not actually reduce tokens, the
// full context is sent instead.
import type { ChatMessage, FlowMode } from '@/types'
import { fitHistory, LIMITS } from '@/lib/context/budget'

export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

export interface PruneResult {
  messages: { role: 'user' | 'assistant'; content: string }[]
  originalTokens: number
  prunedTokens: number
  capsule: string | null
}

/**
 * Keep the conversation inside the history budget (see lib/context/budget.ts).
 * Recent turns go verbatim, older turns shrink, and what does not fit is folded
 * into a capsule. The flow setting only decides how big the budget is; it can
 * no longer let a long session grow without bound.
 */
export function pruneContext(history: ChatMessage[], mode: FlowMode, enabled: boolean): PruneResult {
  const msgs = history.filter((m) => !m.error && m.content.trim().length > 0)
  const originalTokens = msgs.reduce((a, m) => a + estimateTokens(m.content), 0)
  const full = msgs.map((m) => ({ role: m.role, content: m.content }))

  // Fidelity keeps the most context; the other modes trade a little of it for
  // speed. With flow switched off the larger budget applies.
  const budgetMode = !enabled ? 'fidelity' : mode
  const budget = LIMITS.historyTokens[budgetMode] ?? LIMITS.historyTokens.balanced
  const fit = fitHistory(full, budget)
  if (!fit.folded && !fit.shortened) {
    return { messages: full, originalTokens, prunedTokens: originalTokens, capsule: null }
  }
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  if (fit.capsule) out.push({ role: 'user', content: fit.capsule })
  out.push(...fit.messages)
  const prunedTokens = out.reduce((a, m) => a + estimateTokens(m.content), 0)
  return { messages: out, originalTokens, prunedTokens, capsule: fit.capsule }
}
