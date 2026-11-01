import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { maskSecrets } from './secrets'

export const chatRoutes = new Hono()

/* ---- Common wire format (frontend -> this proxy) ----
 * user/assistant messages: { role, content: string | Part[] , toolCalls? }
 *   Part: { type:'text', text } | { type:'image', dataUrl, mime? }
 * tool results: { role:'tool', toolCallId, name, content }
 * tools (OpenAI-style): [{ type:'function', function:{ name, description, parameters } }]
 */

type Part = { type: 'text'; text: string } | { type: 'image'; dataUrl: string; mime?: string }

const splitDataUrl = (dataUrl: string): { mime: string; data: string } => {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl ?? '')
  return m ? { mime: m[1], data: m[2] } : { mime: 'image/png', data: dataUrl ?? '' }
}

function toOpenAIMessages(system: string, messages: any[]): any[] {
  const out: any[] = system ? [{ role: 'system', content: system }] : []
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })
      continue
    }
    const msg: any = { role: m.role }
    if (Array.isArray(m.content)) {
      msg.content = m.content.map((p: Part) => p.type === 'image'
        ? { type: 'image_url', image_url: { url: p.dataUrl } }
        : { type: 'text', text: p.text })
    } else {
      msg.content = m.content ?? ''
    }
    if (m.toolCalls?.length) {
      msg.tool_calls = m.toolCalls.map((t: any) => {
        const out: any = { id: t.id, type: 'function', function: { name: t.name, arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments ?? {}) } }
        const sig = t.thoughtSignature ?? t.thought_signature ?? t.extraContent?.google?.thought_signature ?? t.extra_content?.google?.thought_signature
        if (sig) out.extra_content = { google: { thought_signature: sig } }
        return out
      })
    }
    out.push(msg)
  }
  return out
}

export function toGeminiContents(messages: any[]): any[] {
  const out: any[] = []
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'user', parts: [{ functionResponse: { name: m.name ?? 'tool', id: m.toolCallId, response: { result: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) } } }] })
      continue
    }
    const role = m.role === 'assistant' ? 'model' : 'user'
    const parts: any[] = []
    if (Array.isArray(m.content)) {
      for (const p of m.content as Part[]) {
        if (p.type === 'image') {
          const { mime, data } = splitDataUrl(p.dataUrl)
          parts.push({ inline_data: { mime_type: mime, data } })
        } else if (p.text) parts.push({ text: p.text })
      }
    } else if (typeof m.content === 'string' && m.content) {
      parts.push({ text: m.content })
    }
    if (m.toolCalls?.length) {
      for (const t of m.toolCalls) {
        let args: any = t.arguments
        if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = { input: args } } }
        const part: any = { functionCall: { name: t.name, args: args ?? {}, ...(t.id ? { id: t.id } : {}) } }
        const sig = t.thoughtSignature ?? t.thought_signature ?? t.extraContent?.google?.thought_signature ?? t.extra_content?.google?.thought_signature
        if (sig) part.thoughtSignature = sig
        parts.push(part)
      }
    }
    if (parts.length) out.push({ role, parts })
  }
  return out
}

function toAnthropicBody(system: string, messages: any[]): { system?: string; messages: any[] } {
  const out: any[] = []
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] })
      continue
    }
    const content: any[] = []
    if (Array.isArray(m.content)) {
      for (const p of m.content as Part[]) {
        if (p.type === 'image') {
          const { mime, data } = splitDataUrl(p.dataUrl)
          content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } })
        } else if (p.text) content.push({ type: 'text', text: p.text })
      }
    } else if (typeof m.content === 'string' && m.content) {
      content.push({ type: 'text', text: m.content })
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      for (const t of m.toolCalls) {
        let input: any = t.arguments
        if (typeof input === 'string') { try { input = JSON.parse(input) } catch { input = {} } }
        content.push({ type: 'tool_use', id: t.id, name: t.name, input: input ?? {} })
      }
    }
    if (content.length) out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content })
  }
  // Anthropic requires strictly alternating roles — merge consecutive same-role messages.
  const merged: any[] = []
  for (const m of out) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.content = [...last.content, ...m.content]
    else merged.push(m)
  }
  return { system: system || undefined, messages: merged.filter((m) => m.role === 'user' || merged.indexOf(m) > 0) }
}

