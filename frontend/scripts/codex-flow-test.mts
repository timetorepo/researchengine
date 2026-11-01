/**
 * The Codex-style task loop and project instructions, checked without a browser:
 *  1. The task loop asks for the six steps in order, and the report headings in order.
 *  2. The review intent is read-only: its preamble forbids edits.
 *  3. A new project's AGENTS.md template has the sections the agent relies on.
 *  4. AGENTS.md is loaded when present, clipped when long, and ignored when missing,
 *     unreadable or not text. A failing request never blocks a turn.
 *
 * Run: npm run codex-flow-test --workspace frontend
 */
import assert from 'node:assert/strict'
import {
  CODEX_FLOW, REVIEW_PREAMBLE, PROJECT_INSTRUCTIONS_FILE, PROJECT_INSTRUCTIONS_MAX,
  projectInstructionsTemplate, loadProjectInstructions,
} from '../src/lib/ide/codex-flow'

let passed = 0
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn()
  passed++
  console.log(`  ok  ${name}`)
}

/** Replace global fetch for one assertion, then restore it. */
async function withFetch(impl: (url: string) => Promise<Response> | Response, run: () => Promise<void>) {
  const real = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => impl(String(input))) as typeof fetch
  try { await run() } finally { globalThis.fetch = real }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

await check('the task loop has six steps in order', () => {
  const steps = ['Restate', 'Look before', 'Plan in', 'Make the smallest', 'Prove it', 'Finish with']
  let at = -1
  for (const s of steps) {
    const i = CODEX_FLOW.indexOf(s)
    assert.ok(i > at, `step "${s}" out of order or missing`)
    at = i
  }
})

await check('the report headings are in the required order', () => {
  const heads = ['**Changed**', '**Verified**', '**Not verified**', '**Next**']
  let at = -1
  for (const h of heads) {
    const i = CODEX_FLOW.indexOf(h)
    assert.ok(i > at, `heading ${h} out of order or missing`)
    at = i
  }
})

await check('the task loop forbids destructive commands without asking', () => {
  assert.match(CODEX_FLOW, /destructive/i)
  assert.match(CODEX_FLOW, /without asking/i)
})

await check('the review intent forbids edits and asks for path:line findings', () => {
  assert.match(REVIEW_PREAMBLE, /Do not edit files/)
  assert.match(REVIEW_PREAMBLE, /path:line/)
})

await check('the AGENTS.md template has the sections the agent relies on', () => {
  const t = projectInstructionsTemplate('demo')
  assert.ok(t.startsWith('# demo'))
  for (const h of ['## Goal', '## Commands', '## Conventions', '## Done means']) assert.ok(t.includes(h), h)
  assert.equal(PROJECT_INSTRUCTIONS_FILE, 'AGENTS.md')
})

await check('AGENTS.md is loaded from the project file endpoint', async () => {
  await withFetch(
    (url) => {
      assert.match(url, /^\/api\/ide\/file\?project=my%20app&path=AGENTS\.md$/)
      return json({ content: '  Use pnpm.  \n' })
    },
    async () => {
      assert.equal(await loadProjectInstructions('my app'), 'Use pnpm.')
    },
  )
})

await check('a missing AGENTS.md is ignored', async () => {
  await withFetch(() => json({ error: 'File not found.' }, 404), async () => {
    assert.equal(await loadProjectInstructions('demo'), '')
  })
})

await check('a long AGENTS.md is clipped', async () => {
  await withFetch(() => json({ content: 'x'.repeat(PROJECT_INSTRUCTIONS_MAX * 3) }), async () => {
    const got = await loadProjectInstructions('demo')
    assert.ok(got.length <= PROJECT_INSTRUCTIONS_MAX + '\n…(truncated)'.length)
    assert.ok(got.endsWith('(truncated)'))
  })
})

await check('a non-text body or a network failure never throws', async () => {
  await withFetch(() => json({ content: 42 }), async () => {
    assert.equal(await loadProjectInstructions('demo'), '')
  })
  await withFetch(() => { throw new Error('offline') }, async () => {
    assert.equal(await loadProjectInstructions('demo'), '')
  })
})

console.log(`\n${passed} passed, 0 failed`)
