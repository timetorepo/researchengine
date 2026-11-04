/**
 * Vendor upstream skill packs into the repo:
 *   • emilkowalski/skills — the full set (apple-design and friends), verbatim;
 *   • tojileon/ian-xiaohei-illustrations-en — the skill's text (SKILL.md,
 *     references, agent config) plus a cross-model adapter that rephrases the
 *     Codex-specific bits so Claude, Gemini, Grok and friends can run it too.
 *
 * Usage: node scripts/build-skills.mjs --skills <clone> --illustrations <clone>
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const grab = (flag) => { const i = args.indexOf(flag); return i >= 0 ? resolve(args[i + 1]) : null }
const skillsSrc = grab('--skills')
const illustSrc = grab('--illustrations')
if (!skillsSrc || !illustSrc) { console.error('usage: --skills <dir> --illustrations <dir>'); process.exit(1) }

const TEXT = /\.(md|markdown|txt|ya?ml|json)$/i
const walk = (dir) => {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (TEXT.test(e.name)) out.push(p)
  }
  return out
}

const fm = (text) => {
  const m = String(text).match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.+)$/)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

const outRoot = resolve(here, '../src/content/skills/upstream')
mkdirSync(outRoot, { recursive: true })
const catalog = []

const copySkill = (id, base, extra = {}) => {
  const files = walk(base)
  const skillFile = files.find((f) => f.endsWith('SKILL.md')) || files[0]
  const meta = skillFile ? fm(readFileSync(skillFile, 'utf8')) : {}
  const rels = []
  for (const abs of files) {
    const rel = abs.slice(base.length + 1)
    mkdirSync(join(outRoot, id, dirname(rel)), { recursive: true })
    copyFileSync(abs, join(outRoot, id, rel))
    rels.push(rel)
  }
  for (const [name, text] of Object.entries(extra)) {
    writeFileSync(join(outRoot, id, name), text)
    rels.push(name)
  }
  catalog.push({
    id,
    name: meta.name || id,
    description: meta.description || '',
    files: rels.sort(),
    origin: extra.origin || 'emilkowalski/skills',
  })
}

for (const e of readdirSync(join(skillsSrc, 'skills'), { withFileTypes: true })) {
  if (!e.isDirectory()) continue
  copySkill(e.name, join(skillsSrc, 'skills', e.name), { origin: 'emilkowalski/skills' })
}

const adapter = `# Running this skill outside Codex

This pack was written for Codex, but every rule in it is plain language, so
any instruction-following model can run it. When the host is not Codex:

1. Treat "the model" as whichever model is answering. Nothing in the skill
   depends on Codex tooling; the modes (plan_only, generate, edit, save) map
   onto ordinary image-generation turns.
2. For image generation, call whatever image tool the host offers (DALL-E,
   imagen, Flux, a local renderer). The prompt template in
   references/prompt-template.md is model-agnostic: fill its slots and hand
   the paragraph to the tool.
3. Codex-specific knobs (shell save paths, file moves) become host file
   actions; if the host cannot write files, return the final prompt and the
   suggested filename instead.
4. Keep the style contract exactly: 16:9, pure white ground, Xiaohei IP,
   sparse red/orange/blue annotations, English handwritten labels. The QA
   checklist in references/qa-checklist.md is the acceptance gate whichever
   model produced the image.
`
copySkill('ian-xiaohei-illustrations', join(illustSrc, 'ian-xiaohei-illustrations'), {
  'MODEL-ADAPTERS.md': adapter,
  origin: 'tojileon/ian-xiaohei-illustrations-en',
})

const ts = `/** Upstream skill packs vendored verbatim, plus the cross-model adapter. */
export type SkillPack = { id: string; name: string; description: string; files: string[]; origin: string }
export const SKILL_PACKS: SkillPack[] = ${JSON.stringify(catalog, null, 1)}
`
writeFileSync(resolve(here, '../src/content/skills/catalog.ts'), ts)
console.log(`skills vendored: ${catalog.length} packs (${catalog.reduce((n, s) => n + s.files.length, 0)} files)`)
