// The send pipeline: classify → prune → shape prompt → call provider (or
// local demo) → stream → record Flow transparency stats.
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { classifyQuery, shapeSystemPrompt, lengthHint } from '@/lib/flow/classifier'
import { runReplicate } from './replicate'
import { perfCaps } from '@/lib/system/performance'
import { createFlowRun, shapeConfigFrom } from '@/lib/flow/engine'
import { pruneContext, estimateTokens } from '@/lib/flow/pruner'
import { cacheGet, cacheSet } from '@/lib/flow/cache'
import { streamToCallback, ProviderError } from '@/lib/providers/stream'
import { providerById } from '@/lib/providers/registry'
import { streamDemo, DEMO_FOLLOW_UPS } from '@/lib/providers/demo'
import { webSearch } from '@/lib/search/web'
import { resolveKey } from '@/lib/crypto/vault'
import { getVaultPassphrase } from '@/lib/crypto/session'
import { useUI } from '@/stores/useUI'
import type { ChatMessage, Source } from '@/types'

export interface RunOptions {
  chatId: string
  prompt: string
  mode?: { math?: boolean; quality?: boolean; search?: boolean; replicate?: boolean }
  modelOverride?: string
  overrideHistory?: ChatMessage[]
}

const activeStreams = new Map<string, AbortController>()
export const stopStream = (chatId: string) => activeStreams.get(chatId)?.abort()
export const isStreamingChat = (chatId: string) => activeStreams.has(chatId)

// UI live-stream state (which message is currently receiving tokens)
export const streamState = { chatId: null as string | null, msgId: null as string | null }

