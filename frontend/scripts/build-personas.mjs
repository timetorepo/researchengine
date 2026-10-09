/**
 * Build the persona library from a clone of asgeirtj/system_prompts_leaks.
 *
 * The upstream repo is ~28 MB of prompt text across 800+ files, so the app
 * ships two layers:
 *   • a manifest that names EVERY prompt file (vendor, product, title, size),
 *     so the library can browse the whole archive offline;
 *   • the full text of a curated flagship set, vendored into the repo and
 *     lazy-loaded as its own chunks.
 * Anything not vendored can be pulled on a connected machine with
 * `scripts/sync-personas.mjs`, which mirrors the full archive locally.
 *
 * Usage: node scripts/build-personas.mjs --src /path/to/system_prompts_leaks
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const srcIdx = args.indexOf('--src')
if (srcIdx < 0) { console.error('usage: node scripts/build-personas.mjs --src <clone dir>'); process.exit(1) }
const src = resolve(args[srcIdx + 1])
if (!existsSync(join(src, 'OpenAI'))) { console.error(`not a system_prompts_leaks clone: ${src}`); process.exit(1) }

/** The flagship set whose full text ships in the repo. */
const PICK = [
  'OpenAI/Codex/gpt-6-astra.md',
  'OpenAI/Codex/codex-full.md',
  'OpenAI/Codex/gpt-5.4.md',
  'OpenAI/Codex/gpt-5.3-codex-spark.md',
  'OpenAI/chatgpt-gpt-5-agent-mode.md',
  'OpenAI/chatgpt-personality-instructions.md',
  'OpenAI/chatgpt-atlas.md',
  'Anthropic/anthropic_reminders.md',
  'Anthropic/claude-code/claude-code-fable-5.1.md',
  'Google/gemini-3.1-pro.md',
  'Google/gemini-cli.md',
  'xAI/grok-4-with-new-safety-instructions.md',
  'Perplexity/perplexity-ai.md',
  'Perplexity/deep-research.md',
  'Cursor/cursor.md',
  'Mistral/mistral-code.md',
  'Kimi/kimi-3.md',
  'Qwen/qwen3.8-max.md',
  'DeepSeek/deepseek-chat.md',
  'Pi/instructions.md',
  'Notion/notion-ai.md',
  'Microsoft/github-copilot.md',
  'Misc/character-ai.md',
  'Misc/devin-cli.md',
]

const titleOf = (text, file) => {
  const m = String(text).match(/^#\s+(.+)$/m)
  return m ? m[1].trim().slice(0, 90) : file.replace(/\.md$/, '')
}

const walk = (dir) => {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

const files = walk(src).sort()
const vendored = []
const manifest = []
let vendoredBytes = 0
for (const abs of files) {
  const rel = abs.slice(src.length + 1).replace(/\\/g, '/')
  const text = readFileSync(abs, 'utf8')
  const [vendor, ...rest] = rel.split('/')
  const product = rest.length > 1 ? rest.slice(0, -1).join('/') : ''
  const entry = { path: rel, vendor, product, file: rest[rest.length - 1] || rel, title: titleOf(text, rel), chars: text.length, vendored: false, slug: '' }
  manifest.push(entry)
}

const outDir = resolve(here, '../src/content/personas/text')
mkdirSync(outDir, { recursive: true })
for (const rel of PICK) {
  const abs = join(src, rel)
  if (!existsSync(abs)) { console.log(`skip (not upstream): ${rel}`); continue }
  const slug = rel.replace(/\.md$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  copyFileSync(abs, join(outDir, `${slug}.md`))
  vendoredBytes += statSync(abs).size
  const m = manifest.find((x) => x.path === rel)
  if (m) { m.vendored = true; m.slug = slug; vendored.push(m) }
}

const ts = `/**
 * Persona manifest — every prompt file in the upstream archive
 * (asgeirtj/system_prompts_leaks), with the vendored flag marking the ones
 * whose full text ships in this repo. The rest are one sync away on a
 * connected machine.
 *
 * ${manifest.length} prompts, ${vendored.length} vendored (${(vendoredBytes / 1024).toFixed(0)} KiB of text).
 */
export type PersonaEntry = { path: string; vendor: string; product: string; file: string; title: string; chars: number; vendored: boolean; slug: string }
export const PERSONAS_MANIFEST: PersonaEntry[] = ${JSON.stringify(manifest, null, 1)}
`
writeFileSync(resolve(here, '../src/content/personas/manifest.ts'), ts)
console.log(`manifest: ${manifest.length} prompts across ${new Set(manifest.map((m) => m.vendor)).size} vendors`)
console.log(`vendored: ${vendored.length} files, ${(vendoredBytes / 1024).toFixed(0)} KiB`)
