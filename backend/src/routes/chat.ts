import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export const chatRoutes = new Hono()

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

  if (!model) return c.json({ error: 'model is required' }, 400)
  if (!base) return c.json({ error: 'base is required' }, 400)

  let url: string
  let headers: Record<string, string>
  let payload: any
  // NVIDIA NIM rejects chat/completions from generic user-agents (OpenAI SDK,
  // browsers, node) with 403 "Authorization failed" while accepting its own
  // client UA — see HKUDS/Vibe-Trading#528. Speak the right dialect per host.
  const isNvidia = base.includes('api.nvidia.com') || kind === 'nim'
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
    payload = { model, stream: true, system, max_tokens: maxTokens, temperature, messages }
  } else {
    url = `${base}/chat/completions`
    headers = {
      ...browserish,
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(isNvidia && key ? { 'x-nvidia-api-key': key } : {}),
    }
    payload = {
      model, stream: true, max_tokens: maxTokens, temperature,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    }
    // NVIDIA NIM reasoning models (deepseek-v4, nemotron-thinking, qwq…)
    // hang indefinitely unless chat_template_kwargs enables thinking tokens
    // (opencode#24264). Send it for reasoning-ish NIM models; reasoning
    // deltas are streamed and ignored by the client parser.
    if (isNvidia && /deepseek|reasoning|qwq|thought|thinking|nemotron/i.test(model)) {
      payload.chat_template_kwargs = { enable_thinking: true, thinking: true }
    }
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: c.req.raw.signal, // client abort kills the upstream call
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    let msg = `${upstream.status}`
    try {
      const j = JSON.parse(errText)
      msg = j?.error?.message ?? j?.detail ?? j?.message ?? msg
    } catch { /* keep status */ }
    if (upstream.status === 403 && isNvidia) {
      msg += ' — NVIDIA rejected this key for chat. Fixes that usually work: regenerate the key at build.nvidia.com/settings/api-keys, accept the model\'s terms on its catalog page, or pick a different model.'
    }
    return c.json({ error: msg }, upstream.status as any)
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
    } catch { /* client went away — upstream already aborted via signal */ }
  })
})