export async function runChat(opts: RunOptions): Promise<void> {
  const store = useStore.getState()
  const { chatId, prompt } = opts
  const chat = store.chats.find((c) => c.id === chatId)
  if (!chat) return

  const settings = store.settings
  const mode = opts.mode ?? {}
  if (mode.quality) mode.search = true // quality mode auto-enables search

  const userMsg: ChatMessage = {
    id: nanoid(8), role: 'user', content: prompt, createdAt: Date.now(), mode,
  }
  store.addMessage(chatId, userMsg)

  const asstId = nanoid(8)
  const [providerId, model] = (opts.modelOverride ?? settings.defaultModel).split(':')
  const providerMeta = providerById(providerId)

  const asstMsg: ChatMessage = {
    id: asstId, role: 'assistant', content: '', createdAt: Date.now(),
    model, provider: providerMeta?.name ?? providerId, mode,
  }
  store.addMessage(chatId, asstMsg)

  streamState.chatId = chatId
  streamState.msgId = asstId
  const controller = new AbortController()
  activeStreams.set(chatId, controller)
  useUI.setState({ island: { kind: 'streaming', tokens: 0 } })

  // AIFlowEngine: surface pipeline stages immediately — the thinking indicator
  // commits within a frame, before any network round-trip.
  useUI.setState({ flow: { chatId, stage: 'understand', phase: 'thinking' } })

  // ---- New Tech (Replication) mode: staged plan executed visibly ----
  if (mode.replicate) {
    try {
      await runReplicate({ chatId, msgId: asstId, prompt, signal: controller.signal })
    } finally {
      activeStreams.delete(chatId)
      useUI.setState({ island: { kind: 'idle' } })
    }
    return
  }

  // Live history INCLUDING the user message just added, minus the empty
  // assistant placeholder that is about to be streamed into.
  const liveChat = useStore.getState().chats.find((c) => c.id === chatId)!
  const history = opts.overrideHistory ?? liveChat.messages.slice(0, -1)
  const flowEnabled = settings.flowEnabled
  const pruned = pruneContext(history, settings.flowMode, flowEnabled)

  const cls = classifyQuery(prompt)
  const sysBase = shapeSystemPrompt(cls, { math: mode.math, quality: mode.quality, flow: settings.flowEnabled }, settings.masterPromptOverrides)
  const customSys = settings.customSystemPrompts[mode.math ? 'math' : 'default']
  let system = customSys ? `${customSys}\n\n${sysBase}` : sysBase

  // ---- real web search sources ----
  let sources: Source[] | undefined
  if (mode.search) {
    useUI.setState({ island: { kind: 'search', sources: 0 }, flow: { chatId, stage: 'search', phase: 'thinking' } })
    const outcome = await webSearch(prompt, perfCaps().searchResults)
    sources = outcome.sources
    useUI.setState({ island: { kind: 'search', sources: sources.length }, flow: { chatId, stage: 'read-sources', phase: 'thinking' } })
    store.logConnection(`search://${outcome.backend}`, `web search: ${prompt.slice(0, 40)}`, 2048, outcome.live ? 'ok' : 'local')
    for (const s of sources) {
      if (!store.citations.find((c) => c.url === s.url)) {
        useStore.setState((st: any) => ({
          citations: [...st.citations, { id: nanoid(8), title: s.title, url: s.url, domain: s.domain, savedAt: Date.now(), collection: 'Web search' }],
        }))
      }
    }
    // Ground the model in the retrieved results with numbered citations.
    const grounded = sources.map((s, i) =>
      `[${i + 1}] ${s.title} (${s.domain})\n    ${s.url}${s.snippet ? `\n    ${s.snippet}` : ''}`).join('\n')
    system += `\n\nWeb search results retrieved for this query. Ground your answer in them and cite inline with [n]:\n${grounded}\n\nCite the most relevant results with [n] markers. Ignore results that are not useful.${outcome.live ? '' : '\n(Note: search backend unreachable — the results above are offline placeholders.)'}`
    await new Promise((r) => setTimeout(r, 250))
    useUI.setState({ island: { kind: 'streaming', tokens: 0 } })
  }

  // ---- resolve credentials ----
  const pconf = settings.providers[providerId]
  let apiKey = ''
  if (pconf?.apiKey) apiKey = await resolveKey(pconf.apiKey, getVaultPassphrase())

  const useReal = !!providerMeta && (!providerMeta.needsKey || apiKey.length > 0)
  const t0 = performance.now()
  let completionText = ''
  let promptTokens = 0
  let completionTokens = 0
  let usedDemo = false
  let lastIslandUpdate = 0
  const bumpIsland = () => {
    const now = performance.now()
    if (now - lastIslandUpdate > 250) {
      lastIslandUpdate = now
      useUI.setState({ island: { kind: 'streaming', tokens: Math.round(completionText.length / 4) } })
    }
  }

  // ---- AIFlowEngine: stream shaping + pipeline stages ----
  // Raw provider bursts enter the engine's ring buffer; the pacer renders
  // words at a composed cadence. The store only ever sees shaped output.
  let resolveDrained: () => void
  const drained = new Promise<void>((res) => { resolveDrained = res })
  const run = createFlowRun(shapeConfigFrom(settings), (text) => {
    useStore.getState().appendToken(chatId, asstId, text)
    bumpIsland()
  }, {
    onStageChange: (stage) => useUI.setState({
      flow: { chatId, stage, phase: stage === 'compose' ? 'streaming' : 'thinking' },
    }),
    onStreamStall: () => {
      const f = useUI.getState().flow
      if (f && f.chatId === chatId) useUI.setState({ flow: { ...f, phase: 'stalled' } })
    },
    onStreamResume: () => {
      const f = useUI.getState().flow
      if (f && f.chatId === chatId) useUI.setState({ flow: { ...f, stage: 'compose', phase: 'streaming' } })
    },
    onComplete: () => resolveDrained(),
  })
  run.setStage('understand')
  run.setStage('think')
  const pushChunk = (chunk: string) => {
    completionText += chunk
    run.ingest(chunk)
  }

  // Flow cache hit?
  const cached = flowEnabled ? cacheGet(prompt + JSON.stringify(mode)) : null

  try {
    if (cached) {
      completionText = cached
      streamFullText(chatId, asstId, cached)
      run.abort()
      useUI.setState({ flow: null })
    } else if (useReal) {
      run.begin()
      store.logConnection(providerMeta!.baseUrl, `${providerMeta!.name} · ${model}`, estimateTokens(prompt) * 4)
      const res = await streamToCallback({
        providerId, model, apiKey,
        baseUrl: pconf?.baseUrl || undefined,
        system,
        messages: pruned.messages,
        temperature: settings.modelDefaults[model]?.temperature ?? (mode.math ? 0.2 : 0.7),
        maxTokens: Math.min(settings.modelDefaults[model]?.maxTokens ?? lengthHint(cls).maxTokens, 4000),
        signal: controller.signal,
      }, pushChunk)
      promptTokens = res.promptEstimate
      completionTokens = res.completionTokens
      run.endRaw()
      await drained
      run.finish()
    } else {
      usedDemo = true
      run.begin()
      store.logConnection('local://demo', 'on-device demo model', estimateTokens(prompt) * 4, 'local')
      await streamDemo(prompt, { math: mode.math, quality: mode.quality, search: mode.search }, pushChunk, controller.signal)
      promptTokens = pruned.prunedTokens
      completionTokens = estimateTokens(completionText)
      run.endRaw()
      await drained
      run.finish()
    }
    useUI.setState({ flow: null })
  } catch (e: any) {
    run.abort()
    useUI.setState({ flow: null })
    if (e.name === 'AbortError') {
      // Keep exactly what was rendered — the pacer's un-emitted queue is dropped.
      finish(chatId, asstId, '', { sources, usedDemo, promptTokens, completionTokens, pruned, aborted: true })
      return
    }
    const msg = e instanceof ProviderError ? `${e.provider}: ${e.message}` : String(e?.message ?? e)
    useStore.getState().updateMessage(chatId, asstId, { error: msg })
    cleanup(chatId)
    return
  }

  if (flowEnabled && !cached) cacheSet(prompt + JSON.stringify(mode), completionText)
  finish(chatId, asstId, completionText, { sources, usedDemo, promptTokens, completionTokens, pruned })
}

