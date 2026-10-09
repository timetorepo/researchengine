/**
 * Build the MCP server catalog seed from a clone of punkpeye/awesome-mcp-servers.
 * The shipped catalog is this seed; on a connected machine the catalog UI can
 * refresh itself live from mcpservers.org.
 *
 * Usage: node scripts/build-mcp-catalog.mjs --src <clone dir>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const i = args.indexOf('--src')
if (i < 0) { console.error('usage: --src <clone dir>'); process.exit(1) }
const readme = readFileSync(join(resolve(args[i + 1]), 'README.md'), 'utf8')

const entries = []
let category = ''
const seen = new Set()
for (const line of readme.split('\n')) {
  const h = line.match(/^##+\s+(.+)$/)
  if (h) { category = h[1].replace(/[#*`]/g, '').trim(); continue }
  const m = line.match(/^[-*]\s+\[([^\]]+)\]\((https?:[^)]+)\)\s*(?:[—–-]\s*)?(.*)$/)
  if (!m) continue
  const name = m[1].trim()
  const url = m[2].trim()
  const description = m[3]
    .replace(/\[!?\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')   // badge links
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                 // bare images
    .replace(/`/g, '')
    .replace(/^[\s\p{So}\p{Sk}—–-]+/u, '')                 // emoji + dash prefix
    .replace(/\s+/g, ' ')
    .trim().slice(0, 220)
  const key = `${name.toLowerCase()}|${url}`
  if (seen.has(key)) continue
  seen.add(key)
  entries.push({ name, url, description, category })
}

const out = resolve(here, '../src/content/mcp-catalog.json')
writeFileSync(out, JSON.stringify({ source: 'awesome-mcp-servers', fetchedAt: '2026-10-07', count: entries.length, entries }, null, 1))
console.log(`mcp catalog: ${entries.length} servers across ${new Set(entries.map((e) => e.category)).size} categories`)
