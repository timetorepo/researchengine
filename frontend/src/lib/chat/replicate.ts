// New Tech (Replication) mode — a staged research plan executed visibly:
// source discovery → principle extraction → mechanism explanation →
// replication guide → anti-patterns → primary-source pointers, plus dynamic
// extra stages when the query warrants them.
import { nanoid } from 'nanoid'
import type { ReplicateStage } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { generateText } from '@/lib/chat/generate'
import { getMaster } from '@/lib/prompts/masters'
import { webSearch } from '@/lib/search/web'
import { perfCaps } from '@/lib/system/performance'

const BASE: Omit<ReplicateStage, 'status' | 'content'>[] = [
  { id: 'sources', title: 'Source discovery', icon: 'search' },
  { id: 'principles', title: 'Principle extraction', icon: 'layers' },
  { id: 'mechanisms', title: 'Mechanism explanation', icon: 'book' },
  { id: 'replication', title: 'Replication guide', icon: 'hammer' },
  { id: 'antipatterns', title: 'Anti-patterns', icon: 'shield' },
  { id: 'pointers', title: 'Primary source pointers', icon: 'map' },
]

const EXTRA: { re: RegExp; stage: Omit<ReplicateStage, 'status' | 'content'> }[] = [
  { re: /(history|origin|how did .* (start|begin|come about)|who invented)/i, stage: { id: 'history', title: 'Historical context', icon: 'clock' } },
  { re: /(vs\.?|versus|compar|differen|alternative)/i, stage: { id: 'compare', title: 'Comparison with alternatives', icon: 'scale' } },
  { re: /(limit|trade[- ]?off|constraint|downside|risk)/i, stage: { id: 'limits', title: 'Constraint analysis', icon: 'flag' } },
  { re: /(tool|framework|library|stack|technolog|software)/i, stage: { id: 'tooling', title: 'Tooling', icon: 'wrench' } },
]

const STAGE_INSTRUCTIONS: Record<string, string> = {
  principles: 'Extract the core principles, rules, patterns and constraints. List them tersely with one-line explanations.',
  mechanisms: 'For each principle above, explain how it works and why it exists. Be mechanistic and concrete.',
  replication: 'Write a concrete, actionable replication guide: numbered steps the reader can apply in their own work starting today.',
  antipatterns: 'List common mistakes and anti-patterns when applying this, and why each fails.',
  pointers: 'Point to primary sources for deeper study: canonical papers, official docs, talks. Name them precisely.',
  history: 'Give the historical context: how this came to exist and what problem it solved.',
  compare: 'Compare with the main alternatives: where each wins and loses.',
  limits: 'Analyze constraints, limits and trade-offs honestly.',
  tooling: 'List the tools and technologies that enable this, with one line on each.',
}

export function planStages(query: string): ReplicateStage[] {
  const extras = EXTRA.filter((e) => e.re.test(query)).map((e) => e.stage)
  const all = [...BASE.slice(0, 3), ...extras.slice(0, 2), ...BASE.slice(3)]
  return [
    ...all.map((s) => ({ ...s, id: nanoid(6), status: 'pending' as const, content: '' })),
    { id: nanoid(6), title: 'Final synthesis', icon: 'sparkles' as const, status: 'pending' as const, content: '' },
  ]
}

