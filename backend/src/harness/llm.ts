/**
 * The model adapter for the harness: one OpenAI-compatible chat call, with
 * tools, returning the assistant text and any tool calls.
 *
 * The key arrives with each call and is used only for that request. It is never
 * stored, logged or written into a session. Errors are reported without echoing
 * the key or the response body in full.
 */
import { definePlugin } from './kernel'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}

export interface ModelTarget {
  /** Base URL of an OpenAI-compatible API, e.g. https://api.openai.com/v1 */
  base: string
  /** API key for this call only. May be empty for local servers. */
  key: string
  model: string
}

export interface CompletionToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface Completion {
  content: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  finish: string
}

export interface LlmService {
  complete(target: ModelTarget, messages: ChatMessage[], tools: CompletionToolSpec[], signal?: AbortSignal): Promise<Completion>
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Build the adapter. `fetchImpl` is injectable so tests never touch the network. */
export function createLlm(fetchImpl: FetchLike = (u, i) => fetch(u, i)): LlmService {
  return {
    async complete(target, messages, tools, signal) {
      const base = target.base.replace(/\/+$/, '')
      if (!/^https?:\/\//.test(base)) throw new Error('the model base URL must start with http:// or https://')
      if (!target.model) throw new Error('a model name is required')
      const body: Record<string, unknown> = { model: target.model, messages, temperature: 0.2 }
      if (tools.length) {
        body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
        body.tool_choice = 'auto'
      }
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (target.key) headers.authorization = `Bearer ${target.key}`
      const res = await fetchImpl(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal })
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).slice(0, 300).replaceAll(target.key || '\u0000', '[key]')
        throw new Error(`the model returned ${res.status}${text ? `: ${text}` : ''}`)
      }
      const data = (await res.json()) as any
      const choice = data?.choices?.[0]
      if (!choice?.message) throw new Error('the model returned no message')
      const toolCalls = (choice.message.tool_calls ?? []).map((t: any) => ({
        id: String(t.id ?? ''),
        name: String(t.function?.name ?? ''),
        arguments: typeof t.function?.arguments === 'string' ? t.function.arguments : JSON.stringify(t.function?.arguments ?? {}),
      }))
      return {
        content: typeof choice.message.content === 'string' ? choice.message.content : '',
        toolCalls,
        finish: String(choice.finish_reason ?? ''),
      }
    },
  }
}

/** The `llm` service plugin. `fetchImpl` lets a boot choose a different transport. */
export function llmPlugin(fetchImpl?: FetchLike) {
  return definePlugin({
    name: 'llm',
    apply(ctx) {
      ctx.provide<LlmService>('llm', createLlm(fetchImpl))
    },
  })
}
