/**
 * Vendor upstream agent skills into the app, so they are ready at startup with
 * no network call and no `npx` in the user's path.
 *
 * Each pack lands in frontend/src/content/skills/upstream/<id>/ verbatim, with
 * an `origin` file naming the source repository, and is registered in
 * frontend/src/content/skills/catalog.ts. A chat attaches a pack and its
 * SKILL.md rides along in the system context (see lib/skills/packs.ts).
 *
 * Usage:
 *   node scripts/vendor-skills.mjs                 # fetch every pack over HTTPS
 *   node scripts/vendor-skills.mjs --from <dir>    # read packs from a local checkout
 *   node scripts/vendor-skills.mjs --list          # show the manifest, fetch nothing
 *
 * `--from <dir>` expects `<dir>/<pack id>/<file>` and is the offline twin of the
 * network path: useful behind a proxy that Node's trust store does not know
 * about, and for reviewing a pack before it is vendored.
 *
 * Sources are public GitHub repositories. Nothing here rewrites a skill's text:
 * what upstream ships is what the app runs.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const outRoot = resolve(repoRoot, 'frontend/src/content/skills/upstream')
const catalogPath = resolve(repoRoot, 'frontend/src/content/skills/catalog.ts')

const RAW = 'https://api.github.com/repos'

/**
 * The packs this app ships. `license` and `credit` are carried into the catalog
 * so the app can show where a pack came from and under what terms — several of
 * these are Apache-2.0 or MIT and both require the notice to travel with the
 * work.
 */
const MANIFEST = [
  {
    id: 'find-skills',
    repo: 'vercel-labs/skills',
    ref: 'main',
    path: 'skills/find-skills',
    license: 'MIT',
    credit: 'Vercel — the open agent skills tool (npx skills)',
    files: ['SKILL.md'],
  },
  {
    id: 'web-design-guidelines',
    repo: 'vercel-labs/agent-skills',
    ref: 'main',
    path: 'skills/web-design-guidelines',
    license: 'MIT',
    credit: 'Vercel — Web Interface Guidelines',
    files: ['SKILL.md'],
  },
  {
    id: 'anti-ui-slop',
    repo: 'davepoon/buildwithclaude',
    ref: 'main',
    path: 'plugins/all-skills/skills/anti-ui-slop',
    license: 'MIT',
    credit: 'Dave Poon — buildwithclaude, anti-ui-slop',
    files: ['SKILL.md'],
  },
  {
    id: 'impeccable',
    repo: 'pbakaus/impeccable',
    ref: 'main',
    path: '.agent/skills/impeccable',
    license: 'Apache-2.0',
    credit: 'Paul Bakaus — Impeccable, the design language for AI harnesses',
    // reference/hooks.md is what lets this skill drive a hook-capable runtime:
    // the user asked for Impeccable to support hooks, and that file is the
    // contract it exposes.
    files: ['SKILL.md', 'reference/hooks.md'],
  },
  {
    id: 'taste-skill',
    repo: 'Leonxlnx/taste-skill',
    ref: 'main',
    path: 'skills/taste-skill',
    license: 'MIT',
    credit: 'Leonxlnx — taste-skill',
    files: ['SKILL.md'],
  },
]

/**
 * Packs authored inside this repository rather than fetched. They are
 * registered through the same path so the catalog stays one generated file and
 * nothing has to be hand-edited into it.
 */
const LOCAL_PACKS = [
  {
    id: 'trojan-detector',
    license: 'MIT',
    credit: 'Chen Media — the /trojan detector guide (chen.media)',
    origin: 'chen.media',
    files: ['SKILL.md', 'origin'],
  },
]

/**
 * Licence and credit for the packs `frontend/scripts/build-skills.mjs` vendors
 * (emilkowalski/skills and the illustration pack). That script predates the
 * licence field, so the attribution is carried here instead of being rewritten
 * into it, and this backfills every run.
 */
const LICENCE_BY_ORIGIN = {
  'emilkowalski/skills': { license: 'MIT', credit: 'Emil Kowalski — animation and design-engineering skills' },
  'tojileon/ian-xiaohei-illustrations-en': { license: 'MIT', credit: 'tojileon — ian-xiaohei illustrations, English' },
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? resolve(args[i + 1]) : null
}
const fromDir = flag('--from')
const listOnly = args.includes('--list')

const frontmatter = (text) => {
  const m = String(text).match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.+)$/)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

