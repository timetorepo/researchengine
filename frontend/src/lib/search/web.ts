// Real web search with a resilient source ladder:
//   1. Local backend (/api/search) — runs the engine ladder itself: your engine
//      if you picked one, then keyless SearXNG (yours or a public instance),
//      then keyless DuckDuckGo, and only then labelled placeholders. Keys you
//      typed in Settings → Search ride along with the request, so search works
//      without anyone configuring the server.
//   2. Wikipedia search, called directly from the browser — keyless and
//      CORS-open, so Search works even where the backend has no internet.
//   3. Clearly-labeled offline placeholder sources.
// Every connection is recorded in the Privacy Shield log.
import type { Source } from '@/types'
import { demoSources } from '@/lib/providers/demo'

export interface SearchOutcome {
  sources: Source[]
  backend: string // which engine actually produced the results
  live: boolean   // false → offline placeholder sources
}

function hue(domain: string): number {
  let h = 0
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) % 360
  return h
}

function safeDomain(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

export async function webSearch(query: string, count = 6): Promise<SearchOutcome> {
  // ---- 1) local backend engines ----
  let demoFromBackend: Source[] | null = null
  try {
    const { getPrivacyMode } = await import('@/lib/privacy/shield')
    // The store is imported on demand: this module is pulled in by the chat
    // pipeline, and a top-level store import here would close a cycle.
    const { useStore } = await import('@/stores/useStore')
    const settings = useStore.getState().settings
    const offline = getPrivacyMode() === 'topsecret' ? '&offline=1' : ''
    const backend = settings.searchBackend && settings.searchBackend !== 'demo' ? settings.searchBackend : 'auto'
    const own = settings.searxngUrl && !/^https?:\/\/(localhost|127\.0\.0\.1):8080/.test(settings.searxngUrl)
      ? `&searxng=${encodeURIComponent(settings.searxngUrl)}`
      : ''
    const patience = Math.max(3, Number(settings.providerTimeouts?.search ?? 20)) * 1000
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), patience)
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&backend=${encodeURIComponent(backend)}${own}${offline}`,
      {
        signal: ctrl.signal,
        // Keys typed in the UI travel with the request; the server keeps none.
        headers: settings.searchKeys && Object.keys(settings.searchKeys).length
          ? { 'x-re-search-keys': JSON.stringify(settings.searchKeys) }
          : undefined,
      },
    )
    clearTimeout(timer)
    if (res.ok) {
      const json = await res.json()
      const results = (json.results ?? []).slice(0, count).map((r: any, i: number): Source => ({
        id: `live-${i}`,
        title: r.title || r.url,
        url: r.url,
        domain: r.domain ?? safeDomain(r.url),
        snippet: r.snippet ?? '',
        faviconHue: hue(r.domain ?? r.url),
      }))
      // Remember which engine answered, for the panel header and Settings →
      // Search. A search that fell back must say it fell back.
      useStore.setState((st) => ({
        settings: { ...st.settings, searchLastEngine: String(json.backend ?? '') },
      }))
      if (results.length && json.backend && json.backend !== 'demo') {
        return { sources: results, backend: json.backend, live: true }
      }
      if (results.length) demoFromBackend = results
    }
  } catch { /* backend unreachable — continue down the ladder */ }

  // ---- 2) Wikipedia, directly from the browser (keyless, CORS-open) ----
  const wiki = await wikiSearch(query, count)
  if (wiki) return { sources: wiki, backend: 'wikipedia', live: true }

  // ---- 3) offline placeholders ----
  return {
    sources: demoFromBackend ?? demoSources(query, Math.min(5, count)),
    backend: 'offline',
    live: false,
  }
}

async function wikiSearch(query: string, count: number): Promise<Source[] | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 7000)
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search' +
      `&srsearch=${encodeURIComponent(query)}&srlimit=${count}&format=json&origin=*`
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    const items = json?.query?.search ?? []
    if (!items.length) return null
    return items.map((it: any, i: number): Source => ({
      id: `wiki-${it.pageid ?? i}`,
      title: it.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(it.title).replace(/ /g, '_'))}`,
      domain: 'en.wikipedia.org',
      snippet: String(it.snippet ?? '').replace(/<[^>]+>/g, ''),
      faviconHue: hue('en.wikipedia.org'),
    }))
  } catch {
    return null
  }
}
