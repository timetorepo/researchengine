/**
 * Interactive answer cards (ui-card), checked without a browser:
 *  1. A valid card parses, keeps its blocks and drops unknown ones.
 *  2. Invalid JSON and empty cards are refused, so the code block stays visible.
 *  3. Links must be https; javascript: and http: are dropped.
 *  4. Strings are clipped, control characters removed, lists capped.
 *  5. Sliders stay inside their range; a tabs block needs two tabs.
 *  6. The prompt tells the model the exact block names the parser accepts.
 *
 * Run: npm run ui-card-test --workspace frontend
 */
import assert from 'node:assert/strict'
import { parseUiCard, safeHttps, UI_CARD_LIMITS, UI_CARD_PROMPT } from '../src/lib/uicards/spec'

let passed = 0
const check = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

check('valid card keeps known blocks and drops unknown ones', () => {
  const r = parseUiCard(JSON.stringify({
    title: 'Compare',
    blocks: [
      { type: 'heading', text: 'Options' },
      { type: 'hologram', text: 'nope' },
      { type: 'stats', items: [{ label: 'Speed', value: '2×' }] },
      { type: 'tabs', tabs: [{ label: 'A', text: 'aa' }, { label: 'B', text: 'bb' }] },
    ],
  }))
  assert.ok(r.ok)
  assert.equal(r.card.blocks.length, 3)
  assert.equal(r.card.title, 'Compare')
})

check('invalid JSON and empty cards are refused', () => {
  assert.equal(parseUiCard('{"blocks": [').ok, false)
  assert.equal(parseUiCard('[1,2]').ok, false)
  assert.equal(parseUiCard('{"blocks":[{"type":"nope"}]}').ok, false)
  assert.equal(parseUiCard('{"blocks":[{"type":"tabs","tabs":[{"label":"Only","text":"one"}]}]}').ok, false)
})

check('only https links survive', () => {
  assert.equal(safeHttps('https://example.com/a'), 'https://example.com/a')
  assert.equal(safeHttps('http://example.com'), null)
  assert.equal(safeHttps('javascript:alert(1)'), null)
  assert.equal(safeHttps('data:text/html,hi'), null)
  const r = parseUiCard(JSON.stringify({ blocks: [{ type: 'link', label: 'x', href: 'javascript:alert(1)' }, { type: 'text', text: 'ok' }] }))
  assert.ok(r.ok)
  assert.equal(r.card.blocks.length, 1)
})

check('strings are clipped and control characters removed', () => {
  const long = 'x'.repeat(5000)
  const r = parseUiCard(JSON.stringify({ blocks: [{ type: 'text', text: `a\u0007b${long}` }] }))
  assert.ok(r.ok)
  const b = r.card.blocks[0]
  assert.equal(b.type, 'text')
  assert.ok(b.text.length <= UI_CARD_LIMITS.text)
  assert.ok(!b.text.includes('\u0007'))
})

check('lists and blocks are capped', () => {
  const items = Array.from({ length: 50 }, (_, i) => `item ${i}`)
  const blocks = Array.from({ length: 30 }, () => ({ type: 'list', items }))
  const r = parseUiCard(JSON.stringify({ blocks }))
  assert.ok(r.ok)
  assert.equal(r.card.blocks.length, UI_CARD_LIMITS.blocks)
  for (const b of r.card.blocks) {
    assert.equal(b.type, 'list')
    assert.equal(b.items.length, UI_CARD_LIMITS.items)
  }
})

check('sliders are clamped to their range', () => {
  const r = parseUiCard(JSON.stringify({ blocks: [{ type: 'slider', label: 'Rate', min: 0, max: 10, step: 1, value: 99 }] }))
  assert.ok(r.ok)
  const b = r.card.blocks[0]
  assert.equal(b.type, 'slider')
  assert.equal(b.value, 10)
  const bad = parseUiCard(JSON.stringify({ blocks: [{ type: 'slider', label: 'Bad', min: 5, max: 5 }] }))
  assert.equal(bad.ok, false)
})

check('the prompt names every block type the parser accepts', () => {
  for (const t of ['heading', 'text', 'stats', 'list', 'bars', 'tabs', 'choice', 'slider', 'timeline', 'link', 'ask']) {
    assert.ok(UI_CARD_PROMPT.includes(`"type":"${t}"`), `prompt misses ${t}`)
  }
})

console.log(`\n${passed} passed, 0 failed`)
