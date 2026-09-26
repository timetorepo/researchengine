/**
 * FreeRoute — one route to the AI tiers that cost nothing.
 *
 * The idea (borrowed from OmniRoute, built for ResearchEngine): instead of
 * asking the user to know which provider is free today, ResearchEngine keeps a
 * catalog of routes that offer free inference, probes them, and exposes a
 * single OpenAI-compatible endpoint in front of all of them:
 *
 *   POST /api/freeroute/v1/chat/completions   ← any OpenAI client can point here
 *   GET  /api/freeroute/v1/models
 *
 * Requests walk the user's route order and *fail over*: a 429 from one free
 * tier becomes the next route's problem, so a rate limit is a detour rather
 * than an error. The routing decision (which route, why, what each one said) is
 * returned in `x-re-freeroute-*` headers so the app can show its work.
 *
 * Keys never leave the machine: the browser sends them in a request header for
 * the routes it has configured, and the server uses them for that request only.
 * They are never logged, never stored on the server.
 */
import { Hono } from 'hono'

export interface FreeRouteEntry {
  id: string
  name: string
  baseUrl: string
  /** Which configured provider supplies the key, if any. */
  keyFrom?: string
  /** No key at all — local runtimes and keyless gateways. */
  keyless?: boolean
  /** Model lists change; these are the known-free ids, used as hints. */
  seedModels: string[]
  /** What the free tier actually gets you. */
  note: string
  /** Only these ids are free on this route (others need paid credit). */
  freeOnly?: boolean
  docs?: string
}

export const FREE_ROUTES: FreeRouteEntry[] = [
  {
    id: 'zai-flash',
    name: 'Z.ai · GLM Flash',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    keyFrom: 'glm',
    seedModels: ['glm-4.7-flash', 'glm-4.5-flash', 'glm-4.6v-flash'],
    freeOnly: true,
    note: 'GLM Flash models are free on the API (text + vision). No card needed.',
    docs: 'https://docs.z.ai',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    seedModels: ['nemotron-3-ultra-free', 'big-pickle', 'mimo-v2.5-free', 'ling-3-flash-fin-free', 'nemotron-3.5-lightning-free'],
    freeOnly: true,
    note: 'OpenCode\'s gateway: free publicity models (Nemotron, MiMo, Big Pickle). Free ids rotate — run a probe.',
    docs: 'https://opencode.ai/docs/zen/',
  },
  {
    id: 'ollama-local',
    name: 'Ollama (on this machine)',
    baseUrl: 'http://localhost:11434/v1',
    keyless: true,
    seedModels: [],
    note: 'Free forever because it never leaves your computer. No key, no quota.',
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio (on this machine)',
    baseUrl: 'http://localhost:1234/v1',
    keyless: true,
    seedModels: [],
    note: 'The other local runtime — start LM Studio\'s server and pick a model.',
  },
  {
    id: 'groq-free',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyFrom: 'groq',
    seedModels: [],
    note: 'Generous free tier with very high tokens/second on open models.',
  },
  {
    id: 'gemini-free',
    name: 'Google AI Studio · Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyFrom: 'gemini',
    seedModels: [],
    note: 'Free tier from AI Studio. The OpenAI-compatible surface is used so the route stays one shape.',
  },
  {
    id: 'mistral-free',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyFrom: 'mistral',
    seedModels: [],
    note: 'Free experimentation tier on the La Plateforme key you already have.',
  },
  {
    id: 'openrouter-free',
    name: 'OpenRouter · :free models',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyFrom: 'openrouter',
    seedModels: [],
    freeOnly: true,
    note: 'Only the ":free" model ids are used, so the route can never spend money.',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    seedModels: ['llama-3.3-70b', 'qwen-3-32b'],
    note: 'Free developer tier; extremely fast inference.',
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    baseUrl: 'https://models.github.ai/inference',
    seedModels: [],
    note: 'Free with a GitHub token, rate-limited by your account tier.',
    docs: 'https://docs.github.com/en/github-models',
  },
]

/** Models on a route that must be filtered out (paid ids on a "free" route). */
function isFreeOn(route: FreeRouteEntry, model: string): boolean {
  if (!route.freeOnly) return true
  if (route.seedModels.length && route.seedModels.includes(model)) return true
  return /free|-flash|big-pickle/i.test(model)
}

export interface RouteKeys {
  /** providerId → plaintext key (from settings.providers). */
  [providerId: string]: string
}

export interface ProbeResult {
  id: string
  ok: boolean
  ms: number
  models: string[]
  /** Model ids we would actually use (free-filtered, seeds as fallback). */
  usable: string[]
  error?: string
}

