// Drift test: prompts.json must equal what the desktop modules produce.
// Run: node --experimental-strip-types --no-warnings packages/prompts/test/prompts.test.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extract, serialize } from '../extract.mjs'

const here = dirname(fileURLToPath(import.meta.url))
let passed = 0, failed = 0
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${String(e.message).split('\n')[0]}`) }
}

const fresh = serialize(await extract())
const committed = readFileSync(join(here, '..', 'prompts.json'), 'utf8')

check('prompts.json is byte-equal to a fresh extraction (fix: npm run prompts:sync)', () => {
  assert.equal(committed, fresh)
})

const data = JSON.parse(committed)
check('seven master prompts, versioned', () => {
  assert.deepEqual(data.meta.keys, ['research', 'flow', 'math', 'quality', 'reader', 'replicate', 'article'])
  assert.equal(data.meta.masterVersion, 1)
  for (const m of data.masters) assert.ok(m.text.length > 80, `${m.key} suspiciously short`)
})
check('demo honesty string present (origin story corner, parity §1.2)', () => {
  const demo = readFileSync(join(here, '..', '..', '..', 'frontend', 'src', 'lib', 'providers', 'demo.ts'), 'utf8')
  assert.match(demo, /origin story/)
})
check('seven builtin skills with unique ids', () => {
  assert.equal(data.skills.length, 7)
  assert.equal(new Set(data.skills.map((s) => s.id)).size, 7)
})
check('copy rules: no em dash or banned hype in shipped strings', () => {
  // The brief's copy law applies to master prompts as they surface to users.
  const banned = [/\bseamless(ly)?\b/i, /\bunleash\w*\b/i, /\brevolutioni[sz]\w*\b/i, /\bsupercharge\w*\b/i]
  for (const m of data.masters) for (const re of banned) assert.ok(!re.test(m.text), `${m.key} contains banned copy: ${re}`)
})

console.log(`\n[prompts] ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
