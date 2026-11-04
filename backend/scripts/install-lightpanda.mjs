#!/usr/bin/env node
// Installs Lightpanda (https://github.com/lightpanda-io/browser) for headless
// browsing. It asks the GitHub API for the latest release, picks the binary for
// this machine, and puts it where the backend looks: next to the database, in
// bin/lightpanda.
//
//   node backend/scripts/install-lightpanda.mjs            install
//   node backend/scripts/install-lightpanda.mjs --dry-run  show what would be fetched
//   node backend/scripts/install-lightpanda.mjs --force    reinstall
//
// Lightpanda publishes Linux and macOS binaries only. On Windows, run it under
// WSL, or point LIGHTPANDA_BIN at a binary you have built yourself.
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const REPO = 'lightpanda-io/browser'
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const force = args.has('--force')

/** The release asset name for this machine, or null when there is none. */
export function assetFor(platform = process.platform, arch = process.arch) {
  const cpu = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : null
  if (!cpu) return null
  if (platform === 'linux') return `lightpanda-${cpu}-linux`
  if (platform === 'darwin') return `lightpanda-${cpu}-macos`
  return null
}

/** Where the backend looks for the binary. Mirrors lightpandaInstallDir() in the backend. */
export function installDir(env = process.env) {
  const dbPath = env.DB_PATH ?? './research-engine.db'
  const base = dirname(dbPath) === '.' ? join(homedir(), '.local', 'share', 'research-engine') : dirname(dbPath)
  return join(base, 'bin')
}

async function latestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'research-engine-installer' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for the latest Lightpanda release.`)
  return res.json()
}

async function main() {
  const asset = assetFor()
  if (!asset) {
    console.error(`Lightpanda has no binary for ${process.platform}/${process.arch}. On Windows use WSL, or set LIGHTPANDA_BIN.`)
    process.exit(1)
  }
  const dir = installDir()
  const target = join(dir, 'lightpanda')
  if (existsSync(target) && !force && !dryRun) {
    console.log(`Lightpanda is already installed at ${target}. Use --force to reinstall.`)
    return
  }

  const release = await latestRelease()
  const hit = (release.assets ?? []).find((a) => a.name === asset)
  if (!hit) throw new Error(`The ${release.tag_name} release has no ${asset} file.`)
  console.log(`Lightpanda ${release.tag_name}: ${asset} (${Math.round(hit.size / 1048576)} MB)`)
  console.log(`From: ${hit.browser_download_url}`)
  console.log(`To:   ${target}`)
  if (dryRun) return

  const res = await fetch(hit.browser_download_url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) })
  if (!res.ok) throw new Error(`The download answered ${res.status}.`)
  mkdirSync(dir, { recursive: true })
  const tmp = `${target}.${process.pid}.part`
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  chmodSync(tmp, 0o755)
  renameSync(tmp, target)

  // Ask the new binary for its version, so a wrong download fails here, not in a chat.
  try {
    const out = execFileSync(target, ['version'], { encoding: 'utf8', timeout: 15_000 }).trim()
    console.log(`Installed. ${out.split('\n')[0]}`)
  } catch (e) {
    throw new Error(`The downloaded file would not run: ${e.message}`)
  }
}

main().catch((e) => {
  console.error(`Lightpanda was not installed: ${e.message}`)
  process.exit(1)
})
