import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export const chatRoutes = new Hono()

// Optional server-side proxy. BYOK by default the browser calls providers
// directly; this route exists for deployments that want a single egress point.
// Keys are used in-memory only and are never logged or stored.
chatRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { provider = 'openai', model, apiKey, baseUrl, system = '', messages = [], maxTokens = 1024, temperature = 0.7 } = body
  if (!model) return c.json({ error: 'model is required' }, 400)

  const bases: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    mistral: 'https://api.mistral.ai/v1',
  }
  const base = (baseUrl || bases[provider] || '').replace(/\/$/, '')
  if (!base) return c.json({ error: `No base URL for provider ${provider}` }, 400)

  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model, stream: true, max_tokens: maxTokens, temperature,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    return c.json({ error: `${upstream.status}: ${errText.slice(0, 400)}` }, upstream.status as any)
  }

  // Pass the SSE stream straight through.
  return streamSSE(c, async (stream) => {
    const reader = upstream.body!.getReader()
    const td = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await stream.write(td.decode(value, { stream: true }))
    }
  })
})
