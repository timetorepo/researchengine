// Workflow executor — real execution against real systems:
// AI nodes call generateText/webSearch, filesystem nodes hit the backend API,
// output nodes write to the notebook/articles store. Nothing is simulated;
// unconnected integrations fail with an actionable error instead.
import { nanoid } from 'nanoid'
import type { Workflow, WorkflowNode, WorkflowRunRecord, NodeRun } from './types'
import { nodeDef } from './library'
import { resolveVars, resolveConfig, resolveValue, toDisplay } from './vars'
import { generateText } from '@/lib/chat/generate'
import { webSearch } from '@/lib/search/web'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

export interface ExecEvents {
  onNodeStart: (nodeId: string) => void
  onNodeEnd: (nodeId: string, run: NodeRun) => void
  onEdge: (edgeId: string) => void
  onLog: (line: string) => void
  onDone: (rec: WorkflowRunRecord) => void
  onTokenUse?: (prompt: number, completion: number) => void
}

const lastRunAt = new Map<string, number>() // rate-limit memory

export class WorkflowExecutor {
  private outputs = new Map<string, any>()
  private record: WorkflowRunRecord
  private stopped = false
  private paused = false
  private gate: { promise: Promise<void>; release: () => void } | null = null
  private stepMode: boolean
  private stepRequested = false
  private stepRelease: (() => void) | null = null
  private tokensPrompt = 0
  private tokensCompletion = 0

  constructor(
    private wf: Workflow,
    private events: ExecEvents,
    opts: { mode?: 'run' | 'step'; input?: any } = {},
  ) {
    this.stepMode = opts.mode === 'step'
    this.record = {
      id: nanoid(8), workflowId: wf.id, workflowName: wf.name,
      startedAt: Date.now(), status: 'running', nodes: {}, order: [],
    }
    this.initialInput = opts.input ?? ''
  }
  private initialInput: any

  get runRecord() { return this.record }

  stop() { this.stopped = true; this.resume() }
  pause() { this.paused = true }
  resume() {
    this.paused = false
    this.gate?.release()
    this.gate = null
  }
  /** In step mode: advance one node. */
  stepOnce() {
    if (this.stepMode) { this.stepRequested = true; this.stepRelease?.() }
  }

  async start(): Promise<WorkflowRunRecord> {
    const t0 = performance.now()
    this.events.onLog(`Run started — "${this.wf.name}"`)
    try {
      const trigger = this.wf.nodes.find((n) => n.kind === 'trigger' && !n.disabled)
      if (!trigger) throw new Error('No enabled trigger node. Add a trigger first.')
      await this.execNode(trigger, this.initialInput)

      // frontier execution
      const queue: { nodeId: string; input: any }[] = []
      const enqueueFrom = (fromId: string, handle: string | undefined, output: any) => {
        const edges = this.wf.edges.filter((e) => e.from === fromId && (handle === undefined ? !e.fromHandle : e.fromHandle === handle))
        for (const e of edges) {
          this.events.onEdge(e.id)
          queue.push({ nodeId: e.to, input: output })
        }
      }
      enqueueFrom(trigger.id, undefined, this.outputs.get(trigger.id))

      while (queue.length > 0) {
        if (this.stopped) break
        const { nodeId, input } = queue.shift()!
        const node = this.wf.nodes.find((n) => n.id === nodeId)
        if (!node || node.disabled) continue
        await this.waitGate()
        if (this.stopped) break
        const { output, handle } = await this.execNode(node, input)
        enqueueFrom(node.id, handle, output)
      }

      this.record.status = this.stopped ? 'stopped' : 'ok'
      this.record.output = this.outputs.get(this.wf.nodes.filter((n) => n.type === 'return').map((n) => n.id).pop() ?? '')
        ?? [...this.outputs.values()].pop()
    } catch (err: any) {
      this.record.status = 'error'
      this.record.error = String(err?.message ?? err)
      this.events.onLog(`Run failed: ${this.record.error}`)
    }
    this.record.finishedAt = Date.now()
    this.record.tokensUsed = this.tokensPrompt + this.tokensCompletion
    this.events.onDone(this.record)
    return this.record
  }

