#!/usr/bin/env node
// Package Research Engine as a distributable native artifact.
//
// Preferred path (single self-contained executable): Bun compile.
//   1. install Bun (https://bun.sh)
//   2. node scripts/package-binary.mjs --bun
//
// Default path (portable folder, no Bun needed): a launcher + bundled backend
// + built frontend, runnable with any Node 20+ on the target machine.
//
//   node scripts/package-binary.mjs [--out release] [--rebuild]
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const outDir = resolve(root, args[args.indexOf('--out') + 1] ?? 'release')
const rebuild = args.includes('--rebuild')
const useBun = args.includes('--bun')
const platform = `${process.platform}-${process.arch}`

const sh = (cmd, cwd = root) => { console.log(`$ ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }) }

// 1. Build both halves
if (rebuild || !existsSync(join(root, 'frontend/dist/index.html'))) sh('npm run build --workspace frontend')
if (rebuild || !existsSync(join(root, 'backend/dist/index.js'))) sh('npm run build --workspace backend')

if (useBun) {
  // Single-file executable: frontend dist is served from a path next to the binary.
  const target = join(outDir, process.platform === 'win32' ? 'research-engine.exe' : 'research-engine')
  mkdirSync(outDir, { recursive: true })
  sh(`bun build backend/src/index.ts --compile --minify --outfile ${target}`)
  cpSync(join(root, 'frontend/dist'), join(outDir, 'frontend-dist'), { recursive: true })
  writeFileSync(join(outDir, 'README.txt'),
    `Research Engine — portable binary (${platform})\n\nRun:\n  ./research-engine serve --port 3847\n\nSet FRONTEND_DIST=./frontend-dist if the binary cannot find the frontend automatically.\n`)
  console.log(`\nPackaged: ${target}`)
  process.exit(0)
}

// Portable Node folder
const dir = join(outDir, `research-engine-${platform}`)
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
cpSync(join(root, 'backend/dist'), join(dir, 'server'), { recursive: true })
cpSync(join(root, 'backend/bin'), join(dir, 'bin'), { recursive: true })
cpSync(join(root, 'frontend/dist'), join(dir, 'frontend-dist'), { recursive: true })

// The bundle keeps its npm deps external — ship the production node_modules
// so the artifact is fully self-contained (no install step on the target).
const pkg = JSON.parse((await import('node:fs')).readFileSync(join(root, 'backend/package.json'), 'utf8'))
writeFileSync(join(dir, 'server/package.json'), JSON.stringify({
  name: 'research-engine-server', type: 'module', version: pkg.version,
  dependencies: pkg.dependencies, optionalDependencies: pkg.optionalDependencies,
}, null, 2))
if (existsSync(join(root, 'backend/node_modules'))) {
  cpSync(join(root, 'backend/node_modules'), join(dir, 'server/node_modules'), { recursive: true })
} else {
  console.warn('warning: backend/node_modules missing — run `npm install` in backend/ first')
}

// Launcher that finds node on PATH
const launcher = process.platform === 'win32'
  ? '@echo off\r\nnode "%~dp0server\\index.js" serve --frontend-dist "%~dp0frontend-dist" %*\r\n'
  : '#!/usr/bin/env sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/server/index.js" serve --frontend-dist "$DIR/frontend-dist" "$@"\n'
writeFileSync(join(dir, process.platform === 'win32' ? 'research-engine.cmd' : 'research-engine'), launcher)
chmodSync(join(dir, process.platform === 'win32' ? 'research-engine.cmd' : 'research-engine'), 0o755)

writeFileSync(join(dir, 'README.txt'),
  `Research Engine — portable build (${platform})

Requires Node.js 20+ on this machine (https://nodejs.org). For a fully
self-contained executable, rebuild with Bun: node scripts/package-binary.mjs --bun

Run:
  ./research-engine serve --port 3847

Then open http://127.0.0.1:3847

Data directory: ~/.research-engine (override with RESEARCH_ENGINE_DATA_DIR)
Profiles: ./research-engine serve --profile eco|balanced|performance
`)

console.log(`\nPackaged portable build: ${dir}`)
console.log(`Try it:  ${join(dir, 'research-engine')} serve --port 3847`)
