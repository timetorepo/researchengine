// The send pipeline: classify → prune → shape prompt → call provider (or
// local demo) → stream → record Flow transparency stats.
import { nanoid } from 'nanoid'
import type { IntegrationId } from '@/lib/integrations/registry'
import { useStore } from '@/stores/useStore'
import { classifyQuery, shapeSystemPrompt, lengthHint } from '@/lib/flow/classifier'
import { runReplicate } from './replicate'
import { perfCaps } from '@/lib/system/performance'
import { createFlowRun, shapeConfigFrom } from '@/lib/flow/engine'
import { pruneContext, estimateTokens } from '@/lib/flow/pruner'
import { cacheGet, cacheSet } from '@/lib/flow/cache'
import { streamToCallback, ProviderError, type StreamToolCall } from '@/lib/providers/stream'
import { personaText, CODING_PERSONA_SLUG } from '@/lib/personas'
import { packText } from '@/lib/skills/packs'
import { freeCandidates, isFailoverWorthy, pickFreeModel, type FreeCandidate } from '@/lib/providers/free'
import { toolSpecs, executeTool, mcpContextBlock, type ToolContext } from './tools'
import { CODING_RULES } from '@/lib/ide/coding-rules'
import { isBuildIntent, pipelinePrompt } from '@/lib/design/directives'
import { shieldOutbound, recordScan } from '@/lib/privacy/shield'
import { providerById } from '@/lib/providers/registry'
import { streamDemo, DEMO_FOLLOW_UPS } from '@/lib/providers/demo'
import { webSearch } from '@/lib/search/web'
import { prepareRag } from '@/lib/rag/client'
import { auditCitations } from '@/lib/rag/audit'
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
  contextRefs?: { box: ContextBox; id: string; title: string }[]
  /** Coding mode: the open project (enables ide_* tools + project context). */
  project?: string
  /** Parallel agent: run this turn inside that agent's private working copy. */
  agent?: string
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
/** Where an attached reference came from: a local box, or `int:<id>` for a
 *  connected account read through the integration gateway. */
