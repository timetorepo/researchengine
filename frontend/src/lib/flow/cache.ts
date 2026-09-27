// AIFlowEngine — semantic-ish cache. Normalized-query exact/near match first
// (zero-cost); keyed localStorage, capped.
interface CacheEntry { k: string; v: string; t: number }
const KEY = 're.flow.cache'
const MAX = 120

function load(): CacheEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function save(entries: CacheEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX))) } catch { /* full */ }
}

export function normalize(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim()
}

export function cacheGet(q: string): string | null {
  const k = normalize(q)
  const hit = load().find((e) => e.k === k)
  return hit ? hit.v : null
}

export function cacheSet(q: string, v: string) {
  const entries = load().filter((e) => e.k !== normalize(q))
  entries.unshift({ k: normalize(q), v, t: Date.now() })
  save(entries)
}

export function cacheSize(): number {
  return load().length
}

export function cacheClear() {
  localStorage.removeItem(KEY)
}
