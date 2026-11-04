#!/usr/bin/env node
/**
 * The JSON guarantee, tested against a real server.
 *
 * The bug this pins down: the Library asked the server for
 * /api/library/search?q=javascript&refresh=1 and was told "the server answered
 * with something that was not JSON". The server that answered was a build
 * without that route, and because a built frontend was being served, the SPA
 * catch-all replied to the API path with index.html and a 200. res.ok was true,
 * res.json() threw, and the message named nothing.
 *
 * So this test starts the real server — with a real index.html behind it, which
 * is the part that made the failure possible — and asserts:
 *
 *   1. the Library search route answers JSON for the exact reported URL,
 *   2. an unknown /api path answers JSON with a 404 and a sentence, not HTML,
 *   3. a method mismatch on an API path still answers JSON,
 *   4. the app shell is still served for non-API paths (the fallback still works).
 *
 * Run: node backend/scripts/api-json-test.mjs   (or npm run api:json-test)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = 8900 + Math.floor(Math.random() * 90)

const tmp = mkdtempSync(join(tmpdir(), 're-json-test-'))
const dataDir = join(tmp, 'data')
const distDir = join(tmp, 'dist')
mkdirSync(dataDir, { recursive: true })
mkdirSync(distDir, { recursive: true })
// The thing that made the original failure possible: a served app shell that
// answers any GET it does not understand.
writeFileSync(join(distDir, 'index.html'), '<!doctype html><html><head><title>Research Engine</title></head><body><div id="root"></div></body></html>\n')
writeFileSync(join(distDir, 'build-info.json'), JSON.stringify({ version: '0.0.0-test', buildId: 'test+build', builtAt: new Date().toISOString() }))

const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : `\n        ${detail}`}`)
}

const server = spawn('npx', ['tsx', 'src/index.ts', 'serve', '--port', String(PORT), '--data-dir', dataDir, '--frontend-dist', distDir], {
  cwd: here, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' },
})
let serverLog = ''
server.stdout.on('data', (d) => { serverLog += d.toString() })
server.stderr.on('data', (d) => { serverLog += d.toString() })

const waitForServer = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`)
      if (res.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/** Fetch and report the content type plus whether the body parsed as JSON. */
const probe = async (path, init) => {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, init)
  const type = res.headers.get('content-type') ?? ''
  const body = await res.text()
  let json = null
  let parsed = false
  try { json = JSON.parse(body); parsed = true } catch { /* not JSON */ }
  return { status: res.status, type, body, json, parsed }
}

let exitCode = 0
try {
  const up = await waitForServer()
  if (!up) {
    console.error('The server never came up. Log:\n' + serverLog.slice(-2000))
    process.exit(1)
  }
  console.log(`\nserver up on :${PORT} with an app shell behind it\n`)

  // 1 — the reported URL.
  const search = await probe('/api/library/search?q=javascript&refresh=1')
  check('library search answers 200', search.status === 200, `status ${search.status}`)
  check('library search is application/json', search.type.includes('json'), `content-type ${search.type || '(none)'}`)
  check('library search body parses and carries hits', search.parsed && Array.isArray(search.json?.hits), search.body.slice(0, 200))
  check('library search names its lanes', Array.isArray(search.json?.sources) && search.json.sources.length === 2, search.body.slice(0, 200))

  // 2 — an API path this build does not have. This is the case that used to
  // answer with index.html and a 200.
  const missing = await probe('/api/library/definitely-not-a-route')
  check('unknown API path answers 404', missing.status === 404, `status ${missing.status}`)
  check('unknown API path is application/json', missing.type.includes('json'), `content-type ${missing.type || '(none)'} — body began: ${missing.body.slice(0, 120)}`)
  check('unknown API path explains itself', missing.parsed && missing.json?.code === 'no_such_route' && /no route/i.test(missing.json?.error ?? ''), missing.body.slice(0, 200))
  check('unknown API path never returns the app shell', !/<!doctype html/i.test(missing.body), missing.body.slice(0, 120))

  // 3 — the same guarantee for a wrong method.
  const wrongMethod = await probe('/api/library/search', { method: 'DELETE' })
  check('wrong method on an API path answers JSON', wrongMethod.type.includes('json') && wrongMethod.status === 404, `${wrongMethod.status} ${wrongMethod.type} ${wrongMethod.body.slice(0, 120)}`)

  // 4 — the SPA fallback still works for a real page request.
  const page = await probe('/some/app/route')
  check('the app shell is still served for page paths', page.status === 200 && /<!doctype html/i.test(page.body), `${page.status} ${page.type}`)

  // 5 — the health endpoint the About tab reads.
  const health = await probe('/api/health')
  check('health answers JSON', health.status === 200 && health.parsed, `${health.status} ${health.body.slice(0, 120)}`)
} catch (e) {
  console.error('\ntest threw:', e)
  exitCode = 1
} finally {
  server.kill('SIGTERM')
  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* best effort */ }
}

const failed = checks.filter((c) => !c.ok).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : exitCode)
