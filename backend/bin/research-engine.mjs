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

if (existsSync(dist)) {
  await import(dist)
} else {
  // Dev tree: run under tsx if available
  const child = spawn(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join(root, 'src', 'index.ts'),
    ...process.argv.slice(2),
  ], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}
