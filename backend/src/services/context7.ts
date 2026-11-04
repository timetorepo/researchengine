// Context7 documentation search, server side. Calls Context7's search API and
// returns a small, clean shape. The key (optional) is used for this request only.
const BASE = 'https://context7.com/api/v3/search'
const TIMEOUT_MS = 12_000

export interface DocsHit { library: string; title: string; code: string[]; info: string }

export type DocsResult = { ok: true; hits: DocsHit[] } | { ok: false; status: number; error: string }

export async function searchDocs(opts: { query: string; library?: string; key?: string }): Promise<DocsResult> {
  const url = new URL(BASE)
  url.searchParams.set('query', opts.query.slice(0, 500))
  url.searchParams.set('type', 'json')
  for (const name of (opts.library ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4)) {
    url.searchParams.append('library', name.slice(0, 80))
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.key) headers.authorization = `Bearer ${opts.key}`

  let res: Response
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return { ok: false, status: 502, error: 'Context7 could not be reached from this machine.' }
  }
  // Nothing matched is an answer, not a failure.
  if (res.status === 404) return { ok: true, hits: [] }
  if (res.status === 429) return { ok: false, status: 429, error: 'Context7 is rate-limiting this machine. Try again shortly, or add a Context7 key under Connectors.' }
  if (!res.ok) return { ok: false, status: 502, error: `Context7 answered ${res.status}.` }

  const body = (await res.json().catch(() => ({}))) as any
  const hits: DocsHit[] = []
  for (const s of Array.isArray(body.codeSnippets) ? body.codeSnippets : []) {
    hits.push({
      library: String(s.libraryId ?? ''),
      title: String(s.codeTitle ?? ''),
      code: (Array.isArray(s.codeList) ? s.codeList : []).map((c: any) => String(c?.code ?? '')).filter(Boolean).slice(0, 2),
      info: '',
    })
  }
  for (const s of Array.isArray(body.infoSnippets) ? body.infoSnippets : []) {
    hits.push({ library: String(s.libraryId ?? ''), title: String(s.breadcrumb ?? s.title ?? ''), code: [], info: String(s.content ?? '').slice(0, 1200) })
  }
  return { ok: true, hits: hits.slice(0, 8) }
}
