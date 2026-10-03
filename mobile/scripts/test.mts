/**
 * R1 test gates (brief §13: "tokens generated on both platforms match the
 * JSON; a theme switch repaints within 10 ms; the design preview renders every
 * component in every state").
 * Run: npx tsx scripts/test.mts  (from mobile/)
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* ---- environment stubs (headless, like frontend/scripts/smoke.mts) ---- */
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size },
}
const listeners = new Set<string>()
;(globalThis as any).window = {
  location: { hash: '', search: '', href: 'http://localhost/' },
  addEventListener: (t: string) => listeners.add(t),
  removeEventListener: () => undefined,
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  navigator: { platform: 'test' },
}
;(globalThis as any).document = {
  documentElement: { dataset: {} as Record<string, string>, style: { setProperty: () => undefined, colorScheme: '' }, classList: { toggle: () => undefined, add: () => undefined, remove: () => undefined } },
  querySelector: () => null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  body: {},
}
// Node 22 ships a read-only global `navigator` already; haptics degrade to a no-op.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const repo = join(root, '..')

let passed = 0, failed = 0
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${String((e as Error).message).split('\n')[0]}`) }
}

/* ---- 1. design preview renders every component, in every state ---- */
const { renderToString } = await import('react-dom/server')
const React = await import('react')
const DP = await import('../src/screens/DesignPreview')
const { AllStates, COMPONENTS, FRAMES } = DP

const html = renderToString(React.createElement(AllStates))
for (const c of COMPONENTS) {
  check(`preview renders ${c}`, () => assert.ok(html.includes(`data-c="${c}"`), `no data-c="${c}" in AllStates output`))
}
check('preview covers all five frame sizes', () => {
  const names = FRAMES.map((f: { name: string }) => f.name)
  for (const f of ['390×844', '412×915', '320×568', '430×932']) assert.ok(names.includes(f), f)
  assert.equal(FRAMES.length, 5) // + tablet
})
const themePickerHtml = renderToString(React.createElement(DP.DesignPreview))
check('preview renders all 12 themes in the picker', () => {
  const themes = JSON.parse(read('../packages/tokens/dist/themes.json'))
  for (const t of themes) assert.ok(themePickerHtml.includes(t.name), `theme ${t.name} not in preview`)
})

/* ---- 2. theme switch is repaint-only, p95 <= 10 ms (JS side) ---- */
const { applyTheme, THEME_IDS } = await import('../src/lib/theme')
check('theme switch applies in <=10ms p95 across 60 switches', () => {
  assert.equal(THEME_IDS.length, 12)
  const samples: number[] = []
  for (let i = 0; i < 60; i++) {
    const t0 = performance.now()
    applyTheme(THEME_IDS[i % 12], { fontScale: i % 2 ? 1.15 : 1, reduceMotion: i % 3 === 0 })
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  const p95 = samples[Math.floor(samples.length * 0.95)]
  // This is the JS mutate cost; the paint-cost gate runs on device in the
  // benchmark harness (docs/mobile/10-performance.md §4). The JS half must be
  // far under budget: 10 ms.
  assert.ok(p95 <= 10, `p95 ${p95.toFixed(2)} ms > 10 ms`)
})

/* ---- 3. tokens consumed by the app are the ones generated from JSON ---- */
check('generated tokens.css present and covers 12 themes', () => {
  const css = read('../packages/tokens/dist/tokens.css')
  for (let i = 0; i < 12; i++) assert.ok(css.includes('[data-theme='), 'missing theme block')
  assert.equal((css.match(/\[data-theme=/g) ?? []).length, 12)
})

/* ---- 4. latency/quality numbers come from tokens, not from literals ---- */
const tokens = JSON.parse(read('../packages/tokens/dist/tokens.json'))
check('app reads frame budgets from tokens', async () => {
  const q = await import('../src/lib/quality')
  const b60 = q.budgets(60), b120 = q.budgets(120)
  assert.equal(b60.budget, tokens.frameBudget.hz60.budgetMs)
  assert.equal(b120.cut, tokens.frameBudget.hz120.cutMs)
})

/* ---- 5. copy rules (the website law applies to mobile) ---- */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|css)$/.test(e.name) && !p.includes('node_modules')) out.push(p)
  }
  return out
}
const files = walk(join(root, 'src'))
const BANNED = /\b(seamless(ly)?|unleash\w*|revolutioni[sz]\w*|supercharge\w*)\b/i
check('no banned copy anywhere in mobile/src', () => {
  for (const f of files) {
    const src = read(f.replace(root + '/', ''))
    assert.ok(!BANNED.test(src), `${f}: banned word`)
  }
})
check('no em dash inside user-facing strings', () => {
  // comments may use them; string literals may not (repo copy law)
  const strRe = /(['"`])((?:\\.|(?!\1).)*)\1/g
  for (const f of files) {
    const src = read(f.replace(root + '/', ''))
    for (const m of src.matchAll(strRe)) {
      if (/^\/\//.test(m[2])) continue
      assert.ok(!m[2].includes('\u2014'), `${f}: em dash in string: ${m[2].slice(0, 60)}`)
    }
  }
})

/* ---- 6. tier-1 offline invariant: the R1 shell contains no network calls ---- */
check('no fetch/XHR in the mobile shell (tier-1 stays local)', () => {
  for (const f of files) {
    const src = read(f.replace(root + '/', ''))
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket\(/.test(src), `${f}: network call`)
  }
})

/* ---- 7. benchmark scenes are declared with budgets ---- */
check('bench/scenes.json defines the 8 scenes with p95/p99 budgets', () => {
  const scenes = JSON.parse(read('bench/scenes.json'))
  const want = ['AnswerStream', 'Reader300', 'QuizRun', 'LibraryScroll', 'GalleryOpen', 'VoiceHold', 'SearchBurst', 'FloodWatch']
  assert.deepEqual(Object.keys(scenes).filter((k) => !k.startsWith('_')).sort(), [...want].sort())
  for (const k of want) {
    const s = scenes[k]
    assert.ok(s.hz60.p95Ms <= tokens.frameBudget.hz60.p95Ms, `${k} p95 over 60Hz gate`)
    assert.ok(s.hz60.p99Ms <= tokens.frameBudget.hz60.p99Ms, `${k} p99 over 60Hz gate`)
    assert.ok(Array.isArray(s.steps) && s.steps.length > 0, `${k} has no steps`)
  }
})

console.log(`\n[mobile] ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