export type ContextBox = 'files' | 'drive' | 'mail' | 'calendar' | `int:${string}`

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

  /**
   * Free routing: the FreeRoute idea, without a provider pretending to exist.
   * When it is on and no model is chosen — or the chosen one cannot run — the
   * chat picks the best free model among the providers *you* configured, and a
   * refusal (rate limit, capacity, a model that moved) walks to the next one
   * instead of ending the turn.
   */
  const freeCandidatesNow = (): FreeCandidate[] => {
    if (!settings.freeRouting) return []
    const usable: Record<string, { name: string; ready: boolean }> = {}
    for (const id of settings.addedProviders ?? []) {
      const meta = providerById(id)
      if (!meta) continue
      const conf = settings.providers?.[id]
      usable[id] = { name: meta.name, ready: !meta.needsKey || !!conf?.apiKey }
    }
    return freeCandidates({
      added: settings.addedProviders ?? [],
      models: settings.providerModels ?? {},
      usable,
      hidden: settings.hiddenModels ?? [],
      overrides: settings.modelTiers,
    })
  }

  const chosen = (opts.modelOverride ?? settings.defaultModel ?? '').split(':')
  let providerId = chosen[0]
  let model = chosen[1] ?? ''
  let modelOverride = opts.modelOverride
  let providerMeta = providerById(providerId)

  const wantsFreeRouting = !!settings.freeRouting && (!opts.modelOverride || !providerId || !model)
  if (wantsFreeRouting) {
    const first = pickFreeModel(freeCandidatesNow())
    if (first) {
      modelOverride = first.ref
      providerId = first.provider
      model = first.model
      providerMeta = providerById(providerId)
      store.logConnection(`free://${first.provider}`, `Free routing · ${first.providerName}`, 0, 'ok')
    }
  }

  // A model was selected but is broken (unknown provider, or provider with no
  // model part): surface a clear, actionable error instead of pretending.
  // A completely empty defaultModel is the fresh/demo state — it falls
  // through to the fully-local demo pipeline below, by design.
  if (providerId && (!providerMeta || !model)) {
    const hint = settings.freeRouting
      ? 'Free routing is on but found no free model among your providers — add a provider with a free tier under Settings → Providers, or pick a model yourself.'
      : 'The selected model is unavailable. Open the model picker (top bar) and pick a fetched model, or reconnect the provider under Settings → Providers.'
    store.addMessage(chatId, {
      id: asstId, role: 'assistant', content: '', createdAt: Date.now(), mode,
      model: model || 'none', provider: providerMeta?.name ?? providerId,
      error: hint,
    })
    return
  }

  const asstMsg: ChatMessage = {
    id: asstId, role: 'assistant', content: '', createdAt: Date.now(),
    model, provider: providerMeta?.name ?? providerId, mode,
  }
  /** Free-routing hops already refused in this turn (bounded below). */
  const triedModels: string[] = modelOverride && settings.freeRouting ? [modelOverride] : []
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
  // Persona overlay: a vendored system prompt picked per chat (or as the
  // default in Settings), with the Codex astra prompt as the built-in voice
  // for coding sessions. It layers ON TOP of the base prompt, never hides it.
  {
    const slug = liveChat.personaId ?? settings.defaultPersonaId ?? (liveChat.kind === 'coding' ? CODING_PERSONA_SLUG : '')
    if (slug) {
      const pt = await personaText(slug)
      if (pt) system = `# Persona (follow its voice and rules where they do not conflict with the user)\n${pt.slice(0, 8000)}\n\n${system}`
    }
  }
  // Attached skill packs ride below the base prompt, capped per pack.
  if ((liveChat.skillPacks ?? []).length) {
    const texts = await Promise.all(liveChat.skillPacks!.slice(0, 3).map((id) => packText(id)))
    const joined = texts.filter(Boolean).join('\n\n---\n\n')
    if (joined) system = `${system}\n\n# Attached skill packs (apply their rules while answering)\n${joined}`
  }

  // ---- real web search sources, through the RAG pipeline ----
  // Privacy Shield: in Top Secret mode nothing reaches for the web — prepareRag
  // returns null there and the fallback search stays offline-first too.
  let sources: Source[] | undefined
  let ragSourceCount = 0
  if (mode.search) {
    useUI.setState({ island: { kind: 'search', sources: 0 }, flow: { chatId, stage: 'search', phase: 'thinking' } })
    // RAG first: retrieve, read the pages, rank by relevance and trust tier,
    // fuse into one capped numbered context. Deep research (quality mode)
    // plans up to three retrieval passes in parallel.
    const rag = await prepareRag(prompt, Boolean(mode.quality))
    if (rag) {
      ragSourceCount = rag.sources.length
      sources = rag.sources.map((s, i) => ({
        id: `rag-${chatId}-${i}`, title: s.title, url: s.url, domain: s.domain,
        snippet: (s.body ?? s.snippet ?? '').slice(0, 240),
        faviconHue: [...s.domain].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0),
      }))
      useUI.setState({ island: { kind: 'search', sources: sources!.length }, flow: { chatId, stage: 'read-sources', phase: 'thinking' } })
      store.logConnection('rag://pipeline', `grounded ${rag.stats.read}/${rag.stats.hits} pages · ~${rag.stats.estimatedTokens} tokens`, rag.stats.chars, 'ok')
      for (const s of sources!) {
        if (!store.citations.find((c) => c.url === s.url)) {
          useStore.setState((st: any) => ({
            citations: [...st.citations, { id: nanoid(8), title: s.title, url: s.url, domain: s.domain, savedAt: Date.now(), collection: 'Web search' }],
          }))
        }
      }
      const thinNote = rag.stats.thin
        ? ' Grounding is thin — few sources or none fully read — so say plainly where the answer rests on your own knowledge rather than the sources.'
        : ''
      system += `\n\n${rag.context}\n\nGrounding rules: answer the user's question completely — several sentences at minimum, never just a list of links. Cite inline with [n] markers, using ONLY numbers 1–${ragSourceCount} that appear above; prefer primary and trusted sources over web-tier ones, and say which tier a claim leans on when it matters. Where sources disagree, say so instead of blending them into one confident sentence. Attribute each factual claim to a source; never state as retrieved fact anything the sources do not contain.${thinNote}`
      useUI.setState({ island: { kind: 'streaming', tokens: 0 } })
    } else {
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
      ragSourceCount = sources.length
      const grounded = sources.map((s, i) =>
        `[${i + 1}] ${s.title} (${s.domain})\n    ${s.url}${s.snippet ? `\n    ${s.snippet}` : ''}`).join('\n')
      system += `\n\nWeb search results retrieved for this query:\n${grounded}\n\nYou MUST write a complete, helpful answer to the user's question — several sentences at minimum. Never respond with only links, titles, or a list of sources: the user cannot see the sources as an answer by themselves. Use the results above where they help and cite them inline with [n] markers, using only numbers 1–${ragSourceCount}; ignore results that are not useful. Where the results are thin, irrelevant, or missing, fall back to your own knowledge and still deliver a full answer. If live search was unavailable (offline placeholders), say briefly that live search could not be reached, then answer from your own knowledge anyway.`
      useUI.setState({ island: { kind: 'streaming', tokens: 0 } })
    }
  }

  // ---- the build pipeline ----
  // Any request that asks for something to be built runs the six directives, in
  // order, whether or not a project is open yet: research, ask what premium
  // means, design, prototype, sweep, and ship only on the user's signal.
  if (isBuildIntent(prompt)) system += `\n\n${pipelinePrompt()}`

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
  if (!opts.project && !opts.design) {
    // A research chat that turns into code work should move, not muddle along
    // without file tools. The switch is one client-side tool call — the user's
    // transcript comes with them.
    system += `\n\nIf the user asks for code rather than an explanation — build me an app, write a script, make a website, fix this project, refactor that — call the start_coding_mode tool FIRST with a short project name and one line for the user, then do the work inside the coding workspace it opens. Do not ask permission to switch, and do not try to write files from a research chat: the file tools only exist there. Explaining code, answering questions about code, and reviewing a snippet do NOT need the switch.`
  }
  if (opts.preamble) system += `\n\n${opts.preamble}`
  system += mcpContextBlock()
  system += `\n\nIf you need the user's preferences or decisions (for example what to fix or refine in a project), call the ask_user tool with 2-5 focused questions instead of guessing.`

  // ---- connector references attached from the chatbox picker ----
  if (opts.contextRefs?.length) {
    const parts: string[] = []
    for (const ref of opts.contextRefs.slice(0, 5)) {
      try {
        if (ref.box.startsWith('int:')) {
          // A connected account: the id belongs to the service, not to a local box.
          const { readIntegrationItem } = await import('@/lib/integrations/client')
          const item = await readIntegrationItem(ref.box.slice(4) as IntegrationId, ref.id)
          parts.push(`--- ${item.title} (${ref.box.slice(4)}) ---\n${String(item.text).slice(0, 8000)}`)
          continue
        }
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
  // Token accounting: some rounds report their counts, some do not. Totals are
  // summed per round, and `usageReported` records whether *any* round gave real
  // numbers — a mixed answer is honest about being partly estimated (in practice
  // a provider is consistent about this within a conversation).
  let usagePrompt = 0
  let usageCompletion = 0
  let usageReported = false
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
  // Chain of thought: whatever the provider exposes of its reasoning streams
  // into the message live (throttled), exactly like the answer text does.
  let thinkingText = ''
  let lastThinkFlush = 0
  const pushThinking = (t: string) => {
    thinkingText += t
    const now = Date.now()
    if (now - lastThinkFlush > 160) {
      lastThinkFlush = now
      useStore.getState().updateMessage(chatId, asstId, { thinking: thinkingText })
    }
  }
  const effortLevel = settings.effort ?? 'medium'

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
      const toolCtx: ToolContext = { chatId, asstId, project: opts.project, projectTree: opts.projectTree, agent: opts.agent }
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
          // Our own patience for this provider, in seconds, set by the user.
          timeoutMs: (settings.providerTimeouts?.[providerId] ?? 45) * 1000,
          system: shieldedSystem.text,
          messages: current,
          temperature: settings.modelDefaults[model]?.temperature ?? (mode.math ? 0.2 : 0.7),
          maxTokens: Math.min(settings.modelDefaults[model]?.maxTokens ?? lengthHint(cls).maxTokens, 4000),
          signal: controller.signal,
          tools: toolsAllowed ? specs : undefined,
          effort: effortLevel,
          thinking: effortLevel !== 'instant',
          onThinking: pushThinking,
        }, pushChunk)
        promptTokens = res.promptEstimate
        completionTokens += res.completionTokens
        usagePrompt += res.usage?.prompt ?? res.promptEstimate
        usageCompletion += res.usage?.completion ?? res.completionTokens
        if (res.usage?.reported) usageReported = true
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
      usagePrompt = promptTokens
      usageCompletion = completionTokens
      usageReported = false // the on-device demo never leaves the machine, so it is always an estimate
      run.endRaw()
      await drained
      run.finish()
    }
    useUI.setState({ flow: null })
  } catch (e: any) {
    run.abort()
    useUI.setState({ flow: null })
    // Free routing walks the list before it gives up: rate limits and capacity
    // errors are exactly what routing is for. A bad key or a malformed request
    // is not — those surface, so the real problem stays visible.
    const status = Number((e as any)?.status ?? (e as any)?.code ?? 0) || null
    const text = String(e?.message ?? e)
    if (settings.freeRouting && isFailoverWorthy(status, text) && triedModels.length < 3) {
      const next = pickFreeModel(freeCandidatesNow(), triedModels)
      if (next) {
        useStore.getState().updateMessage(chatId, asstId, { content: '', error: undefined, toolTrace: [] })
        triedModels.push(next.ref)
        store.logConnection(`free://${next.provider}`, `Free routing → ${next.providerName} (${next.why})`, 0, 'ok')
        void runChat({ ...opts, modelOverride: next.ref })
        return
      }
    }
    if (e.name === 'AbortError') {
      // Keep exactly what was rendered — the pacer's un-emitted queue is dropped.
      if (thinkingText) useStore.getState().updateMessage(chatId, asstId, { thinking: thinkingText })
      finish(chatId, asstId, '', { sources, usedDemo, promptTokens, completionTokens, pruned, aborted: true, usagePrompt, usageCompletion, usageReported, ragSourceCount })
      drainQueue(chatId)
      return
    }
    const msg = e instanceof ProviderError ? `${e.provider}: ${e.message}` : String(e?.message ?? e)
    useStore.getState().updateMessage(chatId, asstId, { error: msg })
    cleanup(chatId)
    return
  }

  if (flowEnabled && !cached) cacheSet(prompt + JSON.stringify(mode), completionText)
  if (thinkingText) useStore.getState().updateMessage(chatId, asstId, { thinking: thinkingText })
  finish(chatId, asstId, completionText, { sources, usedDemo, promptTokens, completionTokens, pruned, usagePrompt, usageCompletion, usageReported, ragSourceCount })
  drainQueue(chatId)
}

