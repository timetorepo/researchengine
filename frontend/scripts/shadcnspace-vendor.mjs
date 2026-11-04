#!/usr/bin/env node
/**
 * shadcnspace vendoring — the five blocks this round uses, from the same
 * registry `npx shadcn@latest add @shadcn-space/<name>` reads.
 *
 * The canonical install, on a machine that can reach shadcnspace.com:
 *
 *   npx shadcn@latest add @shadcn-space/animated-list-02
 *   npx shadcn@latest add @shadcn-space/badge-13
 *   npx shadcn@latest add @shadcn-space/button-28
 *   npx shadcn@latest add @shadcn-space/button-group-12
 *   npx shadcn@latest add @shadcn-space/button-group-10
 *
 * This copy comes from the project's own public checkout (MIT), because the
 * build machine cannot open shadcnspace.com over the network. The files below
 * are byte-for-byte what the registry serves, with line endings normalised to
 * LF because that is what this repository uses; `--verify` re-checks every
 * digest in `shadcnspace-sources.json` and fails if a vendored file is edited,
 * missing, or new and unnamed.
 *
 *   node frontend/scripts/shadcnspace-vendor.mjs --verify
 *   node frontend/scripts/shadcnspace-vendor.mjs --fetch       (HTTPS)
 *   node frontend/scripts/shadcnspace-vendor.mjs --fetch-gh    (through `gh`)
 *
 * The five blocks also need five primitives from the same checkout (button,
 * badge, button-group, dropdown-menu, separator). Those are the Base UI flavour
 * of shadcn/ui, so `@base-ui/react` is a dependency of this app.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifestPath = join(here, 'shadcnspace-sources.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const norm = (text) => text.replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n'

function targets() {
  const list = []
  for (const [name, item] of Object.entries(manifest.items)) {
    for (const [target, sha256] of Object.entries(item.files)) list.push({ name, target, sha256 })
  }
  for (const [target, sha256] of Object.entries(manifest.primitives)) list.push({ name: 'primitive', target, sha256 })
  return list
}

function verify() {
  let bad = 0
  const seen = new Set()
  for (const { name, target, sha256 } of targets()) {
    const abs = join(root, target)
    seen.add(target)
    if (!existsSync(abs)) {
      console.error(`missing   ${target}  (${name})`)
      bad++
      continue
    }
    const got = sha(readFileSync(abs, 'utf8'))
    if (got !== sha256) {
      console.error(`changed   ${target}  (${name})`)
      console.error(`          expected ${sha256}`)
      console.error(`          found    ${got}`)
      bad++
    }
  }
  // Anything vendored but unnamed is a file that will drift unnoticed.
  for (const dir of manifest.watch) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const file of walk(base)) {
      const rel = relative(root, file).split('\\').join('/')
      if (!seen.has(rel)) {
        console.error(`unlisted  ${rel}  (not in shadcnspace-sources.json)`)
        bad++
      }
    }
  }
  // A patch is still a deviation, so it is printed even when the digests pass:
  // the reader can see exactly which file is not byte-for-byte upstream and why.
  for (const item of Object.values(manifest.items)) {
    for (const [target, patch] of Object.entries(item.patches ?? {})) {
      console.log(`patched   ${target}`)
      console.log(`          ${patch.reason}`)
    }
  }
  if (bad) {
    console.error(`\nFAILED: ${bad} problem${bad === 1 ? '' : 's'} — the vendored blocks no longer match upstream.`)
    process.exit(1)
  }
  console.log(`ok  ${targets().length} files match upstream ${manifest.upstream.repo}@${manifest.upstream.commit}`)
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) yield* walk(abs)
    else if (/\.tsx?$/.test(entry)) yield abs
  }
}

const write = (target, content) => {
  const abs = join(root, target)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, norm(content), 'utf8')
  return sha(readFileSync(abs, 'utf8'))
}

/** The registry's own JSON → the files it would install. */
async function fetchItems(api) {
  for (const [name, item] of Object.entries(manifest.items)) {
    const json = JSON.parse(await api(manifest.registry.replace('{name}', name)))
    item.title = json.title
    item.files = {}
    for (const file of json.files) {
      const target = file.target ? `src/${file.target}` : `src/${file.path}`
      item.files[target] = write(target, file.content)
    }
    console.log(`fetched ${name}`)
  }
}

/** The primitives the blocks depend on, straight out of the same checkout. */
async function fetchPrimitives(api) {
  manifest.primitives = {}
  for (const path of manifest.primitivePaths) {
    const target = `src/${path}`
    manifest.primitives[target] = write(target, await api(manifest.raw.replace('{path}', path)))
    console.log(`fetched ${path}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--verify') || args.length === 0) return verify()

  if (args.includes('--fetch')) {
    const api = async (url) => {
      const res = await fetch(url, { headers: { 'user-agent': 'researchengine-vendor' } })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return res.text()
    }
    await fetchItems(api)
    await fetchPrimitives(api)
  } else if (args.includes('--fetch-gh')) {
    // Same bytes, through the GitHub contents API — the route that works from a
    // sandbox where only registry.npmjs.org and api.github.com are reachable.
    const api = async (url) => {
      const path = url.replace(manifest.raw.split('{path}')[0], '').replace(/\?.*$/, '')
      const json = JSON.parse(execFileSync('gh', ['api', `repos/${manifest.upstream.repo}/contents/${path}?ref=${manifest.upstream.commit}`], { encoding: 'utf8' }))
      return Buffer.from(json.content, 'base64').toString('utf8')
    }
    await fetchItems(async (url) => {
      const path = url.replace(manifest.registry.replace('{name}', ''), 'public/r/')
      const json = JSON.parse(execFileSync('gh', ['api', `repos/${manifest.upstream.repo}/contents/${path}.json?ref=${manifest.upstream.commit}`], { encoding: 'utf8' }))
      return Buffer.from(json.content, 'base64').toString('utf8')
    })
    await fetchPrimitives(api)
  } else {
    console.error('usage: shadcnspace-vendor.mjs [--verify | --fetch | --fetch-gh]')
    process.exit(2)
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`\nwrote ${relative(root, manifestPath)}`)
  verify()
}

await main()