/** Read the existing catalog as data so re-running never drops a pack. */
const readCatalog = () => {
  const src = existsSync(catalogPath) ? readFileSync(catalogPath, 'utf8') : ''
  const m = src.match(/export const SKILL_PACKS: SkillPack\[\] = (\[[\s\S]*?\n\])/)
  if (!m) return []
  try {
    return eval(m[1]) // eslint-disable-line no-eval
  } catch {
    return []
  }
}

const serialize = (packs) =>
  `/** Upstream skill packs vendored verbatim, plus the cross-model adapter. */\n` +
  `export type SkillPack = { id: string; name: string; description: string; files: string[]; origin: string; license?: string; credit?: string }\n` +
  `export const SKILL_PACKS: SkillPack[] = ${JSON.stringify(packs, null, 1)}\n`

if (listOnly) {
  for (const p of MANIFEST) console.log(`${p.id.padEnd(24)} ${p.repo}  ${p.license}`)
  process.exit(0)
}

const readPackFile = (pack, file) => {
  const local = join(fromDir, pack.id, file)
  if (existsSync(local)) return readFileSync(local, 'utf8')
  throw new Error(`missing ${local} (expected the pack's ${file} under --from ${fromDir})`)
}

const fetchPackFile = async (pack, file) => {
  const url = `${RAW}/${pack.repo}/contents/${pack.path}/${file}?ref=${pack.ref}`
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github.raw', 'User-Agent': 'research-engine-vendor' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

const existing = readCatalog()
if (existing.length === 0 && existsSync(catalogPath) && readFileSync(catalogPath, 'utf8').includes('SKILL_PACKS')) {
  // A silent empty read here would rewrite the catalog down to the manifest
  // and drop every pack already vendored. Refuse instead.
  console.error(`refusing to write ${catalogPath}: it exists but its SKILL_PACKS array could not be read.`)
  console.error('Fix the file by hand, or delete it to regenerate from the manifest alone.')
  process.exit(1)
}
const byId = new Map(existing.map((p) => [p.id, p]))

for (const pack of MANIFEST) {
  const dir = join(outRoot, pack.id)
  mkdirSync(dir, { recursive: true })
  const files = []
  let meta = {}
  for (const file of pack.files) {
    const text = fromDir ? readPackFile(pack, file) : await fetchPackFile(pack, file)
    const dest = join(dir, file)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, text)
    files.push(file)
    if (file === 'SKILL.md') meta = frontmatter(text)
    console.log(`  ${pack.id}/${file}  ${text.length} bytes`)
  }
  writeFileSync(join(dir, 'origin'), pack.repo)
  files.push('origin')

  byId.set(pack.id, {
    id: pack.id,
    name: meta.name || pack.id,
    description: meta.description || byId.get(pack.id)?.description || '',
    files: files.sort(),
    origin: pack.repo,
    license: pack.license,
    credit: pack.credit,
  })
}

// Locally authored packs: already on disk, only the catalog entry is written.
for (const pack of LOCAL_PACKS) {
  const dir = join(outRoot, pack.id)
  const missing = pack.files.filter((f) => !existsSync(join(dir, f)))
  if (missing.length > 0) {
    console.error(`skipping ${pack.id}: missing ${missing.join(', ')} under ${dir}`)
    continue
  }
  const skillText = readFileSync(join(dir, 'SKILL.md'), 'utf8')
  const meta = frontmatter(skillText)
  byId.set(pack.id, {
    id: pack.id,
    name: meta.name || pack.id,
    description: meta.description || byId.get(pack.id)?.description || '',
    files: [...pack.files].sort(),
    origin: pack.origin,
    license: pack.license,
    credit: pack.credit,
  })
  console.log(`  ${pack.id}  (local, ${skillText.length} bytes)`)
}

// Packs vendored by build-skills.mjs: backfill the licence that script does not
// carry, without touching the entries it already wrote.
for (const [id, pack] of byId) {
  const licence = LICENCE_BY_ORIGIN[pack.origin]
  if (!licence) continue
  byId.set(id, { ...pack, license: licence.license, credit: licence.credit })
}

// Keep the historical ordering stable: entries already in the file stay where
// they are, new ones append. Values come from `byId` so anything backfilled or
// rewritten above survives; `existing` is only the ordering.
const ordered = []
for (const p of existing) {
  const next = byId.get(p.id)
  if (next) ordered.push(next)
}
for (const [, p] of byId) if (!ordered.some((x) => x.id === p.id)) ordered.push(p)

writeFileSync(catalogPath, serialize(ordered))
console.log(`catalog: ${ordered.length} packs -> ${catalogPath}`)
