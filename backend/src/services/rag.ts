/**
 * The RAG pipeline — retrieval-augmented generation, Perplexity's backbone,
 * rebuilt here with its failure modes designed out.
 *
 * The stages mirror the published architecture: parse the query, plan
 * sub-queries for deep research, retrieve from the live search ladder, read
 * the pages themselves (not just snippets), refine — deduplicate and rank by
 * relevance — and fuse everything into one capped, numbered context block the
 * model answers from.
 *
 * What Perplexity gets wrong, and what this does instead:
 *   • fabricated citations: the context only ever contains sources we actually
 *     retrieved, numbered, and the client audits every [n] the model writes;
 *   • AI-generated spam sources: every host gets a trust tier and low-tier
 *     hosts rank below primary and trusted ones, with the tier shown to the
 *     user instead of hidden;
 *   • blended, overconfident synthesis: the fuse prompt tells the model to
 *     attribute claims, to say when sources disagree, and to admit gaps — and
 *     the stats say plainly how thin the grounding was.
 *
 * Everything synchronous in this file is exported pure, so the pipeline is
 * unit-tested offline; only the route touches the network.
 */
import { readSource } from './reader/extract'

export interface RagHit {
  title: string
  url: string
  snippet: string
  domain: string
}

export type TrustTier = 'primary' | 'trusted' | 'web'

export interface RagSource extends RagHit {
  n: number
  tier: TrustTier
  /** What the reader actually pulled from the page, trimmed for the prompt. */
  body?: string
}

export interface RagOutcome {
  sources: RagSource[]
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

/* ------------------------------------------------------------- parsing --- */

const STOP = new Set(('a an and are as at be but by for from has have how if in is it its of on or that the this to was what when where which who why will with you your').split(' '))

export function parseQuery(q: string): { intent: 'factual' | 'howto' | 'compare' | 'define' | 'general'; terms: string[] } {
  const s = q.trim().toLowerCase()
  const intent =
    /^(how (do|to|can|does)|steps? to|way to)/.test(s) ? 'howto'
    : /\b(vs\.?|versus|difference between|compare|comparison)\b/.test(s) ? 'compare'
    : /^(what is|what are|who is|who are|define|definition of|meaning of)/.test(s) ? 'define'
    : /^(when|where|how much|how many|which|is|are|was|were|did|does|do)\b/.test(s) || s.endsWith('?') ? 'factual'
    : 'general'
  const terms = s
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
  return { intent, terms }
}

/**
 * Deep research decomposes the query into at most three retrieval passes: the
 * query itself plus a definition pass and an evidence pass. Deterministic on
 * purpose — no extra model call, no extra latency, no extra tokens spent to
 * plan.
 */
export function planSubqueries(q: string, deep: boolean, intent: string): string[] {
  const base = q.trim()
  if (!deep) return [base]
  const terms = parseQuery(q).terms.slice(0, 6).join(' ')
  const out = [base]
  if (intent === 'compare') out.push(`${terms} comparison differences`)
  else if (intent === 'howto') out.push(`${terms} step by step`)
  else out.push(`${terms} overview definition`)
  out.push(`${terms} 2025 OR 2026 recent`)
  return [...new Set(out)].slice(0, 3)
}

/* --------------------------------------------------------------- trust --- */

const PRIMARY_HOSTS = [
  'wikipedia.org', 'wikimedia.org', 'arxiv.org', 'nature.com', 'sciencedirect.com',
  'nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'who.int', 'imf.org', 'worldbank.org',
]
const TRUSTED_HOSTS = [
  'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.python.org',
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com',
  'economist.com', 'ft.com', 'bloomberg.com', 'techcrunch.com', 'arstechnica.com',
  'nasa.gov', 'europa.eu', 'github.io',
]
const LOW_TIER_HOSTS = ['medium.com', 'linkedin.com', 'blogspot.com', 'quora.com', 'facebook.com', 'x.com', 'twitter.com']

/**
 * Hosts fall into three tiers. The point is not to hide the web tier but to
 * stop treating a LinkedIn post like Nature: ranking uses the tier, and the
 * user sees it.
 */
export function trustTier(host: string): TrustTier {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h.endsWith('.gov') || h.endsWith('.edu') || h.endsWith('.gov.uk') || PRIMARY_HOSTS.some((p) => h === p || h.endsWith(`.${p}`))) return 'primary'
  if (TRUSTED_HOSTS.some((p) => h === p || h.endsWith(`.${p}`))) return 'trusted'
  return 'web'
}

