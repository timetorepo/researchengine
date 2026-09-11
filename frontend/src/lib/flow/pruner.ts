// AIFlowEngine — context pruning. Older messages are compressed into a
// compact "capsule"; the full history stays local, only the capsule is sent.
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
  const msgs = history.filter((m) => !m.error)
  const originalTokens = msgs.reduce((a, m) => a + estimateTokens(m.content), 0)

  if (!enabled || msgs.length <= 4 || mode === 'fidelity') {
    return {
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      originalTokens,
      prunedTokens: originalTokens,
      capsule: null,
    }
  }

  // efficient: keep last 2 turns; balanced: keep last 4
  const keepTurns = mode === 'efficient' ? 4 : 8
  const keep = msgs.slice(-keepTurns)
  const old = msgs.slice(0, -keepTurns)

  let capsule = ''
  if (old.length) {
    const gist = old
      .map((m) => {
        const first = m.content.split('\n').filter(Boolean)[0] ?? ''
        return `${m.role === 'user' ? 'Q' : 'A'}: ${first.slice(0, 110)}`
      })
      .join('\n')
    capsule = `[Context capsule — summary of ${old.length} earlier messages]\n${gist}`
  }

  const out: { role: 'user' | 'assistant'; content: string }[] = []
  if (capsule) out.push({ role: 'user', content: capsule })
  for (const m of keep) out.push({ role: m.role, content: m.content })

  const prunedTokens = out.reduce((a, m) => a + estimateTokens(m.content), 0)
  return { messages: out, originalTokens, prunedTokens, capsule }
}
