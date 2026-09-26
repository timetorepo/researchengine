#!/usr/bin/env node
// Build the Research Engine desktop sidecar.
//
// The desktop app is a thin Tauri shell around the local Research Engine
// server: the shell spawns this binary, waits for it to answer on loopback and
// only then points the window at it. So the sidecar has to run on a machine
// with NO Node and NO npm — a single self-contained executable.
//
// Bun compiles exactly that, and it cross-compiles, so a Windows `.exe` can be
// produced on Linux or macOS CI:
//
//   node scripts/desktop-sidecar.mjs --target win-x64
//   node scripts/desktop-sidecar.mjs --target linux-x64
//
// If Bun is unavailable the script falls back to the portable Node folder
// (backend/dist + prod node_modules + frontend dist) and says so — that variant
// needs Node 20+ installed on the target machine.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// fileURLToPath, not `.pathname`: on Windows the latter yields "/D:/…", which
// every join() then mangles into a path that does not exist.
const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const flag = (name, fallback = null) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? true) : fallback)

// Rust target triples Tauri expects in `externalBin` file names.
const TRIPLES = {
  'win-x64': 'x86_64-pc-windows-msvc',
  'win-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
}
const hostTarget = () => {
  if (process.platform === 'win32') return process.arch === 'arm64' ? 'win-arm64' : 'win-x64'
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
}
const target = flag('--target', hostTarget())
const triple = TRIPLES[target]
if (!triple) {
  console.error(`unknown --target ${target}; expected one of ${Object.keys(TRIPLES).join(', ')}`)
  process.exit(2)
}
const isWin = target.startsWith('win')
const outDir = resolve(root, flag('--out', 'desktop/src-tauri/binaries'))
const outFile = join(outDir, `research-engine-${triple}${isWin ? '.exe' : ''}`)
// No shell, ever: `execSync` dies on a runner whose shell has no ComSpec, and
// Node ≥ 20 refuses to spawn npm.cmd directly on Windows (EINVAL). So npm is
// reached as a JS entry point through the running node binary.
const run = (file, args, cwd = root) => {
  console.log(`$ ${file} ${args.join(' ')}`)
  execFileSync(file, args, { cwd, stdio: 'inherit' })
}
const npmCli = () => {
  const candidates = [
    process.env.npm_execpath,
    join(process.env.npm_prefix ?? '', 'node_modules/npm/bin/npm-cli.js'),
    join(process.env.APPDATA ?? '', 'npm/node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean)
  return candidates.find((p) => { try { return existsSync(p) && p.endsWith('.js') } catch { return false } })
}
const runNpm = (args) => {
  if (process.platform !== 'win32') return run('npm', args)
  const cli = npmCli()
  if (!cli) {
    throw new Error(`cannot find npm-cli.js to run \"npm ${args.join(' ')}\" — run it yourself, then re-run this script`)
  }
  return run(process.execPath, [cli, ...args])
}

// 1. Both halves must exist before anything is packaged.
if (flag('--rebuild', false) || !existsSync(join(root, 'frontend/dist/index.html'))) runNpm(['run', 'build', '--workspace', 'frontend'])
if (flag('--rebuild', false) || !existsSync(join(root, 'backend/dist/index.js'))) runNpm(['run', 'build', '--workspace', 'backend'])

mkdirSync(outDir, { recursive: true })

// 2. Find Bun: BUN env var, then PATH, then a local install.
const findBun = () => {
  const win = process.platform === 'win32'
  const candidates = [
    process.env.BUN,
    // The npm package ("bun" is a devDependency) ships the real runtime binary
    // as bin/bun.exe on every platform; .bin holds wrapper shims, which are not
    // spawnable without a shell on Windows.
    join(root, 'node_modules/bun/bin', win ? 'bun.exe' : 'bun'),
    join(root, 'node_modules/bun/bin/bun.exe'),
    join(root, 'node_modules/.bin', win ? 'bun.exe' : 'bun'),
    join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.bun/bin', win ? 'bun.exe' : 'bun'),
    'bun',
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      const v = execFileSync(c, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (/^\d+\.\d+/.test(v)) return { bin: c, version: v }
    } catch { /* keep looking */ }
  }
  return null
}
const bun = findBun()

if (bun) {
  console.log(`\n$ sidecar: bun ${bun.version} → ${target} (${triple})`)
  // `--compile` embeds the Bun runtime: the result is one file with no
  // dependencies, which is exactly what an installer needs.
  run(bun.bin, ['build', 'backend/src/index.ts', '--compile', '--minify', `--target=bun-${target}`, '--outfile', outFile])
  if (!isWin) chmodSync(outFile, 0o755)
  const mb = (statSync(outFile).size / 1e6).toFixed(1)
  console.log(`\nsidecar ready: ${outFile} (${mb} MB, self-contained)`)
  writeFileSync(join(outDir, 'README.txt'), sidecarNote(target, triple, 'bun'))
  process.exit(0)
}

// 3. No Bun, no desktop sidecar. A Tauri `externalBin` must be a real
//    executable — a launcher script or a Node folder would produce an installer
//    that cannot start on a machine without Node, which is the whole point.
console.error('\nBun was not found.')
console.error('The desktop app ships the whole local server as ONE self-contained')
console.error('executable, and Bun is the compiler that makes that possible.\n')
console.error('Fix it with either:')
console.error('  npm install                 # "bun" is a devDependency, so this is enough')
console.error('  npm i -D bun                # …or add it explicitly')
console.error('  curl -fsSL https://bun.sh/install | bash    # …or install it system-wide')
console.error('  BUN=/path/to/bun node scripts/desktop-sidecar.mjs\n')
console.error('Need a Node-dependent portable folder instead? Use scripts/package-binary.mjs.')
process.exit(2)

function sidecarNote(target, triple, mode) {
  return `Research Engine desktop sidecar — ${target} (${triple})
Mode: ${mode === 'bun' ? 'single-file executable (no Node required)' : 'portable Node folder (Node 20+ required)'}

Built by scripts/desktop-sidecar.mjs. Tauri copies it next to the app binary;
the shell spawns it on 127.0.0.1:3847 and waits for /api/health before showing
the window. Do not rename the file — the target triple in the name is what
Tauri's \`bundle.externalBin\` matches.
`
}
