#!/usr/bin/env node
// Research Engine — single-process launcher.
//   ./research-engine serve --port 3847 --profile eco
// Uses the bundled dist build when present, otherwise falls back to tsx (dev trees).
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dist = join(root, 'dist', 'index.js')
const bundled = join(root, 'server', 'index.js')
const frontendDist = join(root, 'frontend-dist')

if (existsSync(dist)) {
  await import(dist)
} else if (existsSync(bundled)) {
  // Packaged tree: `bin/` sits beside the bundled `server/`, and the frontend is
  // the sibling `frontend-dist/`. The `research-engine` script at the root is the
  // documented entry point, but this file is what it calls, so make the two agree
  // when someone runs `node bin/research-engine.mjs` in an extracted archive.
  if (!process.env.FRONTEND_DIST && existsSync(join(frontendDist, 'index.html'))) {
    process.env.FRONTEND_DIST = frontendDist
  }
  await import(bundled)
} else {
  // Dev tree: run under tsx if available. Check the backend-local install
  // first, then the hoisted workspace root (npm workspaces lift packages up).
  const tsxCli = [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join(root, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ].find((p) => existsSync(p))
  if (!tsxCli) {
    console.error('research-engine: no bundled dist and no tsx available — run `npm install` or build the backend bundle.')
    process.exit(1)
  }
  const child = spawn(process.execPath, [
    tsxCli,
    join(root, 'src', 'index.ts'),
    ...process.argv.slice(2),
  ], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}
