// Pluggable search backends.
//
// The point of this file is that search *works*, on a fresh install, with no
// keys and no configuration — and gets better when you give it something. The
// ladder is:
//
//   1. a SearXNG instance (yours if you run one, otherwise a public one that
//      still serves the JSON API) — keyless, no tracking, and the same engine
//      the app has always preferred;
//   2. a keyed API, if the user pasted a key in the UI (they travel with the
//      request, so nothing has to be configured on the server);
//   3. keyless DuckDuckGo HTML, which needs nothing at all;
//   4. clearly-labelled offline demo results, so the UI never shows an empty
//      panel pretending to be a search.
//
// Every step reports which engine answered, and the UI shows it.
export interface SearchResult { title: string; url: string; snippet: string; domain: string }

/** Keys for the request: what the user typed in Settings → Search wins. */
export interface SearchKeys {
  brave?: string
  serper?: string
  tavily?: string
}

/** Our own patience for any single outbound search request, ms. */
const DEFAULT_TIMEOUT = 8000

/**
 * Public SearXNG instances that serve `format=json`. They come and go, which is
 * exactly why this is a list tried in order rather than one hardcoded URL: the
 * first that answers wins, and the winner is remembered for a few minutes.
 */
export const PUBLIC_SEARXNG: string[] = [
  'https://searx.be',
  'https://search.inetol.net',
  'https://baresearch.org',
  'https://search.rhscz.eu',
  'https://priv.au',
  'https://searxng.site',
  'https://opnxng.com',
]

/** Remembered instance, so every query in a session does not re-probe. */
let preferred: { url: string; at: number } | null = null
const PREFERRED_TTL = 5 * 60 * 1000

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms)
  if (!signal) return t
  // Combine the caller's signal with the timeout.
  const ctrl = new AbortController()
  const abort = () => ctrl.abort()
  signal.addEventListener('abort', abort)
  t.addEventListener('abort', abort)
  return ctrl.signal
}

function hostOf(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

export async function searchSearxng(base: string, q: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SearchResult[]> {
  const url = `${base.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json&safesearch=0`
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'research-engine/1 (+self-hosted)' },
    signal: withTimeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`SearXNG responded ${res.status}`)
  const json: any = await res.json().catch(() => null)
  if (!json || !Array.isArray(json.results)) throw new Error('SearXNG did not return JSON results')
  return (json.results ?? [])
    .filter((r: any) => r?.url)
    .slice(0, 8)
    .map((r: any) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.content ?? '',
      domain: hostOf(r.url),
    }))
}

/**
 * SearXNG without being told where: your instance first, then whatever public
 * instance answers. Returns the results *and* which instance served them, so the
 * UI can say "searching via searx.be" instead of pretending it was local.
 */
export async function searchSearxngAuto(
  q: string,
  opts: { own?: string | null; timeouts?: number; timeoutMs?: number } = {},
): Promise<{ results: SearchResult[]; instance: string }> {
  const candidates: string[] = []
  if (opts.own) candidates.push(opts.own)
  if (preferred && Date.now() - preferred.at < PREFERRED_TTL) candidates.push(preferred.url)
  for (const url of [opts.own ? null : 'http://localhost:8080', ...PUBLIC_SEARXNG]) {
    if (url && !candidates.includes(url)) candidates.push(url)
  }
  const perTry = opts.timeoutMs ?? 6000
  const limit = Math.max(1, Math.min(opts.timeouts ?? candidates.length, candidates.length))
  let lastError: unknown = null
  for (const url of candidates.slice(0, limit)) {
    try {
      const results = await searchSearxng(url, q, perTry)
      if (results.length) {
        preferred = { url, at: Date.now() }
        return { results, instance: url }
      }
    } catch (e) { lastError = e }
  }
  throw lastError ?? new Error('No SearXNG instance answered')
}

export async function searchBrave(q: string, key?: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SearchResult[]> {
  const token = key || process.env.BRAVE_API_KEY
  if (!token) throw new Error('No Brave key — paste one in Settings → Search, or set BRAVE_API_KEY')
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=8`, {
    headers: { 'X-Subscription-Token': token, accept: 'application/json' },
    signal: withTimeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Brave responded ${res.status}`)
  const json: any = await res.json()
  return (json.web?.results ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.description ?? '', domain: hostOf(r.url),
  }))
}

export async function searchSerper(q: string, key?: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SearchResult[]> {
  const token = key || process.env.SERPER_API_KEY
  if (!token) throw new Error('No Serper key — paste one in Settings → Search, or set SERPER_API_KEY')
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': token, 'content-type': 'application/json' },
    body: JSON.stringify({ q }),
    signal: withTimeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Serper responded ${res.status}`)
  const json: any = await res.json()
  return (json.organic ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.link, snippet: r.snippet ?? '', domain: hostOf(r.link),
  }))
}

export async function searchTavily(q: string, key?: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SearchResult[]> {
  const token = key || process.env.TAVILY_API_KEY
  if (!token) throw new Error('No Tavily key — paste one in Settings → Search, or set TAVILY_API_KEY')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: token, query: q, max_results: 8 }),
    signal: withTimeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Tavily responded ${res.status}`)
  const json: any = await res.json()
  return (json.results ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.content ?? '', domain: hostOf(r.url),
  }))
}

/** Keyless fallback: DuckDuckGo's lite HTML endpoint. */
export async function searchDdg(q: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SearchResult[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (Research Engine)' },
    signal: withTimeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`DuckDuckGo responded ${res.status}`)
  const html = await res.text()
  const out: SearchResult[] = []
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 8) {
    const url = decodeURIComponent(m[1].replace(/^.*uddg=/, '').replace(/&rut=.*$/, ''))
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (url.startsWith('http')) out.push({ title, url, snippet: '', domain: hostOf(url) })
  }
  if (!out.length) throw new Error('DuckDuckGo returned no parsable results')
  return out
}

export function searchDemo(q: string): SearchResult[] {
  const domains = ['arxiv.org', 'nature.com', 'wikipedia.org', 'acm.org', 'ncbi.nlm.nih.gov']
  return domains.map((d, i) => ({
    title: `${q} — result ${i + 1}`,
    url: `https://${d}/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}`,
    snippet: `Demo result for "${q}" (offline mode or no reachable engine).`,
    domain: d,
  }))
}

/**
 * What this machine can actually reach right now. Used by Settings → Search to
 * show honest status instead of a switch that lies, and by the search path to
 * skip engines it already knows are dead.
 */
export async function searchStatus(keys: SearchKeys, own?: string | null): Promise<{
  searxng: { url: string; reachable: boolean; instance?: string }[]
  ddg: boolean
  keys: { brave: boolean; serper: boolean; tavily: boolean }
}> {
  const instances = [...(own ? [own] : []), 'http://localhost:8080', ...PUBLIC_SEARXNG]
  const probes = await Promise.all(instances.map(async (url) => {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/search?q=research&format=json`, {
        headers: { accept: 'application/json' },
        signal: withTimeout(4000),
      })
      return { url, reachable: res.ok }
    } catch {
      return { url, reachable: false }
    }
  }))
  let ddg = false
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=research', {
      headers: { 'user-agent': 'Mozilla/5.0 (Research Engine)' },
      signal: withTimeout(4000),
    })
    ddg = res.ok
  } catch { ddg = false }
  return {
    searxng: probes,
    ddg,
    keys: {
      brave: !!(keys.brave || process.env.BRAVE_API_KEY),
      serper: !!(keys.serper || process.env.SERPER_API_KEY),
      tavily: !!(keys.tavily || process.env.TAVILY_API_KEY),
    },
  }
}
