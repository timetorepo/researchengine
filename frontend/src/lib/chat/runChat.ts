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
import { streamToCallback, ProviderError, type StreamToolCall } from '@/lib/providers/stream'
import { toolSpecs, executeTool, mcpContextBlock, type ToolContext } from './tools'
import { CODING_RULES } from '@/lib/ide/coding-rules'
import { shieldOutbound, recordScan } from '@/lib/privacy/shield'
import { providerById } from '@/lib/providers/registry'
import { streamDemo, DEMO_FOLLOW_UPS } from '@/lib/providers/demo'
import { webSearch } from '@/lib/search/web'
import { usableKey } from '@/lib/providers/keys'
import { useUI } from '@/stores/useUI'
import type { ChatMessage, Source } from '@/types'

export interface RunOptions {
  chatId: string
  prompt: string
  mode?: { math?: boolean; quality?: boolean; search?: boolean; replicate?: boolean }
  modelOverride?: string
  overrideHistory?: ChatMessage[]
  /** Vision: images attached to this prompt. */
  attachments?: { type: 'image'; name: string; dataUrl: string }[]
  /** Connector items the user attached via the chatbox connector picker. */
  contextRefs?: { box: 'files' | 'drive' | 'mail' | 'calendar'; id: string; title: string }[]
  /** Coding mode: the open project (enables ide_* tools + project context). */
  project?: string
  projectTree?: string
  /** Design mode: a live preview of the project is on screen and the AI may
   *  drive it (snapshot / click / assert / screenshot) through the bridge. */
  design?: boolean
  /** Extra instructions appended to the system prompt (intent preambles). */
  preamble?: string
}

const activeStreams = new Map<string, AbortController>()
export const stopStream = (chatId: string) => activeStreams.get(chatId)?.abort()
export const isStreamingChat = (chatId: string) => activeStreams.has(chatId)

// ---- Question queue: prompts sent while the AI is busy are held here and
// drained automatically, one at a time, when the current run completes. ----
export interface QueuedPrompt { id: string; prompt: string; mode?: RunOptions['mode']; extra?: Pick<RunOptions, 'attachments' | 'contextRefs' | 'project' | 'projectTree' | 'design' | 'preamble' | 'modelOverride'> }

export function enqueuePrompt(chatId: string, prompt: string, mode?: RunOptions['mode'], extra?: QueuedPrompt['extra']): string {
  const id = nanoid(8)
  useUI.setState((s) => ({ queue: { ...s.queue, [chatId]: [...(s.queue[chatId] ?? []), { id, prompt, mode, extra }] } }))
  return id
}

export function removeQueued(chatId: string, itemId: string) {
  useUI.setState((s) => {
    const list = (s.queue[chatId] ?? []).filter((q) => q.id !== itemId)
    const queue = { ...s.queue }
    if (list.length) queue[chatId] = list
    else delete queue[chatId]
    return { queue }
  })
}