export async function runReplicate(opts: {
  chatId: string
  msgId: string
  prompt: string
  signal: AbortSignal
}): Promise<void> {
  const { chatId, msgId, prompt, signal } = opts
  const store = useStore.getState()
  const overrides = store.settings.masterPromptOverrides
  const master = getMaster('replicate', overrides).text

  const stages = planStages(prompt)
  const patchStages = (next: ReplicateStage[]) =>
    useStore.getState().updateMessage(chatId, msgId, { stages: next })
  const patchOne = (idx: number, patch: Partial<ReplicateStage>) => {
    const cur = (useStore.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === msgId)?.stages) ?? stages
    patchStages(cur.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }
  patchStages(stages)

  const digest: string[] = []
  let totalTokens = 0

  for (let i = 0; i < stages.length; i++) {
    if (signal.aborted) return
    const st = stages[i]
    const t0 = performance.now()
    patchOne(i, { status: 'running' })
    useUI.setState({ island: { kind: 'skill', name: `Replicate · ${st.title}` } })

    try {
      if (st.title === 'Source discovery') {
        const outcome = await webSearch(prompt, Math.max(5, perfCaps().searchResults))
        const lines = outcome.sources.map((s, k) => `${k + 1}. **${s.title}** — ${s.domain}\n   ${s.url}`)
        const content = outcome.live
          ? `Retrieved via **${outcome.backend}**:\n\n${lines.join('\n')}`
          : `Backend unreachable — offline placeholders:\n\n${lines.join('\n')}\n\n> Re-run with a live search backend for real sources.`
        // auto-save to Citation Manager
        const st2 = useStore.getState()
        for (const s of outcome.sources) {
          if (!st2.citations.find((c) => c.url === s.url)) {
            useStore.setState((prev: any) => ({
              citations: [...prev.citations, { id: nanoid(8), title: s.title, url: s.url, domain: s.domain, savedAt: Date.now(), collection: 'Replicate research' }],
            }))
          }
        }
        useStore.getState().logConnection(`search://${outcome.backend}`, `replicate · ${prompt.slice(0, 40)}`, 2048, outcome.live ? 'ok' : 'local')
        digest.push(`Sources: ${outcome.sources.map((s) => s.title).join('; ')}`)
        patchOne(i, { status: 'done', content, ms: Math.round(performance.now() - t0), tokens: 0 })
        continue
      }

      if (st.title === 'Final synthesis') {
        let content: string
        const body = digest.join('\n\n')
        // synthesis: real model pass when available, assembly otherwise
        const res = await generateText({
          system: master + '\n\nYou are producing ONLY the final synthesis: the key takeaways in a copyable, tightly-structured format.',
          prompt: `Topic: ${prompt}\n\nStage outputs so far:\n\n${body}\n\nProduce the final synthesis: 5-8 key takeaways, then a one-paragraph bottom line.`,
          maxTokens: 900,
          signal,
        })
        content = res.text
        totalTokens += res.promptTokens + res.completionTokens
        if (res.usedDemo) {
          content += '\n\n> Assembled with the on-device engine — add a provider key for a model-written synthesis.'
        }
        patchOne(i, { status: 'done', content, ms: Math.round(performance.now() - t0), tokens: res.promptTokens + res.completionTokens })
        continue
      }

      const res = await generateText({
        system: master,
        prompt: `Topic: ${prompt}\n\nContext so far:\n${digest.slice(-3).join('\n') || '(first analysis stage)'}\n\nYour stage: ${st.title}. ${STAGE_INSTRUCTIONS[st.id] ?? ''}\n\nProduce only this stage's output in Markdown, under 300 words.`,
        maxTokens: 800,
        signal,
      })
      totalTokens += res.promptTokens + res.completionTokens
      digest.push(`${st.title}:\n${res.text}`)
      patchOne(i, { status: 'done', content: res.text, ms: Math.round(performance.now() - t0), tokens: res.promptTokens + res.completionTokens })
    } catch (e: any) {
      if (signal.aborted || e?.name === 'AbortError') { patchOne(i, { status: 'error', content: 'Halted.' }); return }
      patchOne(i, { status: 'error', content: `Stage failed: ${String(e?.message ?? e)}` })
    }
  }

  useUI.setState({ island: { kind: 'idle' } })
  const finished = (useStore.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === msgId)?.stages) ?? []
  const doneCount = finished.filter((s) => s.status === 'done').length
  useStore.getState().updateMessage(chatId, msgId, {
    content: `Executed ${doneCount}/${finished.length} research stages · ${totalTokens.toLocaleString()} tokens. Expand each stage below; the final synthesis is copyable.`,
  })
}