function finish(
  chatId: string, msgId: string, text: string,
  ctx: { sources?: Source[]; usedDemo: boolean; promptTokens: number; completionTokens: number; pruned: any; aborted?: boolean },
) {
  const store = useStore.getState()
  const settings = store.settings

  const savedTokens = Math.max(0, ctx.pruned.originalTokens - ctx.pruned.prunedTokens)
  const savedPct = ctx.pruned.originalTokens > 0
    ? Math.round((1 - ctx.pruned.prunedTokens / Math.max(1, ctx.pruned.originalTokens)) * 100)
    : 0
  if (settings.flowEnabled && savedTokens > 0) store.addTokensSaved(savedTokens)

  const followUps = DEMO_FOLLOW_UPS
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  store.updateMessage(chatId, msgId, {
    content: text || (ctx.aborted ? store.chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === msgId)?.content ?? '' : text),
    sources: ctx.sources,
    followUps,
    stopped: ctx.aborted ? true : undefined,
    flow: {
      originalTokens: ctx.pruned.originalTokens,
      prunedTokens: ctx.pruned.prunedTokens,
      promptTokens: ctx.promptTokens,
      completionTokens: ctx.completionTokens,
      savedPct: settings.flowEnabled ? savedPct : 0,
      costSaved: +(savedTokens * 0.000003).toFixed(5),
    },
  })
  cleanup(chatId)
}

function cleanup(chatId: string) {
  activeStreams.delete(chatId)
  streamState.chatId = null
  streamState.msgId = null
  useUI.setState((s) => ({ island: s.island.kind === 'streaming' || s.island.kind === 'search' ? { kind: 'idle' } : s.island }))
}

/** Instantly render full text (cache hit). */
function streamFullText(chatId: string, msgId: string, text: string) {
  useStore.getState().updateMessage(chatId, msgId, { content: text })
}
