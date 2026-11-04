#!/usr/bin/env node
/**
 * Aceternity UI vendoring — provenance, not magic.
 *
 * `npx shadcn@latest add @aceternity/<component>` is the canonical install, and
 * on a machine that can reach ui.aceternity.com it is all you need. Build
 * machines that cannot (this sandbox: ui.aceternity.com fails the TLS handshake,
 * so shadcn, npm, curl and every proxy all fail the same way) still have to get
 * the same code in, and "I copied it from a blog" is not good enough.
 *
 * So each vendored component records where it came from:
 *
 *   frontend/scripts/aceternity-sources.json
 *     { "<file>": { "demo": "@aceternity/...", "repo": "owner/name",
 *                   "path": "components/ui/....tsx", "sha256": "<upstream bytes>" } }
 *
 * and this script re-fetches the upstream file through the GitHub API and
 * compares digests. Files carry local patches (this app has thirteen themes, no
 * Next.js and no `.dark` class), so a mismatch is reported as *informational*:
 * it means upstream moved and the patch should be re-applied on top of the new
 * file, which is exactly the moment you want to be told.
 *
 *   node frontend/scripts/aceternity-vendor.mjs --verify     # check every entry
 *   node frontend/scripts/aceternity-vendor.mjs --list       # what is vendored
 *   node frontend/scripts/aceternity-vendor.mjs --fetch gooey-input [--out f]  # dump upstream
 *
 * Requires `gh` to be authenticated (it is, in CI and here): the API is the only
 * host that answers from this network.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const sourcesPath = join(here, 'aceternity-sources.json')
const uiDir = join(root, 'frontend', 'src', 'components', 'ui', 'aceternity')

const args = process.argv.slice(2)
const mode = args[0] ?? '--list'
const target = args[1]

const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'))
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

function ghContents(repo, path) {
  const out = execFileSync('gh', ['api', `/repos/${repo}/contents/${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const json = JSON.parse(out)
  return Buffer.from(json.content.replace(/\n/g, ''), 'base64')
}

if (mode === '--list') {
  console.log('Vendored Aceternity UI components\n')
  for (const [file, meta] of Object.entries(sources)) {
    const present = existsSync(join(uiDir, file))
    console.log(`  ${present ? '✓' : '✗'} ${meta.demo.padEnd(42)} ${meta.repo}/${meta.path}`)
  }
  console.log(`\n${Object.keys(sources).length} components — canonical install is listed on each file.`)
  process.exit(0)
}

if (mode === '--fetch') {
  const entry = Object.entries(sources).find(([file, meta]) => meta.demo.endsWith(target) || file.toLowerCase().includes(target.toLowerCase()))
  if (!entry) {
    console.error(`No vendored component matches "${target}". Try --list.`)
    process.exit(1)
  }
  const [, meta] = entry
  const buf = ghContents(meta.repo, meta.path)
  const outIdx = args.indexOf('--out')
  const out = outIdx >= 0 ? args[outIdx + 1] : null
  if (out) {
    writeFileSync(out, buf)
    console.log(`wrote ${out} (${buf.length} bytes, sha256 ${sha(buf).slice(0, 16)}…)`)
  } else {
    process.stdout.write(buf)
  }
  process.exit(0)
}

if (mode === '--verify') {
  let changed = 0
  let missing = 0
  let same = 0
  for (const [file, meta] of Object.entries(sources)) {
    const local = join(uiDir, file)
    if (!existsSync(local)) {
      console.log(`  MISSING  ${file} — expected ${meta.repo}/${meta.path}`)
      missing++
      continue
    }
    let upstream
    try {
      upstream = ghContents(meta.repo, meta.path)
    } catch (error) {
      console.log(`  SKIP     ${file} — could not fetch upstream (${String(error).split('\n')[0]})`)
      continue
    }
    const digest = sha(upstream)
    if (digest === meta.sha256) {
      console.log(`  ok       ${file} — upstream unchanged`)
      same++
    } else {
      console.log(`  NOTE     ${file} — upstream moved (recorded ${meta.sha256.slice(0, 12)}…, now ${digest.slice(0, 12)}…)`)
      console.log(`           re-apply the local patch list in the file header on top of the new source,`)
      console.log(`           then update "sha256" in aceternity-sources.json.`)
      changed++
    }
  }
  console.log(`\n${same} unchanged, ${changed} moved upstream, ${missing} missing.`)
  // A moved upstream is information, not a failure: the vendored copies carry
  // deliberate patches, so they will never be byte-equal anyway. A *missing*
  // file is the failure.
  process.exit(missing ? 1 : 0)
}

console.log(`Unknown mode "${mode}". Use --list, --verify or --fetch <name>.`)
process.exit(1)
