/**
 * Build the MCP catalog from the open MCP index, TensorBlock/awesome-mcp-servers
 * (data/catalog.json, about 7.7k servers).
 *
 * Only what the app needs ships: name, a short description, category, the
 * canonical link, and, where the index verified one, a runnable command. The
 * public directory at mcpservers.org lists more (14,916 at the time of
 * writing), but it pages 30 at a time and cannot be bulk-downloaded, so the
 * app links out to it instead of pretending to hold it.
 *
 * Usage: node scripts/build-mcp-catalog.mjs --src <dir containing data/catalog.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const i = args.indexOf('--src')
if (i < 0) { console.error('usage: --src <dir containing data/catalog.json>'); process.exit(1) }
const src = resolve(args[i + 1])
const raw = JSON.parse(readFileSync(join(src, 'data/catalog.json'), 'utf8'))

/** Only commands that start a server locally count as one-click installs. */
const RUNNABLE = /^(npx|uvx|pipx|python3?|node|docker)\b/
const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

const entries = raw
  .map((x) => {
    const cmds = Array.isArray(x.install?.commands)
      ? x.install.commands.map((c) => String(c).trim()).filter(Boolean)
      : []
    const command = cmds.find((c) => RUNNABLE.test(c)) ?? ''
    const url = x.links?.primary || x.links?.repo || x.links?.homepage || x.links?.docs || ''
    const endpoint = x.links?.endpoint && x.links.endpoint !== url ? x.links.endpoint : ''
    const transport = (Array.isArray(x.transport) ? x.transport : []).filter((t) => t && t !== 'unknown').join(', ')
    return {
      name: clean(x.name || x.id, 90),
      description: clean(x.description, 170),
      category: clean(x.category, 60) || 'Other',
      url: clean(url, 300),
      command: clean(command, 200),
      env: (Array.isArray(x.install?.env) ? x.install.env : []).map((k) => clean(k, 60)).filter(Boolean).slice(0, 4),
      transport,
      ...(endpoint ? { endpoint: clean(endpoint, 300) } : {}),
    }
  })
  .filter((e) => e.name)

// One-click installs first, then alphabetical.
entries.sort((a, b) => (b.command ? 1 : 0) - (a.command ? 1 : 0) || a.name.localeCompare(b.name))
const withCommand = entries.filter((e) => e.command).length
const out = {
  source: 'TensorBlock/awesome-mcp-servers, data/catalog.json',
  fetchedAt: '2026-10-09',
  count: entries.length,
  withCommand,
  entries,
}
writeFileSync(resolve(here, '../src/content/mcp-catalog.json'), JSON.stringify(out))
console.log(`mcp catalog: ${entries.length} servers, ${withCommand} with a verified runnable install`)
