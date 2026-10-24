/**
 * Jev, TypeSafe AI's decision model — the server half.
 *
 * Jev is not a chat model: POST /v1/systemone takes `state` plus `questions` and
 * returns typed answers with probabilities. It has no place in the chat
 * streaming path, which is why it has a route of its own rather than a branch in
 * the completion handler.
 *
 * The key is read at the moment of the call from the request body or the
 * environment, never written to disk by this route. Strix is the other tool in
 * this app that reaches the network by design, and like it, a run is only ever
 * started because the user pressed the button in front of them.
 */
import { Hono } from 'hono'
// The provider registry lives in the frontend, which the backend does not share.
// The hint is inlined rather than imported across that boundary.
const TYPESAFE_HINT = 'A decision model, not a chat model: POST /v1/systemone with state and typed questions'

export const jevRoutes = new Hono()

const BASE = 'https://api.typesafe.ai'
const TIMEOUT_MS = 20_000

/** Jev answers in 70 to 500 ms; twenty seconds is generous, not optimistic. */
async function call(path: string, key: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      signal: ac.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

/** GET /api/jev/models — what Jev will serve. */
jevRoutes.get('/models', async (c) => {
  const key = c.req.query('key') || process.env.TYPESAFE_API_KEY || ''
  if (!key) return c.json({ error: 'No TypeSafe key. Add one in Settings → Providers.' }, 401)
  const r = await call('/v1/models', key).catch((e) => null)
  if (!r) return c.json({ error: 'TypeSafe did not answer. Check the network and try again.' }, 502)
  if (!r.ok) return c.json({ error: `TypeSafe returned ${r.status}.`, status: r.status }, r.status === 401 ? 401 : 502)
  const payload = await r.json().catch(() => null)
  return c.json(payload ?? { models: [] })
})

/**
 * POST /api/jev/decide
 *
 * body: { key?, state, model, questions }
 *
 * Returns Jev's answers verbatim. This route does not threshold, re-rank or
 * second-guess them: the probability is the point, and where the line sits is
 * the caller's decision.
 */
jevRoutes.post('/decide', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const key = String(body?.key ?? '') || process.env.TYPESAFE_API_KEY || ''
  if (!key) return c.json({ error: 'No TypeSafe key. Add one in Settings → Providers.' }, 401)

  const state = String(body?.state ?? '')
  const model = String(body?.model ?? 'jev-latest')
  const questions = Array.isArray(body?.questions) ? body.questions : []

  if (!state.trim()) return c.json({ error: 'Give a state: the text or JSON to decide about.' }, 400)
  if (!questions.length) return c.json({ error: 'Give at least one question.' }, 400)
  if (questions.length > 64) return c.json({ error: 'Jev evaluates questions in parallel, but 64 is a sane ceiling for one request.' }, 400)

  // The same limits the client checks, checked again here, because a client-side
  // check is a courtesy and not a guarantee.
  for (const [i, q] of questions.entries()) {
    const type = String(q?.type ?? '')
    if (!['noul', 'choice', 'score'].includes(type)) {
      return c.json({ error: `Question ${i + 1}: type must be noul, choice or score.` }, 400)
    }
    if (!String(q?.name ?? '').trim()) return c.json({ error: `Question ${i + 1}: a question needs a name.` }, 400)
    if (type === 'choice') {
      const options = Array.isArray(q?.options) ? q.options.map(String) : []
      if (options.length < 2) return c.json({ error: `Question ${i + 1}: a choice needs at least two options.` }, 400)
      if (options.length > 255) return c.json({ error: `Question ${i + 1}: a choice allows up to 255 options.` }, 400)
      if (new Set(options).size !== options.length) return c.json({ error: `Question ${i + 1}: a choice cannot list the same option twice.` }, 400)
    }
    if (type === 'score') {
      const levels = Array.isArray(q?.levels) ? q.levels.map(String) : []
      if (levels.length < 2 || levels.length > 10) return c.json({ error: `Question ${i + 1}: a score takes 2 to 10 levels.` }, 400)
    }
  }

  const r = await call('/v1/systemone', key, {
    method: 'POST',
    body: JSON.stringify({ state, model, questions }),
  }).catch(() => null)
  if (!r) return c.json({ error: 'TypeSafe did not answer. Check the network and try again.' }, 502)

  const text = await r.text()
  if (!r.ok) {
    // Jev's own error codes, surfaced rather than flattened: 401 key, 422
    // validation, 429 rate limited, 529 overloaded. Knowing which one you got is
    // the difference between fixing a key and waiting a minute.
    const codes: Record<number, string> = {
      401: 'The key was rejected.',
      422: 'TypeSafe rejected the request as invalid.',
      429: 'Rate limited. Wait a moment and try again.',
      529: 'TypeSafe is overloaded. Try again shortly.',
    }
    return c.json({
      error: codes[r.status] ?? `TypeSafe returned ${r.status}.`,
      status: r.status,
      detail: text.slice(0, 2000),
    }, r.status === 401 ? 401 : r.status === 429 ? 429 : 502)
  }

  const decision = JSON.parse(text)
  return c.json(decision)
})

/** GET /api/jev — whether Jev is configured at all. */
jevRoutes.get('/', (c) => {
  return c.json({
    baseUrl: BASE,
    decisionEndpoint: '/v1/systemone',
    modelsEndpoint: '/v1/models',
    aliases: ['jev-latest', 'jev-preview'],
    configured: !!(process.env.TYPESAFE_API_KEY || c.req.query('key')),
    note: TYPESAFE_HINT,
  })
})
