/**
 * Token pipeline test (R1 gate): tokens.json must equal the desktop CSS/meta
 * byte-for-byte in value, and every generated platform file must agree with
 * the JSON. Run: node --experimental-strip-types packages/tokens/test/tokens.test.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toCss, toSwift, toKotlin, parseColor } from '../generate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const norm = (s) => s.replace(/\s+/g, ' ').trim()

let passed = 0, failed = 0
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message?.split('\n')[0]}`) }
}

const tokens = JSON.parse(read('packages/tokens/tokens.json'))

/* ---- 1. structure ---- */
check('12 themes present', () => assert.equal(tokens.themes.length, 12))
check('theme ids match meta.ts ids', () => {
  const ids = tokens.themes.map((t) => t.id)
  assert.deepEqual(ids, ['dark', 'light', 'catppuccin-latte', 'catppuccin-frappe', 'catppuccin-macchiato', 'catppuccin-mocha', 'nord', 'solarized-dark', 'solarized-light', 'high-contrast', 're-os', 'perplexity'])
})

/* ---- 2. globals.css parity ---- */
const css = read('frontend/src/styles/globals.css')
function cssBlocks(selector) {
  // `selector` is a raw CSS selector; escape it for regex exactly once.
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m)
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}', 'g')
  const out = []
  for (const m of css.matchAll(re)) out.push(m[1])
  return out
}
function parseDecls(body) {
  const decls = {}
  for (const stmt of body.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const m = /^\s*([a-zA-Z0-9-]+)\s*:\s*([\s\S]+)$/.exec(stmt.trim())
    if (m) decls[m[1]] = norm(m[2])
  }
  return decls
}
check('every theme var equals the globals.css declaration', () => {
  for (const th of tokens.themes) {
    const blocks = cssBlocks(`:root[data-theme="${th.id}"]`)
    assert.ok(blocks.length >= 1, `no CSS block for ${th.id}`)
    const decls = Object.assign({}, ...blocks.map(parseDecls))
    for (const [k, v] of Object.entries(th.vars)) {
      assert.ok(k in decls, `${th.id}: ${k} missing in CSS`)
      assert.equal(decls[k], norm(v), `${th.id}.${k}: json "${norm(v)}" vs css "${decls[k]}"`)
    }
  }
})
check('radius scale matches CSS :root', () => {
  const rootDecls = parseDecls(cssBlocks(':root')[0])
  for (const [k, v] of Object.entries(tokens.radius)) assert.equal(rootDecls[`--radius-${k}`], `${v}px`)
})
check('spring curve matches CSS', () => {
  const rootDecls = parseDecls(cssBlocks(':root')[0])
  assert.equal(rootDecls['--spring'], norm(tokens.motion.springCurve))
})
check('gradients match CSS :root block', () => {
  const rootDecls = parseDecls(cssBlocks(':root')[0])
  for (const [k, v] of Object.entries(tokens.gradients)) assert.equal(rootDecls[`--grad-${k}`], norm(v), `grad-${k}`)
  // per-theme overrides stored where the CSS overrides them
  const lightBlocks = Object.assign({}, ...cssBlocks(`:root[data-theme="light"]`).map(parseDecls))
  for (const k of Object.keys(tokens.themes.find((t) => t.id === 'light').gradients)) {
    assert.equal(norm(lightBlocks[`--grad-${k}`]), norm(tokens.themes.find((t) => t.id === 'light').gradients[k]))
  }
})
check('perplexity radius override present in CSS', () => {
  const blocks = Object.assign({}, ...cssBlocks(`:root[data-theme="perplexity"]`).map(parseDecls))
  assert.equal(blocks['--radius-card'], '10px')
  assert.deepEqual(tokens.themes.find((t) => t.id === 'perplexity').radius, { chip: 6, card: 10, modal: 16 })
})

