#!/usr/bin/env node
// Dev loop: Vite (HMR frontend on :5173) + backend API (:8787) side by side.
// No extra dependency — plain child processes with prefixed output.
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const procs = []
const colors = { backend: '\x1b[36m', frontend: '\x1b[35m', reset: '\x1b[0m' }

function run(name, cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
  const tag = `${colors[name]}[${name}]${colors.reset} `
  const pipe = (stream, out) => stream.on('data', (d) => out.write(String(d).split('\n').filter(Boolean).map((l) => tag + l).join('\n') + '\n'))
  pipe(p.stdout, process.stdout)
  pipe(p.stderr, process.stderr)
  p.on('exit', (code) => { console.log(`${tag}exited (${code})`); shutdown(code ?? 1) })
  procs.push(p)
}

function shutdown(code) {
  for (const p of procs) try { p.kill('SIGTERM') } catch {}
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('backend', 'npm', ['run', 'dev'], fileURLToPath(new URL('../backend', import.meta.url)))
run('frontend', 'npm', ['run', 'dev'], fileURLToPath(new URL('../frontend', import.meta.url)))
console.log('Research Engine dev — frontend :5173 (proxies /api → :8787)')