function finish(
  chatId: string, msgId: string, text: string,
  ctx: {
    sources?: Source[]; usedDemo: boolean; promptTokens: number; completionTokens: number; pruned: any
    aborted?: boolean; usagePrompt?: number; usageCompletion?: number; usageReported?: boolean
    ragSourceCount?: number
  },
) {
  // The citation audit: any [n] the model wrote outside the retrieved set is
  // invented by definition, and it is stripped before the answer is shown.
  if (text && ctx.ragSourceCount && ctx.ragSourceCount > 0) {
    const audit = auditCitations(text, ctx.ragSourceCount)
    if (audit.removed > 0) {
      text = audit.text + `\n\n> _${audit.removed} invented citation marker${audit.removed === 1 ? '' : 's'} removed — none of the ${ctx.ragSourceCount} retrieved sources carried ${audit.removed === 1 ? 'it' : 'them'}._`
    }
  }
  const store = useStore.getState()
  const settings = store.settings

  const savedTokens = Math.max(0, ctx.pruned.originalTokens - ctx.pruned.prunedTokens)
  const savedPct = ctx.pruned.originalTokens > 0
    ? Math.round((1 - ctx.pruned.prunedTokens / Math.max(1, ctx.pruned.originalTokens)) * 100)
    : 0
  if (settings.flowEnabled && savedTokens > 0) store.addTokensSaved(savedTokens)

  // Every response carries what it cost, whether or not the AIFlowEngine is on.
  const usage = {
    prompt: Math.max(0, Math.round(ctx.usagePrompt ?? ctx.promptTokens)),
    completion: Math.max(0, Math.round(ctx.usageCompletion ?? ctx.completionTokens)),
    total: 0,
    reported: !!ctx.usageReported,
  }
  usage.total = usage.prompt + usage.completion
  if (usage.total > 0) store.addTokensUsed(usage.total)

  const followUps = DEMO_FOLLOW_UPS
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  store.updateMessage(chatId, msgId, {
    usage,
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
