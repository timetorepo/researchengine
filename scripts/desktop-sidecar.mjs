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
import { join, resolve } from 'node:path'

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
// No shell: execFile spelling keeps this working on runners whose shell has no
// ComSpec/cmd.exe in its environment (a bash step on Windows, for example).
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (file, args, cwd = root) => {
  console.log(`$ ${file} ${args.join(' ')}`)
  execFileSync(file, args, { cwd, stdio: 'inherit' })
}

// 1. Both halves must exist before anything is packaged.
if (flag('--rebuild', false) || !existsSync(join(root, 'frontend/dist/index.html'))) run(npmBin, ['run', 'build', '--workspace', 'frontend'])
if (flag('--rebuild', false) || !existsSync(join(root, 'backend/dist/index.js'))) run(npmBin, ['run', 'build', '--workspace', 'backend'])

mkdirSync(outDir, { recursive: true })

// 2. Find Bun: BUN env var, then PATH, then a local install.
const findBun = () => {
  const candidates = [process.env.BUN, join(root, 'node_modules/.bin/bun'), 'bun'].filter(Boolean)
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

// 3. Fallback: the portable Node folder. Works offline, needs Node on target.
console.warn('\nwarning: Bun not found — building the portable Node folder instead.')
console.warn('         install it with `npm i -D bun`, or set BUN=/path/to/bun\n')
const dir = join(outDir, `research-engine-${target}`)
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
cpSync(join(root, 'backend/dist'), join(dir, 'server'), { recursive: true })
cpSync(join(root, 'backend/bin'), join(dir, 'bin'), { recursive: true })
cpSync(join(root, 'frontend/dist'), join(dir, 'frontend-dist'), { recursive: true })
const pkg = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8'))
writeFileSync(join(dir, 'server/package.json'), JSON.stringify({
  name: 'research-engine-server', type: 'module', version: pkg.version,
  dependencies: pkg.dependencies, optionalDependencies: pkg.optionalDependencies,
}, null, 2))
writeFileSync(join(outDir, `research-engine-${triple}${isWin ? '.cmd' : ''}`),
  isWin ? `@echo off\r\nnode "%~dp0research-engine-${target}\\bin\\research-engine.mjs" %*\r\n`
        : `#!/bin/sh\nexec node "$(dirname "$0")/research-engine-${target}/bin/research-engine.mjs" "$@"\n`)
writeFileSync(join(outDir, 'README.txt'), sidecarNote(target, triple, 'node'))
console.log(`\nsidecar ready: ${dir} (portable folder + ${isWin ? '.cmd' : 'sh'} launcher)`)

function sidecarNote(target, triple, mode) {
  return `Research Engine desktop sidecar — ${target} (${triple})
Mode: ${mode === 'bun' ? 'single-file executable (no Node required)' : 'portable Node folder (Node 20+ required)'}

Built by scripts/desktop-sidecar.mjs. Tauri copies it next to the app binary;
the shell spawns it on 127.0.0.1:3847 and waits for /api/health before showing
the window. Do not rename the file — the target triple in the name is what
Tauri's \`bundle.externalBin\` matches.
`
}