  private async waitGate() {
    if (this.stepMode && !this.stepRequested) {
      await new Promise<void>((res) => { this.stepRelease = res })
      this.stepRelease = null
      this.stepRequested = false
    }
    if (this.paused) {
      this.record.status = 'paused'
      await new Promise<void>((res) => { this.gate = { promise: Promise.resolve(), release: res } })
      this.record.status = 'running'
    }
  }

  private ctxFor(input: any): Record<string, any> {
    const ctx: Record<string, any> = { input }
    for (const n of this.wf.nodes) {
      if (this.outputs.has(n.id)) ctx[n.label] = this.outputs.get(n.id)
    }
    return ctx
  }

  private async execNode(node: WorkflowNode, input: any): Promise<{ output: any; handle?: string }> {
    const def = nodeDef(node.type)
    const ctx = this.ctxFor(input)
    const run: NodeRun = { nodeId: node.id, status: 'running', startedAt: Date.now(), log: [] }
    this.record.nodes[node.id] = run
    this.record.order.push(node.id)
    this.events.onNodeStart(node.id)
    this.events.onLog(`▸ ${node.label || def?.name || node.type}`)

    const t0 = performance.now()
    try {
      const out = await this.runNode(node, input, ctx, run)
      run.status = 'ok'
      run.output = out.output
      this.outputs.set(node.id, out.output)
      this.events.onLog(`  ↳ ${truncate(toDisplay(out.output), 160)}`)
      return { output: out.output, handle: out.handle }
    } catch (err: any) {
      run.status = 'error'
      run.error = String(err?.message ?? err)
      this.events.onLog(`  ✕ ${run.error}`)
      throw err
    } finally {
      run.ms = Math.round(performance.now() - t0)
      this.record.nodes[node.id] = { ...run }
      this.events.onNodeEnd(node.id, run)
    }
  }

