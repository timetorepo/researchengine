import { Hono } from 'hono'

export const ollamaRoutes = new Hono()

// Proxy Ollama model discovery so the frontend can hit a same-origin endpoint.
ollamaRoutes.get('/tags', async (c) => {
  const base = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/tags`)
    if (!res.ok) return c.json({ error: `Ollama responded ${res.status}` }, 502)
    return c.json(await res.json())
  } catch (e: any) {
    return c.json({ error: `Cannot reach Ollama at ${base}: ${e.message}` }, 502)
  }
})
