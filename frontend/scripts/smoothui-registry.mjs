#!/usr/bin/env node
/**
 * Build a local mirror of the SmoothUI shadcn registry.
 *
 * Why this exists: `npx shadcn add @smoothui/...` fetches each item from
 * `https://smoothui.dev/r/<name>.json`, and this build environment can only
 * reach the npm registry and github.com. The component sources themselves come
 * from the official SmoothUI monorepo, so this reproduces the exact JSON the
 * site's route handler (`apps/docs/app/r/[component]/route.ts` →
 * `apps/docs/lib/package.ts`) serves for each item: same source files, same
 * import rewrites, same dependency detection.
 *
 *   node frontend/scripts/smoothui-registry.mjs \
 *     --source /tmp/smoothui \            # a checkout of github.com/educlopez/smoothui
 *     --out /tmp/smoothui-registry \      # where the .json items are written
 *     --host http://127.0.0.1:8797        # what absolute registry URLs are rewritten to
 *
 * Then serve `--out` at `--host/r/<name>.json` and point `components.json`'s
 * `@smoothui` registry at it. On a machine that can reach smoothui.dev, none of
 * this is needed — the committed components.json uses the real host.
 *
 * Upstream is pinned so an install is reproducible; see SMOOTHUI_COMMIT in
 * docs/development.md.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback = null) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? fallback) : fallback)
const source = resolve(arg('--source', '/tmp/smoothui'))
const out = resolve(arg('--out', '/tmp/smoothui-registry'))
const host = (arg('--host', 'http://127.0.0.1:8797') || '').replace(/\/$/, '')

const UPSTREAM_REGISTRY = 'https://smoothui.dev/r'
const packagesRoot = join(source, 'packages', 'smoothui')

/* ------------------------------------------------------------ rewrites ---- */

