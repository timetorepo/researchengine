#!/usr/bin/env node
/**
 * Everything the site needs at runtime, produced before Vite runs.
 *
 * A static marketing page should not call an API to find out what to offer, and
 * it should not send a visitor to GitHub for the build it can host itself. So
 * this reads the repository it lives in:
 *
 *   • the version          — the root package.json, which the release bumps
 *   • the portable builds  — downloads/research-engine-<version>-<target>.*
 *   • their digests        — downloads/SHA256SUMS
 *   • the installers       — downloads/INSTALLERS.sha256 (name → sha256)
 *
 * and writes `public/release.json` plus copies the portable archives into
 * `public/downloads/`. Netlify then serves the whole thing as files.
 *
 *   node scripts/prepare-assets.mjs [--quiet]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const site = join(here, '..')
const repo = join(site, '..')
const quiet = process.argv.includes('--quiet')
const log = (...a) => { if (!quiet) console.log(...a) }

const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
const version = pkg.version
const tag = `v${version}`
const owner = 'timetorepo'
const repoName = 'researchengine'
const releaseUrl = `https://github.com/${owner}/${repoName}/releases/tag/${tag}`
const assetUrl = (name) => `https://github.com/${owner}/${repoName}/releases/download/${tag}/${name}`

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

/* ------------------------------------------------------------- portables -- */

const portableSpecs = [
  { target: 'linux-x64', file: `research-engine-${version}-linux-x64.tar.gz`, platform: 'Linux x64', format: 'tar.gz' },
  { target: 'win-x64', file: `research-engine-${version}-win-x64.zip`, platform: 'Windows x64', format: 'zip' },
]

const checksums = new Map(
  readIf(join(repo, 'downloads', 'SHA256SUMS'))
    .split('\n')
    .map((line) => line.trim().split(/\s+/).filter(Boolean))
    .filter((parts) => parts.length === 2 && /^[0-9a-f]{64}$/i.test(parts[0]))
    .map(([sum, name]) => [name.replace(/^\*/, ''), sum]),
)

const outDir = join(site, 'public', 'downloads')
mkdirSync(outDir, { recursive: true })

const portables = []
for (const spec of portableSpecs) {
  const from = join(repo, 'downloads', spec.file)
  if (!existsSync(from)) {
    log(`  ! ${spec.file} is not in downloads/ — the portable build for ${spec.platform} will not be offered`)
    continue
  }
  copyFileSync(from, join(outDir, spec.file))
  const bytes = statSync(from).size
  const digest =
    checksums.get(spec.file) ??
    createHash('sha256').update(readFileSync(from)).digest('hex')
  portables.push({
    name: spec.file,
    href: `/downloads/${spec.file}`,
    platform: spec.platform,
    format: spec.format,
    bytes,
    sha256: digest,
    selfHosted: true,
  })
  log(`  ✓ ${spec.file} — ${(bytes / 1024 / 1024).toFixed(1)} MB, sha256 ${digest.slice(0, 12)}…`)
}

/* ------------------------------------------------------------ installers -- */

const kindOf = (name) =>
  /setup\.exe$/i.test(name) ? 'windows' : /\.deb$/i.test(name) ? 'deb' : /\.AppImage$/i.test(name) ? 'appimage' : 'other'
const platformOf = (kind) =>
  kind === 'windows' ? 'Windows 10/11 x64' : kind === 'deb' ? 'Debian / Ubuntu x64' : kind === 'appimage' ? 'Any x64 Linux' : 'Desktop'

const installers = []
const lines = readIf(join(repo, 'downloads', 'INSTALLERS.sha256')).split('\n')
for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 2 || !/^[0-9a-f]{64}$/i.test(parts[0])) continue
  const name = parts[1]
  if (!name.includes(version)) continue
  const kind = kindOf(name)
  installers.push({ name, href: assetUrl(name), kind, platform: platformOf(kind), sha256: parts[0] })
}

// Sizes for the installers, from the table downloads/README.md keeps current.
// Absent is a normal state (a release whose CI has not finished yet), so the
// site simply does not promise a number it cannot back.
const readme = readIf(join(repo, 'downloads', 'README.md'))
for (const installer of installers) {
  const row = readme.split('\n').find((l) => l.includes(installer.name))
  const size = row?.split('|').map((c) => c.trim()).filter(Boolean).pop() ?? ''
  installer.size = /^\d+(\.\d+)?\s*(KB|MB|GB)$/i.test(size) ? size : ''
}

installers.sort((a, b) => ['windows', 'deb', 'appimage'].indexOf(a.kind) - ['windows', 'deb', 'appimage'].indexOf(b.kind))

/* ------------------------------------------------------------ the release -- */

const release = {
  version,
  tag,
  repo: `${owner}/${repoName}`,
  releaseUrl,
  sourceUrl: `https://github.com/${owner}/${repoName}`,
  licenseUrl: `https://github.com/${owner}/${repoName}/blob/main/LICENSE`,
  notesUrl: releaseUrl,
  docsUrl: `https://github.com/${owner}/${repoName}/blob/main/docs/install.md`,
  generated: new Date().toISOString(),
  license: 'MIT',
  installers,
  portables,
  requirements: {
    installers: 'Windows 10/11 x64, or a Debian/Ubuntu-style 64-bit Linux',
    portables: 'Node.js 20 or newer, nothing else',
  },
}

writeFileSync(join(site, 'public', 'release.json'), JSON.stringify(release, null, 2) + '\n')
log(`\n  release.json → ${version}: ${installers.length} installer(s), ${portables.length} portable build(s)`)
if (!installers.length) log('  ! no installer digests for this version yet — the page will offer the portables and the release page')
