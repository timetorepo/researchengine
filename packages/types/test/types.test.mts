// Drift test for @re/types: JSON equals live extraction, and the type-only
// unions still read the same in the frontend sources.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extract, serialize } from '../extract.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fe = join(here, '..', '..', '..', 'frontend', 'src')
let passed = 0, failed = 0
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${String(e.message).split('\n')[0]}`) }
}

const fresh = await extract()
const committed = JSON.parse(readFileSync(join(here, '..', 'types.json'), 'utf8'))
check('types.json equals fresh extraction (fix: npm run types:sync)', () => {
  assert.equal(JSON.stringify(committed, null, 2) + '\n', serialize(fresh))
})
check('11 providers, local-first order preserved', () => {
  const ids = fresh.providers.map((p) => p.id)
  assert.deepEqual(ids, ['openai', 'anthropic', 'groq', 'gemini', 'ollama', 'nim', 'openrouter', 'together', 'mistral', 'lmstudio', 'custom'])
  for (const p of fresh.providers) {
    assert.ok(p.baseUrl, `${p.id} needs baseUrl`)
    if (p.id === 'ollama' || p.id === 'lmstudio' || p.id === 'custom') assert.equal(p.needsKey, false, `${p.id} must be keyless`)
  }
})
check('12 theme ids match meta.ts', () => {
  const src = readFileSync(join(fe, 'lib', 'themes', 'meta.ts'), 'utf8')
  for (const t of fresh.themes) assert.ok(src.includes(`id: '${t.id}'`), `${t.id} missing from meta.ts`)
  assert.equal(fresh.themes.length, 12)
})
check('quiz union unchanged in types/index.ts', () => {
  const src = readFileSync(join(fe, 'types', 'index.ts'), 'utf8')
  assert.match(src, /type: 'mc' \| 'tf' \| 'short' \| 'fill' \| 'ordering' \| 'matching'/)
})
check('privacy modes unchanged in shield.ts', () => {
  const src = readFileSync(join(fe, 'lib', 'privacy', 'shield.ts'), 'utf8')
  assert.match(src, /export type PrivacyMode = 'none' \| 'private' \| 'topsecret'/)
})
check('perf profiles unchanged (runtime + performance mirror)', () => {
  const rt = readFileSync(join(here, '..', '..', '..', 'backend', 'src', 'runtime.ts'), 'utf8')
  const perf = readFileSync(join(fe, 'lib', 'system', 'performance.ts'), 'utf8')
  for (const s of [rt, perf]) assert.match(s, /'eco' \| 'balanced' \| 'performance'/)
})
check('model lists are NEVER hardcoded (brief culture check)', () => {
  const registrySrc = readFileSync(join(fe, 'lib', 'providers', 'registry.ts'), 'utf8')
  assert.match(registrySrc, /Model lists are NEVER hardcoded/)
})

console.log(`\n[types] ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