async function probe(route: FreeRouteEntry, keys: RouteKeys, timeoutMs: number): Promise<ProbeResult> {
  const t0 = Date.now()
  const key = route.keyFrom ? keys[route.keyFrom] ?? keys[route.id] ?? '' : keys[route.id] ?? ''
  if (!route.keyless && !key) {
    return { id: route.id, ok: false, ms: 0, models: [], usable: [], error: route.keyFrom ? `Add a ${route.keyFrom} key` : 'Add a route key' }
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  if (key) headers.authorization = `Bearer ${key}`
  if (route.id === 'openrouter-free') {
    headers['HTTP-Referer'] = 'https://researchengine.local'
    headers['X-OpenRouter-Title'] = 'Research Engine'
  }
  try {
    const res = await fetch(`${route.baseUrl.replace(/\/+$/, '')}/models`, { headers, signal: AbortSignal.timeout(timeoutMs) })
    const ms = Date.now() - t0
    if (!res.ok) {
      let msg = `Responded ${res.status}`
      try {
        const j: any = await res.json()
        msg = j?.error?.message ?? j?.message ?? j?.detail ?? msg
      } catch { /* non-JSON */ }
      // A route we cannot list may still generate — keep the seed ids usable.
      return { id: route.id, ok: false, ms, models: [], usable: route.seedModels.filter((m) => isFreeOn(route, m)), error: msg }
    }
    const json: any = await res.json()
    const raw: string[] = (json.data ?? json.models ?? [])
      .map((m: any) => String(m?.id ?? m?.name ?? ''))
      .filter(Boolean)
    const usable = raw.filter((m) => isFreeOn(route, m))
    return { id: route.id, ok: true, ms, models: raw, usable: usable.length ? usable : route.seedModels }
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? `Timed out after ${Math.round(timeoutMs / 1000)}s`
      : (e?.message ?? 'Network error')
    return { id: route.id, ok: false, ms: Date.now() - t0, models: [], usable: route.seedModels.filter((m) => isFreeOn(route, m)), error: msg }
  }
}

/** Parse the keys header the app sends: { "groq": "…", "opencode-zen": "…" }. */
function keysFrom(c: any): RouteKeys {
  const raw = c.req.header('x-re-freeroute-keys') ?? ''
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Route ids are matched against a closed list, so a user-supplied string can
// never make us fetch an arbitrary URL.
const routeById = (id: string) => FREE_ROUTES.find((r) => r.id === id)

export const freerouteRoutes = new Hono()

freerouteRoutes.get('/freeroute/catalog', (c) => {
  const keys = keysFrom(c)
  return c.json({
    routes: FREE_ROUTES.map((r) => ({
      id: r.id,
      name: r.name,
      baseUrl: r.baseUrl,
      note: r.note,
      docs: r.docs ?? null,
      keyFrom: r.keyFrom ?? null,
      keyless: !!r.keyless,
      freeOnly: !!r.freeOnly,
      seedModels: r.seedModels,
      hasKey: r.keyless || !!(r.keyFrom ? keys[r.keyFrom] : keys[r.id]),
    })),
  })
})

freerouteRoutes.post('/freeroute/probe', async (c) => {
  const keys = keysFrom(c)
  const body: any = await c.req.json().catch(() => ({}))
  const order: string[] = Array.isArray(body?.order) ? body.order : FREE_ROUTES.map((r) => r.id)
  const wanted = order.map(routeById).filter(Boolean) as FreeRouteEntry[]
  const started = Date.now()
  const results = await Promise.all(wanted.map((r) => probe(r, keys, 7000)))
  const ok = results.filter((r) => r.ok).length
  return c.json({ results, ok, total: results.length, ms: Date.now() - started })
})

/**
 * The route decision, shared by the OpenAI-compatible endpoints: walk the
 * order, skipping routes without a key, and try each until one produces a
 * completion. Kept in one place so the streaming and non-streaming paths can
 * never disagree about ordering.
 */
async function tryRoutes(
  keys: RouteKeys,
  order: string[],
  payload: any,
  opts: { stream: boolean; signal?: AbortSignal },
): Promise<{ res: Response; route: FreeRouteEntry; attempts: { id: string; status: number; error?: string }[] } | { error: string; attempts: { id: string; status: number; error?: string }[] }> {
  const attempts: { id: string; status: number; error?: string }[] = []
  const model = String(payload?.model ?? '')
  const routes = order.map(routeById).filter(Boolean) as FreeRouteEntry[]
  for (const route of routes) {
    const key = route.keyFrom ? keys[route.keyFrom] ?? keys[route.id] ?? '' : keys[route.id] ?? ''
    if (!route.keyless && !key) {
      attempts.push({ id: route.id, status: 0, error: 'no key' })
      continue
    }
    // A model id requested for a *different* route is passed through only when
    // it looks free there; otherwise the route uses its first known-good id.
    const useModel = !model || (route.freeOnly && !isFreeOn(route, model))
      ? (route.seedModels[0] ?? model)
      : model
    if (!useModel) {
      attempts.push({ id: route.id, status: 0, error: 'no model id' })
      continue
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (key) headers.authorization = `Bearer ${key}`
    if (route.id === 'openrouter-free') {
      headers['HTTP-Referer'] = 'https://researchengine.local'
      headers['X-OpenRouter-Title'] = 'Research Engine'
    }
    try {
      const res = await fetch(`${route.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, model: useModel, stream: opts.stream }),
        signal: opts.signal ?? AbortSignal.timeout(120_000),
      })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const j: any = await res.json()
          msg = j?.error?.message ?? j?.message ?? msg
        } catch { /* non-JSON */ }
        attempts.push({ id: route.id, status: res.status, error: msg.slice(0, 300) })
        // 4xx that is not a rate limit is the caller's payload problem — try the
        // next route anyway (a different provider may accept it), but stop on
        // 401/403: the key is wrong and every route would say the same.
        if (res.status === 401 || res.status === 403) {
          return { error: `All routes refused the request — ${route.name}: ${msg.slice(0, 200)}`, attempts }
        }
        continue
      }
      attempts.push({ id: route.id, status: res.status })
      return { res, route, attempts }
    } catch (e: any) {
      attempts.push({ id: route.id, status: 0, error: (e?.message ?? 'network error').slice(0, 200) })
    }
  }
  return { error: 'Every free route is unavailable right now.', attempts }
}

const attemptHeaders = (attempts: { id: string; status: number; error?: string }[]) => ({
  'x-re-freeroute-attempts': attempts.map((a) => `${a.id}:${a.status || 'x'}${a.error ? `(${a.error.replace(/[^\w .:/-]/g, '').slice(0, 80)})` : ''}`).join(', '),
})

freerouteRoutes.post('/freeroute/v1/chat/completions', async (c) => {
  const keys = keysFrom(c)
  const body: any = await c.req.json().catch(() => null)
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: { message: 'messages[] is required', type: 'invalid_request_error' } }, 400)
  }
  const header = c.req.header('x-re-freeroute-order')
  const order = header ? header.split(',').map((s) => s.trim()).filter(Boolean) : FREE_ROUTES.map((r) => r.id)

  const out = await tryRoutes(keys, order, body, { stream: !!body.stream })
  if ('error' in out) {
    return c.json({ error: { message: out.error, type: 'freeroute_exhausted', attempts: out.attempts } }, 502, attemptHeaders(out.attempts))
  }
  const headers = {
    ...attemptHeaders(out.attempts),
    'x-re-freeroute-route': out.route.id,
    'x-re-freeroute-model': String(body.model ?? ''),
  }
  if (body.stream) {
    // Pass the SSE body straight through — no buffering, no re-writing.
    return new Response(out.res.body, {
      status: 200,
      headers: { 'content-type': out.res.headers.get('content-type') ?? 'text/event-stream', 'cache-control': 'no-cache', ...headers },
    })
  }
  const json = await out.res.json()
  return c.json(json, 200, headers)
})

freerouteRoutes.get('/freeroute/v1/models', async (c) => {
  const keys = keysFrom(c)
  const header = c.req.header('x-re-freeroute-order')
  const order = header ? header.split(',').map((s) => s.trim()).filter(Boolean) : FREE_ROUTES.map((r) => r.id)
  const routes = order.map(routeById).filter(Boolean) as FreeRouteEntry[]
  const results = await Promise.all(routes.map((r) => probe(r, keys, 5000)))
  const data = results.flatMap((r) =>
    (r.usable.length ? r.usable : r.models).map((id) => ({
      id: `${r.id}/${id}`,
      object: 'model',
      owned_by: r.id,
      // Extras the app uses; harmless to other OpenAI clients.
      free_route: r.id,
      model: id,
      healthy: r.ok,
    })),
  )
  return c.json({ object: 'list', data })
})

/** A single-route test — used by the settings page's per-route "Test" button. */
freerouteRoutes.post('/freeroute/test', async (c) => {
  const keys = keysFrom(c)
  const body: any = await c.req.json().catch(() => ({}))
  const route = routeById(String(body?.id ?? ''))
  if (!route) return c.json({ error: 'unknown route' }, 400)
  const result = await probe(route, keys, 7000)
  let generation: string | null = null
  if (result.ok && result.usable[0]) {
    const key = route.keyFrom ? keys[route.keyFrom] ?? keys[route.id] ?? '' : keys[route.id] ?? ''
    try {
      const res = await fetch(`${route.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: result.usable[0], messages: [{ role: 'user', content: 'Reply with the single word: ready' }], max_tokens: 12, stream: false }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) {
        const j: any = await res.json()
        generation = String(j?.choices?.[0]?.message?.content ?? '').trim().slice(0, 60) || null
      }
    } catch { /* listing worked, generation did not — reported as null */ }
  }
  return c.json({ ...result, generation: generation ? redact(generation) : null })
})

/** Keep any accidental secret-shaped text out of what the UI displays. */
function redact(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-…').replace(/gsk_[A-Za-z0-9_-]{12,}/g, 'gsk_…')
}
