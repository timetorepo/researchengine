// Pluggable search backends. SearXNG is the self-hosted default;
// Brave/Serper/Tavily/DuckDuckGo are drop-in adapters.
export interface SearchResult { title: string; url: string; snippet: string; domain: string }

export async function searchSearxng(base: string, q: string): Promise<SearchResult[]> {
  const res = await fetch(`${base.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json`)
  if (!res.ok) throw new Error(`SearXNG responded ${res.status}`)
  const json: any = await res.json()
  return (json.results ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.content ?? '', domain: new URL(r.url).hostname,
  }))
}

export async function searchBrave(q: string): Promise<SearchResult[]> {
  const key = process.env.BRAVE_API_KEY
  if (!key) throw new Error('BRAVE_API_KEY is not set on the backend')
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}`, {
    headers: { 'X-Subscription-Token': key, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Brave responded ${res.status}`)
  const json: any = await res.json()
  return (json.web?.results ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.description ?? '', domain: new URL(r.url).hostname,
  }))
}

export async function searchSerper(q: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error('SERPER_API_KEY is not set on the backend')
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST', headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q }),
  })
  if (!res.ok) throw new Error(`Serper responded ${res.status}`)
  const json: any = await res.json()
  return (json.organic ?? []).slice(0, 8).map((r: any) => ({
    title: r.title, url: r.link, snippet: r.snippet ?? '', domain: new URL(r.link).hostname,
  }))
}

export async function searchTavily(q: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new Error('TAVILY_API_KEY is not set on the backend')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: q, max_results: 8 }),
  })
  if (!res.ok) throw new Error(`Tavily responded ${res.status}`)
  const json: any = await res.json()
  return (json.results ?? []).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.content ?? '', domain: new URL(r.url).hostname,
  }))
}

export async function searchDdg(q: string): Promise<SearchResult[]> {
  // HTML fallback — parses result anchors from the lite endpoint.
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (Research Engine)' },
  })
  if (!res.ok) throw new Error(`DuckDuckGo responded ${res.status}`)
  const html = await res.text()
  const out: SearchResult[] = []
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = re.exec(html)) && out.length < 8) {
    const url = decodeURIComponent(m[1].replace(/^.*uddg=/, '').replace(/&rut=.*$/, ''))
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (url.startsWith('http')) out.push({ title, url, snippet: '', domain: new URL(url).hostname })
  }
  return out
}

export function searchDemo(q: string): SearchResult[] {
  const domains = ['arxiv.org', 'nature.com', 'wikipedia.org', 'acm.org', 'ncbi.nlm.nih.gov']
  return domains.map((d, i) => ({
    title: `${q} — result ${i + 1}`,
    url: `https://${d}/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}`,
    snippet: `Demo result for "${q}" (configure a real backend in .env).`,
    domain: d,
  }))
}
