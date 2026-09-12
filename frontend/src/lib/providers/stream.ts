// Browser-side streaming adapters. Keys are used in-memory only, never logged.
import { providerById } from './registry'

export interface StreamRequest {
  providerId: string
  model: string
  apiKey: string
  baseUrl?: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onFirstByte?: () => void
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

/** Stream a chat completion, calling onChunk per token batch. */
export async function streamToCallback(
  req: StreamRequest,
  onChunk: (text: string) => void,
): Promise<{ promptEstimate: number; completionTokens: number }> {
  const meta = providerById(req.providerId)
  if (!meta) throw new ProviderError(req.providerId, 'Unknown provider')
  const base = (req.baseUrl || meta.baseUrl).replace(/\/$/, '')
  let completionChars = 0

  if (meta.id === 'ollama') {
    // localhost — no CORS concerns, call directly
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST', signal: req.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: req.model, stream: true,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
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
        } catch { /* skip partial */ }
      }
    }
  } else {
    // Everything else streams through the same-origin backend proxy —
    // the upstream SSE bytes come back untouched, so the parsers below are
    // identical to the direct path, but CORS can never block a provider.
    const res = await fetch('/api/chat', {
      method: 'POST', signal: req.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: meta.kind, base, key: req.apiKey, model: req.model,
        system: req.system, messages: req.messages,
        maxTokens: req.maxTokens ?? 1024, temperature: req.temperature ?? 0.7,
      }),
    })
    if (!res.ok) throw new ProviderError(meta.name, await extractError(res))
    req.onFirstByte?.()
    if (meta.kind === 'anthropic') {
      await readSSE(res, () => false, (_evt, json) => {
        if (json.type === 'content_block_delta' && json.delta?.text) {
          completionChars += json.delta.text.length
          onChunk(json.delta.text)
        }
        return json.type === 'message_stop'
      })
    } else {
      await readSSE(res, (json) => {
        const delta = json.choices?.[0]?.delta?.content
        if (delta) { completionChars += delta.length; onChunk(delta) }
        return false
      })
    }
  }

  const sysTokens = Math.round(req.system.length / 4)
  const msgTokens = Math.round(req.messages.reduce((a, m) => a + m.content.length, 0) / 4)
  return { promptEstimate: sysTokens + msgTokens, completionTokens: Math.max(1, Math.round(completionChars / 4)) }
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
  const base = (baseUrl || meta.baseUrl).replace(/\/$/, '')
  const out = await proxyDiscover(meta.kind, base, apiKey)
  return (out.models ?? []).sort((a, b) => a.localeCompare(b))
}

/** Auto-detect Ollama models (via the proxy, like everything else). */
export async function ollamaTags(baseUrl: string): Promise<string[]> {
  return fetchProviderModels('ollama', '', baseUrl)
}