const TIER_WEIGHT: Record<TrustTier, number> = { primary: 3, trusted: 2, web: 1 }

/* ------------------------------------------------------------- refine --- */

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

/**
 * Deduplicate by host (one voice per site, the best-ranked hit wins) and rank
 * by term overlap first, trust tier second. Snippet-only hits are legitimate
 * here; pages the reader could not fetch keep their snippet.
 */
export function dedupeRank(hits: RagHit[], terms: string[]): RagHit[] {
  const score = (h: RagHit): number => {
    const hay = `${h.title} ${h.snippet}`.toLowerCase()
    const overlap = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
    return overlap * 2 + TIER_WEIGHT[trustTier(h.domain || hostOf(h.url))]
  }
  const byHost = new Map<string, { hit: RagHit; s: number }>()
  for (const h of hits) {
    const host = h.domain || hostOf(h.url)
    if (!host) continue
    const s = score(h)
    const cur = byHost.get(host)
    if (!cur || s > cur.s) byHost.set(host, { hit: { ...h, domain: host }, s })
  }
  return [...byHost.values()].sort((a, b) => b.s - a.s).map((x) => x.hit)
}

/* --------------------------------------------------------------- fuse --- */

/**
 * One numbered, capped context block. Every source is labelled with its trust
 * tier so the model (and the reader of the answer) knows what it is leaning
 * on. The budget is deliberately small — grounding should sharpen the answer,
 * not eat the context window.
 */
export function fuseContext(query: string, sources: RagSource[], budgetChars = 3200): { context: string; chars: number } {
  const preface = `Retrieved sources for: "${query.trim().slice(0, 140)}". Each is numbered and labelled with a trust tier (primary > trusted > web).`
  const lines: string[] = []
  let size = preface.length + 2
  for (const s of sources) {
    const body = s.body?.trim()
    const text = body ? body.slice(0, 900) : (s.snippet || '').slice(0, 400)
    const line = `[${s.n}] (${s.tier}) "${s.title}" — ${s.domain}${text ? `\n${text}` : ''}`
    if (size + line.length + 2 > budgetChars && lines.length >= 2) break
    lines.push(line)
    size += line.length + 2
  }
  const context = `${preface}\n\n${lines.join('\n\n')}`
  return { context, chars: context.length }
}

/* ----------------------------------------------------------- pipeline --- */

/**
 * Run the whole pipeline. `search` is injected so this stays testable offline
 * and the route decides which search ladder to hand it. Reads race a deadline:
 * whatever arrives in time grounds the answer, and the stats say how many did.
 */
export async function prepareRag(opts: {
  query: string
  deep?: boolean
  maxSources?: number
  timeoutMs?: number
  search: (q: string) => Promise<RagHit[]>
}): Promise<RagOutcome> {
  const t0 = Date.now()
  const { query, deep = false, maxSources = 5, timeoutMs = 2600, search } = opts
  const { intent, terms } = parseQuery(query)
  const subqueries = planSubqueries(query, deep, intent)

  // Retrieve every sub-query in parallel; failures degrade, never throw.
  const results = await Promise.allSettled(subqueries.map((q) => search(q)))
  const hits: RagHit[] = []
  for (const r of results) if (r.status === 'fulfilled') hits.push(...r.value)

  const ranked = dedupeRank(hits, terms).slice(0, maxSources)

  // Read the pages themselves, racing the deadline. A page that misses the
  // race still grounds the answer by its snippet.
  const readResults = await Promise.all(ranked.map(async (h) => {
    try {
      const res = await Promise.race([
        readSource(h.url),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ])
      if (!res || !res.ok) return ''
      return res.blocks
        .filter((b) => b.type === 'paragraph' || b.type === 'heading')
        .map((b) => (b as any).text ?? '')
        .join(' ')
        .slice(0, 1000)
    } catch { return '' }
  }))

  const sources: RagSource[] = ranked.map((h, i) => ({
    ...h, n: i + 1, tier: trustTier(h.domain || hostOf(h.url)),
    body: readResults[i] || undefined,
  }))

  const { context, chars } = fuseContext(query, sources)
  const readCount = sources.filter((s) => s.body).length
  return {
    sources, context,
    stats: {
      intent, subqueries, hits: hits.length, read: readCount, chars,
      estimatedTokens: Math.round(chars / 4),
      tookMs: Date.now() - t0,
      thin: sources.length < 2 || readCount === 0,
    },
  }
}
