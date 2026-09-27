// AIFlowEngine — context pruning. Older messages are compressed into a
// compact "capsule"; the full history stays local, only the capsule is sent.
// Pruning is adaptive: if a capsule would not actually reduce tokens, the
// full context is sent instead.
import type { ChatMessage, FlowMode } from '@/types'

export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

export interface PruneResult {
  messages: { role: 'user' | 'assistant'; content: string }[]
  originalTokens: number
  prunedTokens: number
  capsule: string | null
}

/** Keep recent turns verbatim; summarize older turns into a capsule. */
export function pruneContext(history: ChatMessage[], mode: FlowMode, enabled: boolean): PruneResult {
  const msgs = history.filter((m) => !m.error && m.content.trim().length > 0)
  const originalTokens = msgs.reduce((a, m) => a + estimateTokens(m.content), 0)
  const full = msgs.map((m) => ({ role: m.role, content: m.content }))

  if (!enabled || msgs.length <= 4 || mode === 'fidelity') {
    return { messages: full, originalTokens, prunedTokens: originalTokens, capsule: null }
  }

  // efficient: keep last 2 turns; balanced: keep last 4
  const keepCount = mode === 'efficient' ? 4 : 8
  const keep = msgs.slice(-keepCount)
  const old = msgs.slice(0, -keepCount)

  let capsule = ''
  if (old.length) {
    // cap the capsule itself: at most 12 gist lines, 96 chars each
    const shown = old.slice(-12)
    const gist = shown
      .map((m) => {
        const first = m.content.split('\n').filter(Boolean)[0] ?? ''
        return `${m.role === 'user' ? 'Q' : 'A'}: ${first.slice(0, 96)}`
      })
      .join('\n')
    const omitted = old.length - shown.length
    capsule = `[Context capsule — summary of ${old.length} earlier messages${omitted > 0 ? `, ${omitted} condensed further` : ''}]\n${gist}`
  }

  const out: { role: 'user' | 'assistant'; content: string }[] = []
  if (capsule) out.push({ role: 'user', content: capsule })
  for (const m of keep) out.push({ role: m.role, content: m.content })

  const prunedTokens = out.reduce((a, m) => a + estimateTokens(m.content), 0)

  // Adaptive guard: never send MORE tokens than the original context.
  if (prunedTokens >= originalTokens) {
    return { messages: full, originalTokens, prunedTokens: originalTokens, capsule: null }
  }
  return { messages: out, originalTokens, prunedTokens, capsule }
}
