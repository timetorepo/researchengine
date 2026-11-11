#!/usr/bin/env node
/**
 * Website vendoring — provenance for everything the marketing site pulls in.
 *
 * The site is deliberately assembled from the three registries the round names
 * (SmoothUI, Aceternity UI, shadcnspace) rather than hand-rolled lookalikes, and
 * `npx shadcn@latest add <registry>/<item>` is the canonical install for all of
 * them. This build environment cannot reach any of those hosts (smoothui.dev,
 * ui.aceternity.com and shadcnspace.com all fail the TLS handshake here), so the
 * files arrive by the same routes the app's own vendors use:
 *
 *   • SmoothUI   — the official registry JSON, reproduced from a checkout of
 *                  github.com/educlopez/smoothui by frontend/scripts/
 *                  smoothui-registry.mjs (same file, same rewrites, same deps).
 *   • Aceternity — a public checkout of the same component, recorded per item.
 *   • shadcnspace— github.com/shadcnspace/shadcnspace, the project's own repo.
 *
 * Every item records the digest of the bytes it was vendored from, the digest of
 * the file as it sits in this repository, and any local patch with the reason it
 * exists. `--verify` re-checks the local digests offline and, when the network
 * allows, re-fetches the upstream copy and reports whether it moved.
 *
 *   node website/scripts/site-vendor.mjs --verify
 *   node website/scripts/site-vendor.mjs --list
 *   node website/scripts/site-vendor.mjs --fetch <registry>/<name> [--out file]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const sourcesPath = join(here, 'site-sources.json')

const args = process.argv.slice(2)
const mode = args[0] ?? '--verify'
const target = args[1]
const outFlag = args.indexOf('--out')

const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'))
const sha = (text) => createHash('sha256').update(text).digest('hex')
const rel = (p) => p.replace(/\\/g, '/')

function ghContents(repo, path, ref) {
  const q = ref ? `?ref=${ref}` : ''
  const out = execFileSync('gh', ['api', `/repos/${repo}/contents/${path}${q}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return Buffer.from(JSON.parse(out).content.replace(/\n/g, ''), 'base64').toString('utf8')
}

if (mode === '--list') {
  console.log('Vendored site components\n')
  for (const item of sources.items) {
    const present = existsSync(join(root, item.file))
    const patch = item.patches.length ? ` (${item.patches.length} patch${item.patches.length > 1 ? 'es' : ''})` : ''
    console.log(`  ${present ? '✓' : '✗'} ${item.id.padEnd(38)} ${item.file}${patch}`)
  }
  console.log(`\n${sources.items.length} components, from ${Object.keys(sources.providers).length} registries.`)
  process.exit(0)
}

if (mode === '--fetch') {
  const item = sources.items.find((i) => i.id === target)
  if (!item) {
    console.error(`no such item: ${target}`)
    console.error(sources.items.map((i) => `  ${i.id}`).join('\n'))
    process.exit(1)
  }
  if (!item.upstream) {
    console.error(`${target} has no upstream checkout to fetch from (${item.note ?? 'see sources'})`)
    process.exit(1)
  }
  const text = ghContents(item.upstream.repo, item.upstream.path, item.upstream.commit)
  if (outFlag !== -1 && args[outFlag + 1]) {
    writeFileSync(args[outFlag + 1], text)
    console.log(`wrote ${text.length} bytes to ${args[outFlag + 1]}`)
  } else {
    process.stdout.write(text)
  }
  process.exit(0)
}

let failed = 0
let moved = 0
let drifted = 0
console.log('Vendored site components\n')
for (const item of sources.items) {
  const path = join(root, item.file)
  if (!existsSync(path)) {
    console.log(`  ✗ ${item.id} — missing ${item.file}`)
    failed++
    continue
  }
  const local = readFileSync(path, 'utf8')
  const localSha = sha(local)
  if (localSha !== item.sha256) {
    console.log(`  ✗ ${item.id} — local file changed since vendoring`)
    console.log(`      recorded ${item.sha256.slice(0, 16)}…  now ${localSha.slice(0, 16)}…`)
    console.log('      re-run with --fetch to see upstream, then update site-sources.json deliberately')
    drifted++
    continue
  }

  let upstreamNote = 'no upstream checkout recorded'
  if (item.upstream) {
    try {
      const upstream = ghContents(item.upstream.repo, item.upstream.path, item.upstream.commit)
      upstreamNote = item.upstream.sha256
        ? sha(upstream) === item.upstream.sha256
          ? `upstream ${item.upstream.repo}@${item.upstream.commit.slice(0, 8)} matches`
          : `upstream moved at ${item.upstream.repo}`
        : `upstream fetched from ${item.upstream.repo}`
      if (item.upstream.sha256 && sha(upstream) !== item.upstream.sha256) moved++
    } catch {
      upstreamNote = `upstream ${item.upstream.repo} unreachable (offline check skipped)`
    }
  }

  console.log(`  ✓ ${item.id}`)
  console.log(`      ${item.file}`)
  console.log(`      local sha256 ${localSha.slice(0, 16)}…  ·  ${upstreamNote}`)
  for (const patch of item.patches) {
    console.log(`      patch: ${patch.what}`)
    console.log(`             ${patch.reason}`)
  }
}

if (failed || drifted) {
  console.log(`\nFAILED — ${failed} missing, ${drifted} changed locally.`)
  process.exit(1)
}
console.log(
  `\nok  ${sources.items.length} files verified against their vendored digests` +
    (moved ? `, ${moved} upstream copies have moved since (informational)` : ''),
)
console.log(`    registries: ${Object.values(sources.providers).map((p) => p.registry.replace('https://', '').replace('/r/{name}.json', '')).join(', ')}`)