/**
 * Same-origin streaming proxy. Browsers block CORS for several providers
 * (NVIDIA NIM, Anthropic, ...), so real chat streaming goes through this
 * route: the upstream SSE bytes are passed straight through, untouched.
 * Keys arrive per-request, are used in-memory only, never logged or stored.
 */
chatRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const kind: string = body.kind ?? 'openai'
  const model: string | undefined = body.model
  const key: string = body.key ?? body.apiKey ?? ''
  const base = String(body.base ?? body.baseUrl ?? '').replace(/\/+$/, '')
  const system: string = body.system ?? ''
  const messages: any[] = body.messages ?? []
  const maxTokens: number = body.maxTokens ?? 1024
  const temperature: number = body.temperature ?? 0.7
  const tools: any[] | null = Array.isArray(body.tools) && body.tools.length ? body.tools : null
  const effort: string = typeof body.effort === 'string' ? body.effort : ''
  const wantThinking: boolean = body.thinking === true
  // Map the app's six-step effort ladder onto each dialect's vocabulary.
  // Claude's own five levels, exactly as its effort doc names them.
  const anthropicEffort = ({ instant: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' } as Record<string, string>)[effort]
  const openaiEffort = ({ instant: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'xhigh' } as Record<string, string>)[effort]
  // Claude models that take the effort parameter, and those that take adaptive
  // thinking (older ones take a fixed budget instead).
  const CLAUDE_EFFORT = /claude-(opus-(4-[5-9]|5)|sonnet-(4-6|5)|haiku-5|fable|mythos)/i
  const CLAUDE_ADAPTIVE = /claude-(opus-(4-[6-9]|5)|sonnet-(4-6|5)|haiku-5|fable|mythos)/i

  if (!model) return c.json({ error: 'model is required' }, 400)
  if (!base) return c.json({ error: 'base is required' }, 400)

  let url: string
  let headers: Record<string, string>
  let payload: any
  // NVIDIA NIM rejects chat/completions from generic user-agents (OpenAI SDK,
  // browsers, node) with 403 "Authorization failed" while accepting its own
  // client UA — see HKUDS/Vibe-Trading#528. Speak the right dialect per host.
  const isNvidia = base.includes('api.nvidia.com') || kind === 'nim'
  const isOpenRouter = base.includes('openrouter.ai')
  const browserish = {
    'user-agent': isNvidia ? 'NVIDIA-NIM-Client/1.0'
      : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    accept: 'text/event-stream',
  }
  if (kind === 'anthropic') {
    url = `${base}/messages`
    headers = {
      ...browserish,
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }
    const conv = toAnthropicBody(system, messages)
    payload = { model, stream: true, max_tokens: maxTokens, temperature, system: conv.system ?? '', messages: conv.messages }
    if (anthropicEffort && CLAUDE_EFFORT.test(model)) payload.output_config = { effort: anthropicEffort }
    if (wantThinking) {
      // Newer Claude models hide thinking text unless asked: display 'summarized'
      // returns the summary (never the raw chain). Thinking tokens count toward
      // max_tokens, so leave room for them.
      payload.thinking = CLAUDE_ADAPTIVE.test(model)
        ? { type: 'adaptive', display: 'summarized' }
        : { type: 'enabled', budget_tokens: 2048 }
      payload.max_tokens = Math.max(maxTokens, 8192)
      payload.temperature = 1 // required while thinking is on
    }
    if (tools) {
      payload.tools = tools.map((t) => ({ name: t.function.name, description: t.function.description ?? '', input_schema: t.function.parameters ?? { type: 'object', properties: {} } }))
    }
  } else if (kind === 'gemini') {
    // Native Gemini streaming (SSE via alt=sse). Model ids carry no "models/" prefix here.
    url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
    headers = {
      ...browserish,
      'content-type': 'application/json',
      ...(key ? { 'x-goog-api-key': key } : {}),
    }
    payload = {
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature, maxOutputTokens: maxTokens,
        ...(wantThinking && /gemini-(2\.5|[3-9])/i.test(model) ? { thinkingConfig: { includeThoughts: true } } : {}),
      },
    }
    if (system) payload.systemInstruction = { parts: [{ text: system }] }
    if (tools) {
      payload.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description ?? '',
          parameters: t.function.parameters ?? { type: 'object', properties: {} },
        })),
      }]
    }
  } else {
    url = `${base}/chat/completions`
    headers = {
      ...browserish,
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(isNvidia && key ? { 'x-nvidia-api-key': key } : {}),
      ...(isOpenRouter ? { 'HTTP-Referer': 'https://researchengine.local', 'X-OpenRouter-Title': 'Research Engine' } : {}),
    }
    payload = {
      model, stream: true, max_tokens: maxTokens, temperature,
      messages: toOpenAIMessages(system, messages),
      // Ask for the token counts with the stream, so the UI can show what a
      // response actually cost instead of guessing from character counts.
      stream_options: { include_usage: true },
    }
    if (openaiEffort && /(^|\/)(o\d|gpt-[5-9]|codex)/i.test(model)) payload.reasoning_effort = openaiEffort
    if (tools) {
      payload.tools = tools
      payload.tool_choice = 'auto'
    }
    // NVIDIA NIM reasoning models (deepseek-v4, nemotron-thinking, qwq…)
    // hang indefinitely unless chat_template_kwargs enables thinking tokens
    // (opencode#24264). Send it for reasoning-ish NIM models; reasoning
    // deltas are streamed and ignored by the client parser.
    if (isNvidia && /deepseek|reasoning|qwq|thought|thinking|nemotron/i.test(model)) {
      payload.chat_template_kwargs = { enable_thinking: true, thinking: true }
    }
  }

  const send = (body: any) => fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: c.req.raw.signal, // client abort kills the upstream call
  })
  let upstream = await send(payload)
  // A few OpenAI-compatible servers reject unknown fields outright. Usage is a
  // nice-to-have, so drop it and ask again rather than failing the request.
  if (!upstream.ok && payload.stream_options && upstream.status >= 400 && upstream.status < 500) {
    const peek = await upstream.clone().text().catch(() => '')
    if (/stream_options|reasoning_effort|output_config|thinking|budget_tokens|unknown|unrecognized|additional propert|unsupported parameter/i.test(peek)) {
      delete payload.stream_options
      delete payload.reasoning_effort
      delete payload.output_config
      delete payload.thinking
      if (payload.generationConfig?.thinkingConfig) delete payload.generationConfig.thinkingConfig
      if (payload.thinking) payload.temperature = undefined
      upstream = await send(payload)
    }
  }

  // Anthropic: a model that refuses one dialect detail (an effort level it does
  // not offer, or adaptive thinking on an older model) gets the request again
  // with only that feature stepped down, so the answer itself still arrives.
  if (kind === 'anthropic') {
    for (let attempt = 0; attempt < 3 && !upstream.ok && upstream.status === 400; attempt++) {
      const peek = await upstream.clone().text().catch(() => '')
      if (/effort/i.test(peek) && payload.output_config) {
        delete payload.output_config
      } else if (/thinking|adaptive|budget|display/i.test(peek) && payload.thinking) {
        if (payload.thinking.type === 'adaptive' && attempt === 0) {
          payload.thinking = { type: 'enabled', budget_tokens: 2048 } // Opus 4.5 and Sonnet 4.5 family
        } else {
          delete payload.thinking
          payload.temperature = temperature
          payload.max_tokens = maxTokens
        }
      } else {
        break
      }
      upstream = await send(payload)
    }
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    let msg = `${upstream.status}`
    try {
      const j = JSON.parse(errText)
      msg = j?.error?.message ?? j?.detail ?? j?.message ?? msg
    } catch { /* keep status */ }
    if (upstream.status === 403 && isNvidia) {
      msg += ' — NVIDIA rejected this key for chat. GET /v1/models can still work when inference is not enabled. Check that your NVIDIA organization has Public API Endpoints access, accept the model terms on its catalog page, regenerate the nvapi key, and try a currently chat-capable model. Research Engine already sends NVIDIA-NIM-Client/1.0, Bearer, and X-NVIDIA-API-Key headers.'
    }
    // Never let an upstream error body leak a key-shaped string to the client.
    return c.json({ error: maskSecrets(msg) }, upstream.status as any)
  }

  // Pass the SSE stream straight through.
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  return streamSSE(c, async (stream) => {
    const reader = upstream.body!.getReader()
    const td = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        await stream.write(td.decode(value, { stream: true }))
      }
      // Flush a multi-byte character split across the final chunk.
      const tail = td.decode()
      if (tail) await stream.write(tail)
    } catch { /* client went away — upstream already aborted via signal */ }
  })
})