/* ---- 3. meta.ts parity ---- */
check('meta.ts swatches/name/kind/codeTheme match tokens', () => {
  const meta = read('frontend/src/lib/themes/meta.ts')
  const re = /id: '([a-z0-9-]+)', name: '([^']+)', kind: '(dark|light)', swatches: \[([^\]]+)\], codeTheme: '([^']+)'/g
  const entries = [...meta.matchAll(re)]
  assert.equal(entries.length, 12)
  for (const [, id, name, kind, sw, codeTheme] of entries) {
    const th = tokens.themes.find((t) => t.id === id)
    assert.equal(th.name, name, `${id} name`)
    assert.equal(th.kind, kind, `${id} kind`)
    assert.equal(th.codeTheme, codeTheme, `${id} codeTheme`)
    const swatches = sw.match(/'[^']+'/g).map((s) => s.replace(/'/g, ''))
    const roleKeys = ['--bg', '--surface', '--primary', '--secondary']
    swatches.forEach((swHex, i) => {
      const a = parseColor(swHex), b = parseColor(th.vars[roleKeys[i]])
      // swatches are the opaque version of the surface; alpha may differ (re-os)
      assert.deepEqual([a.r, a.g, a.b], [b.r, b.g, b.b], `${id} swatch ${i}`)
    })
  }
})

/* ---- 4. generators agree with JSON ---- */
check('generated CSS contains every theme var', () => {
  const out = toCss(tokens)
  for (const th of tokens.themes) {
    const block = new RegExp(`:root\\[data-theme="${th.id}"\\] \\{([^}]*)\\}`).exec(out)[1]
    const decls = parseDecls(block)
    for (const [k, v] of Object.entries(th.vars)) assert.equal(decls[k], norm(v), `${th.id}.${k}`)
  }
})
check('generated Swift colour components match JSON', () => {
  const out = toSwift(tokens)
  for (const th of tokens.themes) for (const [k, v] of Object.entries(th.vars)) {
    if (k === 'color-scheme') continue
    const c = parseColor(v)
    const role = k.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, x) => x.toUpperCase())
    const re = new RegExp(`case \\(${th.id.replace(/-([a-z0-9])/g, (_, x) => x.toUpperCase())}, \\.${role}\\): return Color\\(red: ([\\d.]+), green: ([\\d.]+), blue: ([\\d.]+), opacity: ([\\d.]+)\\)`)
    const m = re.exec(out)
    assert.ok(m, `swift case missing for ${th.id}.${role}`)
    assert.equal(+m[1], +(c.r / 255).toFixed(4))
    assert.equal(+m[2], +(c.g / 255).toFixed(4))
    assert.equal(+m[3], +(c.b / 255).toFixed(4))
    assert.equal(+m[4], +c.a.toFixed(4))
  }
})
check('generated Kotlin ARGB hex matches JSON', () => {
  const out = toKotlin(tokens)
  for (const th of tokens.themes) for (const [k, v] of Object.entries(th.vars)) {
    if (k === 'color-scheme') continue
    const c = parseColor(v)
    const hx = (n) => Math.round(n * 255).toString(16).padStart(2, '0').toUpperCase()
    const expected = `0x${hx(c.a)}${hx(c.r)}${hx(c.g)}${hx(c.b)}`
    const role = k.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, x) => x.toUpperCase())
    const re = new RegExp(`val ${role}: Color = Color\\((${expected})u\\.toInt\\(\\)\\)`)
    assert.ok(re.test(out), `kotlin ${th.id}.${role} expected ${expected}`)
  }
})
check('deterministic generation (byte-stable)', () => {
  assert.equal(toCss(tokens), toCss(tokens))
  assert.equal(toSwift(tokens), toSwift(tokens))
})

/* ---- 5. schema shared with the desktop backend ---- */
check('re-core schema_v1.sql equals backend MIGRATION', () => {
  const be = read('backend/src/db/index.ts')
  const mig = /const MIGRATION = `\n([\s\S]*?)\n`/.exec(be)
  assert.ok(mig, 'backend MIGRATION template not found')
  const backendStmts = mig[1].split('\n').map(norm).filter(Boolean).sort()
  const shared = read('crates/re-core/src/schema/schema_v1.sql')
  const sharedStmts = shared.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).map(norm).sort()
  assert.deepEqual(sharedStmts, backendStmts)
})

console.log(`\n[tokens] ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
