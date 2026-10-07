/**
 * Model rankings, two ways.
 *
 * The world board pulls the live model list from OpenRouter's public API and
 * ranks it by value — how much context a dollar buys, with free models on top.
 * The local board ranks the providers and models this app actually talks to,
 * from the connection log: usage first, then efficiency (bytes per call and
 * how often the call succeeds). Both boards are computed here, pure and
 * offline-testable; only the fetch itself touches the network.
 */

export interface OpenRouterModelRaw {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
}

export interface ExternalRank {
  id: string
  name: string
  context: number
  promptPerM: number
  completionPerM: number
  free: boolean
  score: number
  why: string
}

const toNum = (s: string | undefined): number => {
  const n = Number(s ?? '0')
  return Number.isFinite(n) ? n : 0
}

/**
 * Rank the world's models by value. Free models lead (infinite value, ordered
 * by context); the rest order by context per blended dollar, which is the
 * number that decides what a research workload actually costs.
 */
export function rankExternalModels(models: OpenRouterModelRaw[]): ExternalRank[] {
  const rows: ExternalRank[] = models
    .filter((m) => m.id && typeof m.context_length === 'number' && m.context_length > 0)
    .map((m) => {
      const promptPerM = toNum(m.pricing?.prompt) * 1_000_000
      const completionPerM = toNum(m.pricing?.completion) * 1_000_000
      const free = promptPerM === 0 && completionPerM === 0
      const blended = (promptPerM + completionPerM * 2) / 3 // answers tend to be completion-heavy
      const score = free
        ? 1_000_000 + Math.min(m.context_length ?? 0, 1_000_000)
        : blended > 0 ? Math.round((m.context_length ?? 0) / blended) : 0
      return {
        id: m.id, name: m.name ?? m.id, context: m.context_length ?? 0,
        promptPerM, completionPerM, free, score,
        why: free
          ? `free · ${(m.context_length ?? 0).toLocaleString()} context`
          : blended > 0
            ? `${Math.round((m.context_length ?? 0) / blended).toLocaleString()} context per $1`
            : 'price not listed',
      }
    })
  return rows.sort((a, b) => b.score - a.score || b.context - a.context)
}

export async function fetchOpenRouterModels(limit = 240): Promise<ExternalRank[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: ctrl.signal })
    if (!res.ok) throw new Error(`OpenRouter answered ${res.status}`)
    const json: any = await res.json()
    const data: OpenRouterModelRaw[] = Array.isArray(json?.data) ? json.data : []
    return rankExternalModels(data).slice(0, limit)
  } finally {
    clearTimeout(timer)
  }
}

/* ---------------------------------------------------- your own models ----- */

export interface ConnectionEntryLike {
  t: number
  endpoint: string
  purpose: string
  bytes: number
  status?: 'ok' | 'error' | 'local'
}

export interface LocalRank {
  key: string
  label: string
  calls: number
  okRate: number
  bytesPerCall: number
  lastSeen: number
  score: number
  why: string
}

/**
 * The connection log writes purposes like "OpenAI · gpt-4o" or
 * "compare · model" against endpoints; group by provider · model where the
 * purpose names one, otherwise by endpoint, and rank usage × reliability.
 */
export function rankConnections(log: ConnectionEntryLike[]): LocalRank[] {
  const groups = new Map<string, { label: string; calls: number; ok: number; bytes: number; lastSeen: number }>()
  for (const e of log) {
    const m = e.purpose.match(/^([^·]+?)\s*·\s*(.+)$/)
    const isModel = m && !/^(web search|compare|rag grounding)/.test(e.purpose)
    const key = isModel ? `${m![1].trim()} · ${m![2].trim()}` : e.endpoint
    const label = isModel ? key : (e.endpoint.replace(/^[a-z+]+:\/\//i, '').split('/')[0] || e.endpoint)
    const g = groups.get(key) ?? { label, calls: 0, ok: 0, bytes: 0, lastSeen: 0 }
    g.calls++
    if (e.status !== 'error') g.ok++
    g.bytes += e.bytes
    g.lastSeen = Math.max(g.lastSeen, e.t)
    groups.set(key, g)
  }
  const now = Date.now()
  return [...groups.entries()]
    .map(([key, g]) => {
      const okRate = g.calls ? g.ok / g.calls : 0
      const fresh = Math.max(0, 1 - (now - g.lastSeen) / (7 * 86_400_000)) // decay over a week
      const score = Math.round((g.calls * (0.5 + okRate / 2)) * (0.4 + 0.6 * fresh) * 10) / 10
      return {
        key, label: g.label, calls: g.calls, okRate,
        bytesPerCall: g.calls ? Math.round(g.bytes / g.calls) : 0,
        lastSeen: g.lastSeen, score,
        why: `${g.calls} call${g.calls === 1 ? '' : 's'} · ${Math.round(okRate * 100)}% ok · ~${(g.bytes / g.calls / 1000).toFixed(1)} kB each`,
      }
    })
    .sort((a, b) => b.score - a.score)
}