function drainQueue(chatId: string) {
  const next = useUI.getState().queue[chatId]?.[0]
  if (!next) return
  useUI.setState((s) => ({ queue: { ...s.queue, [chatId]: (s.queue[chatId] ?? []).slice(1) } }))
  setTimeout(() => { void runChat({ chatId, prompt: next.prompt, mode: next.mode, ...next.extra }) }, 80)
}

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
    attachments: opts.attachments?.length ? opts.attachments : undefined,
  }
  store.addMessage(chatId, userMsg)

  const asstId = nanoid(8)
  const [providerId, model] = (opts.modelOverride ?? settings.defaultModel).split(':')
  const providerMeta = providerById(providerId)

  // A model was selected but is broken (unknown provider, or provider with no
  // model part): surface a clear, actionable error instead of pretending.
  // A completely empty defaultModel is the fresh/demo state — it falls
  // through to the fully-local demo pipeline below, by design.
  if (providerId && (!providerMeta || !model)) {
    store.addMessage(chatId, {
      id: asstId, role: 'assistant', content: '', createdAt: Date.now(), mode,
      model: model || 'none', provider: providerMeta?.name ?? providerId,
      error: 'The selected model is unavailable. Open the model picker (top bar) and pick a fetched model, or reconnect the provider under Settings → Providers.',
    })
    return
  }

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
      drainQueue(chatId)
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
  // Privacy Shield: in Top Secret mode webSearch itself goes offline-first
  // (zero external requests), so this path stays safe to call in every mode.
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
    system += `\n\nWeb search results retrieved for this query:\n${grounded}\n\nYou MUST write a complete, helpful answer to the user's question — several sentences at minimum. Never respond with only links, titles, or a list of sources: the user cannot see the sources as an answer by themselves. Use the results above where they help and cite them inline with [n] markers; ignore results that are not useful. Where the results are thin, irrelevant, or missing, fall back to your own knowledge and still deliver a full answer. If live search was unavailable (offline placeholders), say briefly that live search could not be reached, then answer from your own knowledge anyway.`
    useUI.setState({ island: { kind: 'streaming', tokens: 0 } })
  }

  // ---- Coding-mode + MCP + privacy context ----
  if (opts.project) {
    system += `\n\nYou are in Coding mode inside the local project "${opts.project}". You can inspect and edit its files (ide_list_files, ide_read_file, ide_write_file), run commands with ide_run_command (the user approves each one), and use ide_git for git. Work carefully: prefer small, correct edits; explain what you changed.`
    // House rules: the difference between an assistant that is useful in a
    // codebase and one that confidently invents things. Loaded from the module
    // so the skill picker and this prompt can never drift apart.
    system += `\n\n${CODING_RULES}`
    if (opts.projectTree) {
      const tree = shieldOutbound(opts.projectTree.slice(0, 4000))
      if (tree.findings.length) recordScan('coding project tree', tree.findings)
      system += `\nProject files:\n${tree.text}`
    }
  }
  if (opts.design && opts.project) {
    system += `\n\nDESIGN MODE is active: the project "${opts.project}" is running in a live preview pane and you can SEE and OPERATE the real screen with client tools.`
      + `\n- Start by calling design_snapshot (structured page read: elements, geometry, colours, flags) and design_audit (contrast, tap targets, headings, overflow, console).`
      + `\n- design_screenshot renders a real picture of the screen; the user sees it in the Design panel.`
      + `\n- Exercise the UI with design_controls, design_click, design_type, design_assert and design_resize; verify with design_assert or run_ui_test instead of assuming a change worked.`
      + `\n- Fix what you find by editing the project files (ide_read_file / ide_write_file), then design_preview action=restart and re-check.`
      + `\n- Never claim a UI issue is fixed without a passing design_assert or run_ui_test result.`
  }
  if (opts.preamble) system += `\n\n${opts.preamble}`
  system += mcpContextBlock()
  system += `\n\nIf you need the user's preferences or decisions (for example what to fix or refine in a project), call the ask_user tool with 2-5 focused questions instead of guessing.`

  // ---- connector references attached from the chatbox picker ----
  if (opts.contextRefs?.length) {
    const parts: string[] = []
    for (const ref of opts.contextRefs.slice(0, 5)) {
      try {
        const res = ref.box === 'files'
          ? await fetch(`/api/fs/read?path=${encodeURIComponent(ref.id)}`)
          : await fetch(`/api/connectors/item?box=${ref.box}&id=${encodeURIComponent(ref.id)}`)
        if (!res.ok) continue
        if (ref.box === 'files') {
          parts.push(`--- ${ref.title} (local file) ---\n${(await res.text()).slice(0, 8000)}`)
        } else {
          const item = (await res.json()).item
          if (item) {
            const body = item.body ?? item.notes ?? item.text ?? JSON.stringify(item)
            parts.push(`--- ${ref.title} (${ref.box}) ---\n${String(body).slice(0, 8000)}`)
          }
        }
      } catch { /* skip unreadable refs */ }
    }
    if (parts.length) {
      // Attached connector data is user content heading outbound — run it
      // through the Privacy Shield so secrets are redacted per the active mode.
      const joined = shieldOutbound(parts.join('\n\n'))
      if (joined.findings.length) recordScan(`connector attachments (${opts.contextRefs!.length})`, joined.findings)
      system += `\n\nThe user attached these connector items to the message — use them directly:\n\n${joined.text}`
    }
  }

  // ---- resolve credentials ----
  // Encrypted keys are decrypted via the in-memory vault passphrase. If the
  // vault is locked we must NOT silently fall back to the demo model (that
  // reads as a bogus provider error like "403 Forbidden" later) — open the
  // unlock prompt and stop with a clear message.
  const pconf = settings.providers[providerId]
  let apiKey = ''
  if (pconf?.apiKey) {
    try {
      apiKey = await usableKey(pconf.apiKey)
    } catch (e: any) {
      useStore.getState().updateMessage(chatId, asstId, { error: e?.message ?? 'Could not unlock the API key.' })
      cleanup(chatId)
      return
    }
  }

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

      // ---- wire messages: history + vision attachments + Privacy Shield ----
      const kind = providerMeta!.kind
      const supportsVision = kind === 'openai' || kind === 'gemini' || kind === 'anthropic' || kind === 'compatible'
      const wire: any[] = pruned.messages.map((m: any, i: number) => {
        const isLastUser = i === pruned.messages.length - 1 && m.role === 'user'
        const note = Array.isArray(m.attachments) && m.attachments.length && !isLastUser
          ? `\n[attached image(s): ${m.attachments.map((a: any) => a.name).join(', ')}]` : ''
        let content: any = typeof m.content === 'string' ? m.content + note : m.content
        if (isLastUser && opts.attachments?.length && supportsVision) {
          content = [
            ...opts.attachments.map((a) => ({ type: 'image', dataUrl: a.dataUrl })),
            { type: 'text', text: content },
          ]
        }
        // Privacy Shield: redact secrets before anything leaves the device.
        if (typeof content === 'string') {
          const shielded = shieldOutbound(content)
          if (shielded.findings.length) recordScan(`chat → ${providerMeta!.name}`, shielded.findings)
          content = shielded.text
        }
        return { role: m.role, content }
      })

      // Shield the assembled system context as a final boundary. This covers
      // generated search/MCP/project context that may not have passed through
      // an earlier content-specific path.
      const shieldedSystem = shieldOutbound(system)
      if (shieldedSystem.findings.length) recordScan(`system context → ${providerMeta!.name}`, shieldedSystem.findings)

      // ---- tool-calling loop (questionnaire, connectors, search, IDE, MCP) ----
      const toolCtx: ToolContext = { chatId, asstId, project: opts.project, projectTree: opts.projectTree }
      const specs = toolSpecs(toolCtx)
      const toolsAllowed = kind === 'openai' || kind === 'gemini' || kind === 'anthropic'
      const MAX_TOOL_ROUNDS = 4
      let round = 0
      let current: any[] = wire
      const trace = (label: string, status: 'ok' | 'error' | 'blocked' | 'confirm') => {
        const msg = useStore.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === asstId)
        useStore.getState().updateMessage(chatId, asstId, { toolTrace: [...(msg?.toolTrace ?? []), { tool: label, label, status }] })
      }
      for (;;) {
        round++
        const res = await streamToCallback({
          providerId, model, apiKey,
          baseUrl: pconf?.baseUrl || undefined,
          system: shieldedSystem.text,
          messages: current,
          temperature: settings.modelDefaults[model]?.temperature ?? (mode.math ? 0.2 : 0.7),
          maxTokens: Math.min(settings.modelDefaults[model]?.maxTokens ?? lengthHint(cls).maxTokens, 4000),
          signal: controller.signal,
          tools: toolsAllowed ? specs : undefined,
        }, pushChunk)
        promptTokens = res.promptEstimate
        completionTokens += res.completionTokens
        const calls = res.toolCalls ?? []
        if (!toolsAllowed || !calls.length || round >= MAX_TOOL_ROUNDS) break
        current = [...current, { role: 'assistant', content: '', toolCalls: calls }]
        for (const tc of calls) {
          const result = await executeTool({ id: tc.id, name: tc.name, arguments: tc.arguments }, toolCtx, trace)
          // Tool output re-enters the outbound conversation on the next round
          // (a file read could surface a .env secret) — shield it too.
          const shielded = shieldOutbound(result)
          if (shielded.findings.length) recordScan(`tool result · ${tc.name}`, shielded.findings)
          current.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content: shielded.text })
        }
        bumpIsland()
      }
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
      drainQueue(chatId)
      return
    }
    const msg = e instanceof ProviderError ? `${e.provider}: ${e.message}` : String(e?.message ?? e)
    useStore.getState().updateMessage(chatId, asstId, { error: msg })
    cleanup(chatId)
    return
  }

  if (flowEnabled && !cached) cacheSet(prompt + JSON.stringify(mode), completionText)
  finish(chatId, asstId, completionText, { sources, usedDemo, promptTokens, completionTokens, pruned })
  drainQueue(chatId)
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
