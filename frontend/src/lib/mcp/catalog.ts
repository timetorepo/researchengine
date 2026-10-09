import seed from '@/content/mcp-catalog.json'

/**
 * The MCP catalog: a seed parsed from awesome-mcp-servers (4k+ servers), and a
 * live refresh from mcpservers.org for machines that can reach it. A failed
 * refresh keeps the seed and says so; it never pretends to be live.
 */
export interface McpCatalogEntry {
  name: string
  url: string
  description: string
  category: string
}

export const MCP_SEED: McpCatalogEntry[] = (seed as any).entries as McpCatalogEntry[]
export const MCP_SEED_SOURCE = `${(seed as any).source} · ${(seed as any).count} servers · parsed ${(seed as any).fetchedAt}`

export async function refreshCatalog(): Promise<{ entries: McpCatalogEntry[]; source: string } | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 9000)
    const res = await fetch('https://mcpservers.org/api/servers', { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const j: any = await res.json()
    const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.servers) ? j.servers : []
    const entries: McpCatalogEntry[] = arr
      .map((e) => ({
        name: String(e.name ?? e.title ?? e.slug ?? '').trim(),
        url: String(e.url ?? e.links?.website ?? e.repository ?? '').trim(),
        description: String(e.description ?? e.summary ?? '').slice(0, 220),
        category: String(e.category ?? e.group ?? 'Live'),
      }))
      .filter((e) => e.name && e.name.length < 120)
    if (!entries.length) return null
    return { entries, source: `mcpservers.org · live · ${entries.length} servers` }
  } catch {
    return null
  }
}

/** Search both lists; name and description hits, category prefix first. */
export function searchCatalog(entries: McpCatalogEntry[], q: string, limit = 60): McpCatalogEntry[] {
  const s = q.trim().toLowerCase()
  if (!s) return entries.slice(0, limit)
  const scored = entries
    .map((e) => {
      const n = e.name.toLowerCase()
      const score = n.startsWith(s) ? 0 : n.includes(s) ? 1 : e.category.toLowerCase().includes(s) ? 2 : e.description.toLowerCase().includes(s) ? 3 : 9
      return { e, score }
    })
    .filter((x) => x.score < 9)
    .sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((x) => x.e)
}
