// Browser-side streaming adapters. Keys are used in-memory only, never logged.
import { providerById } from './registry'

export interface StreamRequest {
  providerId: string
  model: string
  apiKey: string
  baseUrl?: string
  system: string
  /** Common wire format: content may be a string or an array of parts
   *  ({type:'text'} / {type:'image', dataUrl}); tool rounds add
   *  {role:'tool', toolCallId, name, content} and assistant toolCalls. */
  messages: any[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onFirstByte?: () => void
  /** OpenAI-style tool specs; provider dialects are translated by the proxy. */
  tools?: any[]
}

/**
 * What a response actually cost.
 *
 * `reported` is the important field: when a provider tells us the counts we use
 * them verbatim, and when it does not we say so — the UI shows a `≈` then, so a
 * guess is never presented as a measurement.
 */
export interface TokenUsage {
  prompt: number
  completion: number
  total: number
  reported: boolean
}

export interface StreamToolCall {
  id: string
  name: string
  arguments: string
  /** Gemini 2.5/3 encrypted reasoning signature; must round-trip verbatim. */
  thoughtSignature?: string
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

async function readSSE(res: Response, onData: (json: any) => boolean, onEvent?: (evt: string, json: any) => boolean) {
  const reader = res.body!.getReader()
  const td = new TextDecoder()
  let buf = ''
  let evtName = 'message'
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += td.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (line.startsWith('event:')) { evtName = line.slice(6).trim(); continue }
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (onEvent && onEvent(evtName, json)) return
        else if (!onEvent && onData(json)) return
      } catch { /* partial line */ }
    }
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const e = body?.error
    return (typeof e === 'string' ? e : e?.message) || body?.detail || body?.message || `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

/** Stream a chat completion, calling onChunk per token batch.
 *  Returns token estimates PLUS any tool calls the model requested. */
export async function streamToCallback(
  req: StreamRequest,
  onChunk: (text: string) => void,
): Promise<{ promptEstimate: number; completionTokens: number; toolCalls: StreamToolCall[]; usage: TokenUsage }> {
  const meta = providerById(req.providerId)
  if (!meta) throw new ProviderError(req.providerId, 'Unknown provider')
  const base = (req.baseUrl || meta.baseUrl).replace(/\/$/, '')
  let completionChars = 0
  const toolCalls: StreamToolCall[] = []
  // Filled in by whichever dialect the provider speaks; null means "it did not
  // tell us", and the caller falls back to an estimate.
  let reported: { prompt: number; completion: number } | null = null
  const takeOpenAIUsage = (u: any) => {
    if (!u) return
    const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0)
    const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0)
    if (prompt || completion) reported = { prompt, completion }
  }

  if (meta.id === 'ollama') {
    // localhost — no CORS concerns, call directly
    const plain = req.messages.map((m) => {
      const msg: any = { role: m.role, content: typeof m.content === 'string' ? m.content : (m.content ?? []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') }
      if (Array.isArray(m.content)) {
        const imgs = m.content.filter((p: any) => p.type === 'image').map((p: any) => String(p.dataUrl ?? '').split(',')[1] ?? '')
        if (imgs.length && imgs[0]) msg.images = imgs
      }
      return msg
    })
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST', signal: req.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: req.model, stream: true,
        messages: [{ role: 'system', content: req.system }, ...plain],
        options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens ?? 1024 },
      }),
    })
    if (!res.ok) throw new ProviderError('Ollama', await extractError(res))
    req.onFirstByte?.()
    const reader = res.body!.getReader()
    const td = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += td.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          const t = json.message?.content
          if (t) { completionChars += t.length; onChunk(t) }
          // Ollama reports its own counts on the last frame.
          if (json.done && (json.prompt_eval_count || json.eval_count)) {
            reported = { prompt: Number(json.prompt_eval_count ?? 0), completion: Number(json.eval_count ?? 0) }
          }
        } catch { /* skip partial */ }
      }
    }
  } else {
    // Watchdog: providers can accept a request and then send nothing for a
    // long time (NIM serverless cold starts, hanging reasoning models).
    // Fail with a clear message instead of spinning "thinking" forever.
    const ctrl = new AbortController()
    const onOuter = () => ctrl.abort()
    req.signal?.addEventListener('abort', onOuter)
    let gotChunk = false
    const timer = setTimeout(() => { if (!gotChunk && !req.signal?.aborted) ctrl.abort() }, 45000)
    const chunk = (t: string) => {
      if (!gotChunk && t) { gotChunk = true; clearTimeout(timer) }
      onChunk(t)
    }
    try {
      // FreeRoute is its own hop: the request goes to our own backend, which
      // walks the free tiers and fails over for us. Same OpenAI dialect, so the
      // parsing below is untouched.
      const frHeaders = meta.id === 'freeroute' ? await freeRouteHeaders() : {}
      const res = meta.id === 'freeroute'
        ? await fetch('/api/freeroute/v1/chat/completions', {
            method: 'POST', signal: ctrl.signal,
            headers: { 'content-type': 'application/json', ...frHeaders },
            body: JSON.stringify({
              model: req.model,
              messages: [{ role: 'system', content: req.system }, ...req.messages],
              stream: true,
              max_tokens: req.maxTokens ?? 1024,
              temperature: req.temperature ?? 0.7,
              stream_options: { include_usage: true },
              ...(req.tools?.length ? { tools: req.tools } : {}),
            }),
          })
        : await fetch('/api/chat', {
            method: 'POST', signal: ctrl.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              kind: meta.kind, base, key: req.apiKey, model: req.model,
              system: req.system, messages: req.messages,
              maxTokens: req.maxTokens ?? 1024, temperature: req.temperature ?? 0.7,
              tools: req.tools?.length ? req.tools : undefined,
            }),
          })
      if (!res.ok) throw new ProviderError(meta.name, await extractError(res))
      req.onFirstByte?.()
      if (meta.kind === 'anthropic') {
        let toolAcc: { id: string; name: string; json: string } | null = null
        let anthropicIn = 0
        let anthropicOut = 0
        await readSSE(res, () => false, (_evt, json) => {
          if (json.type === 'message_start' && json.message?.usage) {
            // input tokens are only known up front; output arrives at the end
            anthropicIn = Number(json.message.usage.input_tokens ?? 0)
            anthropicOut = Math.max(anthropicOut, Number(json.message.usage.output_tokens ?? 0))
            if (anthropicIn) reported = { prompt: anthropicIn, completion: anthropicOut }
          } else if (json.type === 'message_delta' && json.usage) {
            anthropicOut = Number(json.usage.output_tokens ?? anthropicOut)
            if (anthropicIn) reported = { prompt: anthropicIn, completion: anthropicOut }
          }
          if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
            toolAcc = { id: json.content_block.id, name: json.content_block.name, json: '' }
          } else if (json.type === 'content_block_delta' && json.delta?.type === 'input_json_delta' && toolAcc) {
            toolAcc.json += json.delta.partial_json ?? ''
          } else if (json.type === 'content_block_stop' && toolAcc) {
            toolCalls.push({ id: toolAcc.id, name: toolAcc.name, arguments: toolAcc.json || '{}' })
            toolAcc = null
          } else if (json.type === 'content_block_delta' && json.delta?.text) {
            completionChars += json.delta.text.length
            chunk(json.delta.text)
          }
          return json.type === 'message_stop'
        })
      } else if (meta.kind === 'gemini') {
        // Gemini SSE: each data frame carries candidates[0].content.parts[].text.
        let n = 0
        await readSSE(res, (json) => {
          const um = json.usageMetadata
          if (um) {
            const prompt = Number(um.promptTokenCount ?? 0)
            const completion = Number(um.candidatesTokenCount ?? um.totalTokenCount ?? 0)
            if (prompt || completion) reported = { prompt, completion }
          }
          const parts = json.candidates?.[0]?.content?.parts
          if (Array.isArray(parts)) {
            for (const p of parts) {
              if (p.functionCall?.name) {
                const thoughtSignature = p.thoughtSignature ?? p.thought_signature
                toolCalls.push({ id: `gmc_${++n}`, name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}), thoughtSignature })
              } else if (typeof p?.text === 'string' && p.text) {
                completionChars += p.text.length
                chunk(p.text)
              }
            }
          }
          return false
        })
      } else {
        // OpenAI-dialect tool_calls arrive as incremental chunks keyed by index.
        const acc = new Map<number, { id: string; name: string; args: string; thoughtSignature?: string }>()
        await readSSE(res, (json) => {
          // With stream_options.include_usage the last frame carries the counts.
          takeOpenAIUsage(json.usage)
          const delta = json.choices?.[0]?.delta
          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const i = tc.index ?? 0
              const cur = acc.get(i) ?? { id: '', name: '', args: '' }
              if (tc.id) cur.id = tc.id
              if (tc.function?.name) cur.name = tc.function.name
              if (tc.function?.arguments) cur.args += tc.function.arguments
              const sig = tc.thoughtSignature ?? tc.thought_signature ?? tc.extra_content?.google?.thought_signature ?? tc.extraContent?.google?.thought_signature ?? tc.provider_specific_fields?.thought_signature
              if (sig) cur.thoughtSignature = sig
              acc.set(i, cur)
            }
          }
          // NIM sends many chunks with delta.content null (and reasoning
          // models emit reasoning_content separately) — only count real text.
          const text = delta?.content
          if (text) { completionChars += text.length; chunk(text) }
          return false
        })
        for (const cur of acc.values()) {
          if (cur.name) toolCalls.push({ id: cur.id || `tc_${Math.random().toString(36).slice(2, 8)}`, name: cur.name, arguments: cur.args || '{}', thoughtSignature: cur.thoughtSignature })
        }
      }
    } catch (e: any) {
      if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!gotChunk && (ctrl.signal.aborted || e?.name === 'AbortError' || e?.name === 'TimeoutError')) {
        throw new ProviderError(
          meta.name,
          'The provider accepted the request but sent no tokens for 45s. Serverless models cold-start slowly — try again, or pick a smaller/warm model.',
        )
      }
      throw e
    } finally {
      clearTimeout(timer)
      req.signal?.removeEventListener('abort', onOuter)
    }
  }

  const sysTokens = Math.round(req.system.length / 4)
  const msgTokens = Math.round(req.messages.reduce((a, m) => a + (
    typeof m.content === 'string' ? m.content.length
      : Array.isArray(m.content) ? m.content.reduce((x: number, p: any) => x + (p.type === 'text' ? (p.text?.length ?? 0) : 2000), 0)
      : 0
  ), 0) / 4)
  const promptEstimate = sysTokens + msgTokens
  const completionEstimate = Math.max(1, Math.round(completionChars / 4))
  const usage: TokenUsage = reported
    ? { prompt: reported.prompt, completion: reported.completion, total: reported.prompt + reported.completion, reported: true }
    : { prompt: promptEstimate, completion: completionEstimate, total: promptEstimate + completionEstimate, reported: false }
  return {
    promptEstimate: usage.reported ? usage.prompt : promptEstimate,
    completionTokens: usage.reported ? usage.completion : completionEstimate,
    toolCalls,
    usage,
  }
}

/**
 * FreeRoute sends the keys it needs for the routes the user configured, and the
 * order to try them in. Nothing is stored server-side — they live in the vault
 * on this machine and travel with the request only.
 */
export async function freeRouteHeaders(): Promise<Record<string, string>> {
  try {
    // Imported on demand: this module is imported by the store's own callers,
    // so a top-level import of the store here would close a cycle.
    const { useStore } = await import('@/stores/useStore')
    const fr = (useStore.getState().settings as any)?.freeRoute
    const keys: Record<string, string> = {}
    const providers = useStore.getState().settings.providers
    for (const [id, conf] of Object.entries(providers)) {
      if (conf?.apiKey) keys[id] = conf.apiKey
    }
    for (const [id, key] of Object.entries(fr?.keys ?? {})) {
      if (key) keys[id] = String(key)
    }
    return {
      'x-re-freeroute-keys': JSON.stringify(keys),
      ...(Array.isArray(fr?.order) && fr.order.length ? { 'x-re-freeroute-order': fr.order.join(',') } : {}),
    }
  } catch {
    return {}
  }
}

/**
 * Discovery goes through the same-origin backend proxy: third-party APIs
 * (NVIDIA NIM, Anthropic, ...) block browser CORS, and the proxy also gives
 * us one fast, timeout-bounded hop for every provider.
 */
async function proxyDiscover(kind: string, base: string, key: string): Promise<{ models?: string[]; ms: number; error?: string }> {
  const res = await fetch(
    `/api/providers/models?kind=${encodeURIComponent(kind)}&base=${encodeURIComponent(base)}`,
    { headers: key ? { 'x-re-key': key } : {} },
  )
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? `Discovery failed (${res.status})`)
  return json
}

/** Test a provider connection; returns latency in ms or throws the real error. */
export async function testConnection(providerId: string, apiKey: string, baseUrl?: string): Promise<number> {
  const meta = providerById(providerId)
  if (!meta) throw new Error('Unknown provider')
  const base = (baseUrl || meta.baseUrl).replace(/\/$/, '')
  const out = await proxyDiscover(meta.kind, base, apiKey)
  return out.ms
}

/** Live-fetch the model list for a provider (never hardcoded). */
export async function fetchProviderModels(providerId: string, apiKey: string, baseUrl?: string): Promise<string[]> {
  const meta = providerById(providerId)
  if (!meta) throw new Error('Unknown provider')
  if (meta.id === 'freeroute') {
    // The FreeRoute model list is the healthy free models across every route.
    const res = await fetch('/api/freeroute/v1/models', { headers: await freeRouteHeaders() })
    if (!res.ok) throw new Error(`FreeRoute discovery failed (${res.status})`)
    const json: any = await res.json()
    return (json.data ?? [])
      .filter((m: any) => m.healthy !== false)
      .map((m: any) => String(m.id))
      .sort((a: string, b: string) => a.localeCompare(b))
  }
  const base = (baseUrl || meta.baseUrl).replace(/\/$/, '')
  const out = await proxyDiscover(meta.kind, base, apiKey)
  return (out.models ?? []).sort((a, b) => a.localeCompare(b))
}

/** Auto-detect Ollama models (via the proxy, like everything else). */
export async function ollamaTags(baseUrl: string): Promise<string[]> {
  return fetchProviderModels('ollama', '', baseUrl)
}
