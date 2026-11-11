/**
 * The client half of the RAG pipeline: ask the local server to retrieve,
 * read, rank and fuse sources for a query, and hand the chat a grounded
 * context block instead of raw snippets.
 */

export interface RagSourceClient {
  n: number
  title: string
  url: string
  domain: string
  snippet: string
  tier: 'primary' | 'trusted' | 'web'
  body?: string
}

export interface RagOutcomeClient {
  sources: RagSourceClient[]
  context: string
  stats: {
    intent: string
    subqueries: string[]
    hits: number
    read: number
    chars: number
    estimatedTokens: number
    tookMs: number
    thin: boolean
  }
}

/**
 * Prepare grounding for a query. Returns null when the pipeline has nothing
 * honest to offer (no live search, empty ladder, server down) — callers then
 * fall back to the classic snippet grounding instead of pretending.
 */
export async function prepareRag(query: string, deep: boolean): Promise<RagOutcomeClient | null> {
  try {
    const { getPrivacyMode } = await import('@/lib/privacy/shield')
    // Top Secret never reaches for the web — not even through our own route.
    if (getPrivacyMode() === 'topsecret') return null
    const { useStore } = await import('@/stores/useStore')
    const settings = useStore.getState().settings
    const own = settings.searxngUrl && !/^https?:\/\/(localhost|127\.0\.0\.1):8080/.test(settings.searxngUrl) ? settings.searxngUrl : undefined
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), deep ? 16000 : 9000)
    const res = await fetch('/api/search/rag/prepare', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(settings.searchKeys && Object.keys(settings.searchKeys).length
          ? { 'x-re-search-keys': JSON.stringify(settings.searchKeys) }
          : {}),
      },
      body: JSON.stringify({ query, deep, maxSources: deep ? 6 : 5, ...(own ? { searxng: own } : {}) }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.ok || !Array.isArray(json.sources) || json.sources.length === 0) return null
    return json as RagOutcomeClient
  } catch {
    return null
  }
}
