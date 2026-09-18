import { Hono } from 'hono'
import { maskSecrets } from './secrets'

/**
 * Same-origin proxy for provider discovery. Browsers enforce CORS against
 * third-party APIs (NVIDIA NIM, Anthropic, ...), so model listing and
 * connection testing go through this server-side route instead.
 */
export const providerRoutes = new Hono()

const MODELS_TIMEOUT_MS = 8000
const TEST_TIMEOUT_MS = 6000

interface DiscoveryResult {
  models?: string[]
  ms: number
  error?: string
}

async function discover(kind: string, base: string, key: string, timeout: number): Promise<DiscoveryResult> {
  const t0 = Date.now()
  try {
    if (kind === 'ollama') {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(timeout) })
      if (!res.ok) return { error: `Ollama responded ${res.status}`, ms: Date.now() - t0 }
      const json: any = await res.json()
      return { models: (json.models ?? []).map((m: any) => String(m.name)), ms: Date.now() - t0 }
    }
    const headers: Record<string, string> = {
      // NVIDIA NIM UA-dialect: its gateways 403 generic user-agents.
      'user-agent': base.includes('api.nvidia.com') || kind === 'nim'
        ? 'NVIDIA-NIM-Client/1.0'
        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      accept: 'application/json',
    }
    if (kind === 'anthropic') {
      headers['x-api-key'] = key
      headers['anthropic-version'] = '2023-06-01'
    } else if (kind === 'gemini') {
      headers['x-goog-api-key'] = key
    } else if (key) {
      headers.authorization = `Bearer ${key}`
    }
    const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(timeout) })
    if (!res.ok) {
      let msg = `Provider responded ${res.status}`
      try {
        const j: any = await res.json()
        msg = j?.error?.message ?? j?.detail ?? j?.message ?? msg
      } catch { /* non-JSON error body */ }
      return { error: maskSecrets(msg), ms: Date.now() - t0 }
    }
    const json: any = await res.json()
    if (kind === 'gemini') {
      // Gemini shape: { models: [{ name: "models/gemini-2.0-flash", supportedGenerationMethods: [...] }] }
      // Keep only models that can generate text.
      const models = (json.models ?? [])
        .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => String(m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean)
      return { models, ms: Date.now() - t0 }
    }
    const models = (json.data ?? []).map((m: any) => String(m.id ?? m.name)).filter(Boolean)
    return { models, ms: Date.now() - t0 }
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? `Timed out after ${Math.round(timeout / 1000)}s`
      : (e?.message ?? 'Network error')
    return { error: msg, ms: Date.now() - t0 }
  }
}

function args(c: any) {
  const kind = c.req.query('kind') ?? 'openai'
  const base = (c.req.query('base') ?? '').replace(/\/+$/, '')
  const key = c.req.header('x-re-key') ?? ''
  return { kind, base, key }
}

providerRoutes.get('/providers/models', async (c) => {
  const { kind, base, key } = args(c)
  if (!base) return c.json({ error: 'base is required' }, 400)
  const out = await discover(kind, base, key, MODELS_TIMEOUT_MS)
  if (out.error) return c.json(out, 502)
  return c.json(out)
})

providerRoutes.get('/providers/test', async (c) => {
  const { kind, base, key } = args(c)
  if (!base) return c.json({ error: 'base is required' }, 400)
  const out = await discover(kind, base, key, TEST_TIMEOUT_MS)
  if (out.error) return c.json(out, 502)
  return c.json({ ms: out.ms })
})
