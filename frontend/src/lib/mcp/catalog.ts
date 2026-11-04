/**
 * The MCP catalog: the open index of MCP servers, shipped as compact JSON that
 * loads only when a panel opens, so it never weighs on the main bundle. An
 * entry with a verified run command installs in one click; the rest link out.
 */
export interface McpCatalogEntry {
  name: string
  description: string
  category: string
  url: string
  /** A verified run command, e.g. "npx -y @scope/server". Empty when unverified. */
  command: string
  /** Environment variables the server needs before it can reach its service. */
  env: string[]
  transport: string
  /** A hosted endpoint, for servers that are not installable locally. */
  endpoint?: string
}

export interface McpCatalog {
  source: string
  count: number
  withCommand: number
  entries: McpCatalogEntry[]
}

/** mcpservers.org lists its own index, 30 per page: linked, not bulk-loaded. */
export const MCP_REGISTRY_URL = 'https://mcpservers.org/all'
export const MCP_REGISTRY_LISTED = '14,916'

let cached: Promise<McpCatalog> | null = null

/** Loads the catalog once, on first use. */
export function loadMcpCatalog(): Promise<McpCatalog> {
  if (!cached) {
    cached = import('@/content/mcp-catalog.json').then((m: any) => (m.default ?? m) as McpCatalog)
  }
  return cached
}

/** Split a run command into argv, honouring simple quotes. */
export function splitCommand(cmd: string): { command: string; args: string[] } {
  const parts: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cmd)) !== null) parts.push(m[1] ?? m[2] ?? m[3])
  const [command = '', ...rest] = parts
  return { command, args: rest }
}

/** Name hits first, then category, then description. */
export function searchCatalog(entries: McpCatalogEntry[], q: string, limit = 40): McpCatalogEntry[] {
  const s = q.trim().toLowerCase()
  if (!s) return entries.slice(0, limit)
  const scored: { e: McpCatalogEntry; score: number }[] = []
  for (const e of entries) {
    const n = e.name.toLowerCase()
    const score = n.startsWith(s) ? 0
      : n.includes(s) ? 1
      : e.category.toLowerCase().includes(s) ? 2
      : e.description.toLowerCase().includes(s) ? 3
      : 9
    if (score < 9) scored.push({ e, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((x) => x.e)
}