  private async runNode(node: WorkflowNode, input: any, ctx: Record<string, any>, run: NodeRun): Promise<{ output: any; handle?: string }> {
    const c = node.config
    const text = (v: any) => String(v ?? '')
    const asText = (v: any): string => (typeof v === 'string' ? v : toDisplay(v))

    switch (node.type) {
      /* ------------------------------ triggers ----------------------------- */
      case 'manual': case 'scheduled': case 'webhook': case 'fileWatcher':
      case 'notebookUpdate': case 'integrationEvent':
        return { output: input }

      /* --------------------------------- AI -------------------------------- */
      case 'chat': case 'groundedChat': case 'deepDive':
      case 'extract': case 'classify': case 'summarize': case 'translate': case 'rewrite': {
        return { output: await this.ai(node.type, c, ctx, run) }
      }
      case 'webSearch': {
        const q = resolveVars(c.query || '{{input}}', ctx)
        const outcome = await webSearch(q, 6)
        return { output: outcome.sources.map((s: any) => ({ title: s.title, url: s.url, snippet: s.snippet })) }
      }

      /* -------------------------------- skill ------------------------------ */
      case 'skill': {
        const skill = useStore.getState().skills.find((s) => s.id === c.skillId)
        if (!skill) throw new Error('No skill selected.')
        const prompt = resolveVars(skill.promptTemplate, { ...ctx, input: resolveVars(c.input ?? '{{input}}', ctx) })
        const res = await generateText({ system: 'You execute the given skill precisely. Output only the result.', prompt })
        this.tokensPrompt += res.promptTokens; this.tokensCompletion += res.completionTokens
        this.events.onTokenUse?.(res.promptTokens, res.completionTokens)
        return { output: res.text }
      }

      /* ----------------------------- integrations -------------------------- */
      case 'drive': case 'gmail': case 'github': case 'notion': {
        const key = { drive: 'drive', gmail: 'gmail', github: 'github', notion: 'notion' }[node.type as 'drive']!
        const st = useStore.getState().integrations[key]
        if (!st?.connected) throw new Error(`${nodeDef(node.type)!.name} is not connected. Connect it in Settings → Integrations.`)
        throw new Error(`${nodeDef(node.type)!.name} has no linked account token on this device yet. Connection state is stored, but OAuth token exchange ships in a later beta.`)
      }
      case 'fsRead': {
        const path = resolveConfig(c.path, ctx)
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`)
        if (!res.ok) throw new Error(`Could not read "${path}" (${res.status}). Files live in the Research Engine files folder.`)
        return { output: await res.text() }
      }
      case 'fsWrite': {
        const path = resolveConfig(c.path, ctx)
        const content = resolveVars(c.content ?? '{{input}}', ctx)
        const res = await fetch('/api/fs/write', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path, content }),
        })
        if (!res.ok) throw new Error(`Could not write "${path}" (${res.status}).`)
        return { output: `Wrote ${content.length} chars to ${path}` }
      }

      /* -------------------------------- logic ------------------------------ */
      case 'ifElse': {
        const value = asText(resolveValue(c.value, ctx))
        const compare = String(resolveConfig(c.compare ?? '', ctx))
        let pass = false
        switch (c.op) {
          case 'contains': pass = value.toLowerCase().includes(compare.toLowerCase()); break
          case 'notContains': pass = !value.toLowerCase().includes(compare.toLowerCase()); break
          case 'equals': pass = value === compare; break
          case 'gt': pass = value.length > Number(compare || 0); break
          case 'lt': pass = value.length < Number(compare || 0); break
          case 'truthy': pass = !!value && value !== 'false'; break
        }
        return { output: value, handle: pass ? 'true' : 'false' }
      }
      case 'switch': {
        const value = asText(resolveValue(c.value, ctx)).trim().toLowerCase()
        const cases = String(c.cases || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        const idx = cases.indexOf(value)
        return { output: value, handle: idx >= 0 ? `case:${idx}` : 'default' }
      }
      case 'loop': {
        const raw = resolveValue(c.list, ctx)
        const items = Array.isArray(raw) ? raw : text(raw).split('\n').map((s) => s.trim()).filter(Boolean)
        const max = Number(c.max || 10)
        return { output: items.slice(0, max) }
      }
      case 'filter': {
        const raw = resolveValue(c.list, ctx)
        const items = Array.isArray(raw) ? raw : text(raw).split('\n').filter(Boolean)
        const needle = String(resolveConfig(c.contains ?? '', ctx)).toLowerCase()
        return { output: items.filter((i) => JSON.stringify(i).toLowerCase().includes(needle)) }
      }
      case 'merge':
        return { output: input }
      case 'delay': {
        const ms = Math.max(0, Number(c.ms || 1000))
        await new Promise((r) => setTimeout(r, Math.min(ms, 10000)))
        return { output: input }
      }
      case 'rateLimit': {
        const key = `${this.wf.id}:${node.id}`
        const gap = Number(c.minGapMs || 60000)
        const last = lastRunAt.get(key) ?? 0
        if (Date.now() - last < gap) throw new Error(`Rate limited — last run was ${Math.round((Date.now() - last) / 1000)}s ago (gap ${Math.round(gap / 1000)}s).`)
        lastRunAt.set(key, Date.now())
        return { output: input }
      }

      /* ------------------------------ transforms --------------------------- */
      case 'map': {
        const items = toList(resolveValue(c.list, ctx))
        const tpl = c.template ?? '{{item}}'
        return { output: items.map((item) => resolveVars(tpl, { ...ctx, item })) }
      }
      case 'reduce': {
        const items = toList(resolveValue(c.list, ctx))
        return { output: items.map((i) => (typeof i === 'string' ? i : JSON.stringify(i))).join(c.join ?? '\n') }
      }
      case 'sort': {
        const items = toList(resolveValue(c.list, ctx)).slice()
        items.sort((a, b) => String(a).localeCompare(String(b)))
        if (c.dir === 'desc') items.reverse()
        return { output: items }
      }
      case 'jsonParse': {
        try { return { output: JSON.parse(text(resolveValue(c.text, ctx))) } }
        catch { throw new Error('Input is not valid JSON.') }
      }
      case 'template':
        return { output: resolveVars(c.template ?? '', ctx) }
      case 'regex': {
        const src = text(resolveConfig(c.text, ctx))
        const re = new RegExp(String(c.pattern || '.+'), 'g')
        return { output: src.match(re) ?? [] }
      }

      /* -------------------------------- outputs ---------------------------- */
      case 'toNotebook': case 'toCanvas': {
        const title = resolveVars(c.title || 'Workflow finding', ctx)
        const store = useStore.getState()
        useStore.setState((s: any) => ({
          knowledge: [{
            id: nanoid(8), title,
            insight: asText(input).slice(0, 4000),
            source: node.type === 'toCanvas' ? 'canvas' : resolveVars(c.source || 'workflow', ctx),
            tags: ['workflow', this.wf.name], confidence: 'medium', createdAt: Date.now(),
          }, ...s.knowledge],
        }))
        void store
        return { output: `Saved to ${node.type === 'toCanvas' ? 'Canvas' : 'notebook'}: ${title}` }
      }
      case 'toArticle': {
        const title = resolveVars(c.title || 'Draft from workflow', ctx)
        const body = asText(input)
        useStore.setState((s: any) => ({
          articles: [{
            id: nanoid(8), title,
            blocks: body.split(/\n\n+/).map((p) => ({ id: nanoid(6), type: 'paragraph' as const, content: p })),
            createdAt: Date.now(), updatedAt: Date.now(),
          }, ...s.articles],
        }))
        return { output: `Article draft created: ${title}` }
      }
      case 'notify': {
        const title = resolveVars(c.title || 'Workflow finished', ctx)
        const body = resolveVars(c.body ?? '{{input}}', ctx)
        useUI.getState().toast(title, truncate(body, 220), 'success')
        return { output: body }
      }
      case 'exportFile': {
        const filename = resolveConfig(c.filename || 'result.txt', ctx)
        const blob = new Blob([asText(input)], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = String(filename); a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30000)
        return { output: `Exported ${String(filename)}` }
      }
      case 'return':
        return { output: input }

      default:
        throw new Error(`Unknown node type "${node.type}".`)
    }
  }

  private async ai(type: string, c: Record<string, any>, ctx: Record<string, any>, run: NodeRun): Promise<string> {
    const sys = 'You are one step inside a Research Engine workflow. Follow the instruction exactly and return only the requested result.'
    let prompt = ''
    switch (type) {
      case 'chat':
        prompt = resolveVars(c.prompt || '{{input}}', ctx); break
      case 'groundedChat': {
        const q = resolveVars(c.prompt || '{{input}}', ctx)
        const outcome = await webSearch(q, 5)
        const grounded = outcome.sources.map((s: any, i: number) => `[${i + 1}] ${s.title} — ${s.snippet ?? ''}`).join('\n')
        prompt = `Question: ${q}\n\nWeb results:\n${grounded}\n\nAnswer grounded in the results; cite with [n].`
        break
      }
      case 'deepDive': {
        const topic = resolveVars(c.topic || '{{input}}', ctx)
        const first = await webSearch(topic, 5)
        const follow = await webSearch(`${topic} ${first.sources[0]?.title ?? 'details'}`, 5)
        const grounded = [...first.sources, ...follow.sources]
          .map((s: any, i: number) => `[${i + 1}] ${s.title} — ${s.snippet ?? ''}`).join('\n')
        prompt = `Deep research on: ${topic}\n\nFindings:\n${grounded}\n\nWrite a thorough synthesis with citations.`
        break
      }
      case 'extract':
        prompt = `Extract these fields from the text as JSON.\nFields: ${c.schema || 'name, date, claim'}\nText:\n${resolveVars(c.text ?? '{{input}}', ctx)}`; break
      case 'classify':
        prompt = `Classify the text into exactly one label from: ${c.labels || 'general'}.\nText:\n${resolveVars(c.text ?? '{{input}}', ctx)}\nReply with the label only.`; break
      case 'summarize':
        prompt = `Summarize (${c.style || 'concise'}):\n${resolveVars(c.text ?? '{{input}}', ctx)}`; break
      case 'translate':
        prompt = `Translate to ${c.target || 'English'}:\n${resolveVars(c.text ?? '{{input}}', ctx)}`; break
      case 'rewrite':
        prompt = `Rewrite in a ${c.tone || 'clear and direct'} tone:\n${resolveVars(c.text ?? '{{input}}', ctx)}`; break
    }
    const res = await generateText({ system: sys, prompt, modelOverride: c.model || undefined, maxTokens: 1200 })
    this.tokensPrompt += res.promptTokens; this.tokensCompletion += res.completionTokens
    this.events.onTokenUse?.(res.promptTokens, res.completionTokens)
    run.log!.push(res.usedDemo ? 'on-device demo model' : `${res.provider}/${res.model}`)
    return res.text
  }
}

function toList(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    if (Array.isArray((raw as any).sources)) return (raw as any).sources
    if (Array.isArray((raw as any).items)) return (raw as any).items
  }
  return String(raw ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