// Exactly the replacements the site's registry applies, so an installed file is
// byte-identical to what a real `shadcn add @smoothui/x` would write.
const REWRITES = [
  [/@repo\/shadcn-ui\/lib\/utils/g, '@/lib/utils'],
  [/@repo\/shadcn-ui\/components\/ui\//g, '@/components/ui/'],
  [/@repo\/smoothui\/components\//g, '@/components/smoothui/'],
  [/@smoothui\/data/g, '@/lib/smoothui-data'],
  [/(?:\.\.\/)+lib\/animation/g, '@/components/smoothui/lib/animation'],
  [/from\s+["'](?:\.\.\/)+shared["']/g, 'from "@/components/smoothui/shared"'],
]
const rewrite = (code) => REWRITES.reduce((acc, [re, to]) => acc.replace(re, to), code)

const FILTERED_DEPS = new Set(['react', 'react-dom', '@repo/shadcn-ui', '@smoothui/data'])
const FILTERED_DEV_DEPS = new Set(['@repo/typescript-config', '@types/react', '@types/react-dom', 'typescript'])
const SKIP_PACKAGES = new Set(['shadcn-ui', 'typescript-config', 'patterns'])
const WORKSPACE_ALIASES = new Map([['blocks-shared', 'shared']])
// Tokens a component can only resolve against the SmoothUI token item.
const TOKEN_NAMES = ['brand', 'smooth-', 'amber', 'blue', 'green', 'red', 'purple']

/* ---------------------------------------------------------------- items --- */

/** Every directory under packages/smoothui that carries a package.json. */
function collect(rel = '') {
  const dir = join(packagesRoot, rel)
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const next = rel ? `${rel}/${entry.name}` : entry.name
    const hasPkg = (() => { try { return statSync(join(packagesRoot, next, 'package.json')).isFile() } catch { return false } })()
    if (hasPkg) found.push(next)
    else found.push(...collect(next))
  }
  return found
}

const titleCase = (name) => name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function buildItem(packageName) {
  const dir = join(packagesRoot, packageName)
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const actual = packageName.split('/').at(-1)
  const entries = readdirSync(dir, { withFileTypes: true })
  const sourceFiles = entries.filter((f) => f.isFile()
    && !f.name.includes('.config.')
    && (f.name.endsWith('.tsx') || (f.name.endsWith('.ts') && !f.name.endsWith('.d.ts'))))
  const cssModules = entries.filter((f) => f.isFile() && f.name.endsWith('.module.css'))
  const cssFiles = entries.filter((f) => f.isFile() && f.name.endsWith('.css') && !f.name.endsWith('.module.css'))
  if (!sourceFiles.length && !cssFiles.length) return null

  const deps = pkg.dependencies ?? {}
  const smoothuiDeps = Object.keys(deps).filter((d) => d.startsWith('@repo') && d !== '@repo/shadcn-ui')
  const dependencies = Object.keys(deps).filter((d) => !FILTERED_DEPS.has(d) && !smoothuiDeps.includes(d))
  const devDependencies = Object.keys(pkg.devDependencies ?? {}).filter((d) => !FILTERED_DEV_DEPS.has(d))

  const isData = packageName === 'data'
  const isSharedLib = packageName === 'smoothui/blocks/shared'
  const isBlock = (packageName.startsWith('blocks/') && !isSharedLib) || packageName.startsWith('templates/')
  const fileType = isData || packageName === 'lib' ? 'registry:lib' : isBlock ? 'registry:block' : isSharedLib ? 'registry:component' : 'registry:ui'
  const target = (file) => (isData ? `lib/smoothui-data/${file}` : `components/smoothui/${actual}/${file}`)

  const files = [...sourceFiles, ...cssModules].map((f) => {
    const content = readFileSync(join(dir, f.name), 'utf8')
    return {
      path: f.name,
      content: f.name.endsWith('.css') ? content : rewrite(content),
      type: fileType,
      target: target(f.name),
    }
  })

  const all = files.map((f) => f.content).join('\n')
  const registryDependencies = new Set()
  // shadcn primitives, by name (`button`, `tooltip`, …)
  for (const m of all.matchAll(/@\/components\/ui\/([a-z-]+)/g)) registryDependencies.add(m[1])
  // other SmoothUI items, by absolute URL — rewritten to the mirror below
  for (const dep of smoothuiDeps) {
    const raw = dep.replace('@repo/', '')
    const name = WORKSPACE_ALIASES.get(raw) ?? raw
    if (name !== actual) registryDependencies.add(`${UPSTREAM_REGISTRY}/${name}.json`)
  }
  for (const m of all.matchAll(/from\s+["']\.\.\/([a-z0-9-]+)["']/g)) {
    if (m[1] !== actual) registryDependencies.add(`${UPSTREAM_REGISTRY}/${m[1]}.json`)
  }
  for (const m of all.matchAll(/@\/components\/smoothui\/([a-z0-9-]+)/g)) {
    if (m[1] !== actual) registryDependencies.add(`${UPSTREAM_REGISTRY}/${m[1]}.json`)
  }
  if (!isData && /@\/lib\/smoothui-data/.test(all)) registryDependencies.add(`${UPSTREAM_REGISTRY}/data.json`)
  if (TOKEN_NAMES.some((t) => all.includes(t))) registryDependencies.add(`${UPSTREAM_REGISTRY}/tokens.json`)

  // CSS files are folded into the item's `css` map upstream; ours are written
  // out as files instead (see the note in the module header of the test that
  // greps for this), so an item with only CSS still installs something.
  const css = {}
  for (const f of cssFiles) css[f.name] = readFileSync(join(dir, f.name), 'utf8')

  const href = (url) => url.replace(UPSTREAM_REGISTRY, `${host}/r`)
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    author: 'Eduardo Calvo <educlopez93@gmail.com>',
    css,
    dependencies: dependencies.map(href),
    description: pkg.description,
    devDependencies,
    files,
    name: actual,
    registryDependencies: [...registryDependencies].map(href),
    title: titleCase(actual),
    type: cssFiles.length && !files.length ? 'registry:style' : fileType,
  }
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

let written = 0
const index = []
for (const name of collect()) {
  const short = name.split('/').at(-1)
  if (SKIP_PACKAGES.has(short)) continue
  const item = buildItem(name)
  if (!item) continue
  writeFileSync(join(out, `${short}.json`), `${JSON.stringify(item, null, 2)}\n`)
  index.push({ name: short, type: item.type })
  written++
}

/*
 * `tokens` is not a package: the site builds it in code
 * (`apps/docs/lib/registry-tokens.ts` → `getTokensItem()`), and 36 shipped
 * items depend on it for the `brand` accent and the `smooth-*` ramp. Rather
 * than re-declare the palette here and let the two drift, the item is generated
 * by importing that same function with tsx.
 */
const tokensItemPath = join(source, 'apps/docs/lib/registry-tokens.ts')
if (existsSync(tokensItemPath)) {
  const helper = join(out, '.gen-tokens.mts')
  const tokensOut = join(out, 'tokens.json')
  writeFileSync(helper, [
    "import { writeFileSync } from 'node:fs'",
    `const mod: any = await import(${JSON.stringify(tokensItemPath)})`,
    `writeFileSync(${JSON.stringify(tokensOut)}, JSON.stringify(mod.getTokensItem(), null, 2))`,
    '',
  ].join('\n'))
  try {
    execFileSync('npx', ['tsx', helper], { stdio: 'pipe' })
    console.log('tokens.json generated from registry-tokens.ts')
  } catch (e) {
    console.warn('could not generate tokens.json (needs tsx):', String(e?.message ?? e))
  }
  rmSync(helper, { force: true })
} else {
  console.warn('no apps/docs/lib/registry-tokens.ts in --source; tokens.json not generated')
}

// The item the site serves from code rather than from a package dir.
writeFileSync(join(out, 'registry.json'), `${JSON.stringify({
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  homepage: 'https://smoothui.dev/',
  name: 'SmoothUI Registry',
  items: index,
}, null, 2)}\n`)

console.log(`smoothui mirror: ${written} items → ${out} (host ${host})`)
