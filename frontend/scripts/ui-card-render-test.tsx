/**
 * Renders an interactive card with every block type to HTML (no browser), so a
 * block that crashes or renders nothing fails here, not in the user's chat.
 *
 * Run: npm run ui-card-render-test --workspace frontend
 */
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UiCard } from '../src/components/chat/UiCard'
import { parseUiCard } from '../src/lib/uicards/spec'

const source = JSON.stringify({
  title: 'Compare two plans',
  summary: 'Tune the numbers',
  blocks: [
    { type: 'text', text: 'Both plans cover the same features.' },
    { type: 'stats', items: [{ label: 'Monthly', value: '$12', hint: 'billed yearly' }] },
    { type: 'list', items: ['Fast', 'Cheap'], ordered: true },
    { type: 'bars', title: 'Cost', unit: 'USD', items: [{ label: 'A', value: 12 }, { label: 'B', value: 30 }] },
    { type: 'tabs', tabs: [{ label: 'Pros', text: 'Quick to set up' }, { label: 'Cons', text: 'Less control' }] },
    { type: 'choice', prompt: 'Which one?', options: [{ label: 'A', reply: 'Tell me more about A' }, { label: 'B' }] },
    { type: 'slider', label: 'Users', min: 1, max: 100, step: 1, value: 10, unit: 'people' },
    { type: 'timeline', items: [{ when: '2026-01', title: 'Start', text: 'Begin' }] },
    { type: 'link', label: 'Docs', href: 'https://example.com/docs' },
    { type: 'ask', label: 'Go deeper', prompt: 'Explain the trade-offs' },
  ],
})

const parsed = parseUiCard(source)
assert.ok(parsed.ok, 'the sample card must parse')
const html = renderToStaticMarkup(<UiCard card={parsed.card} />)

for (const needle of ['Compare two plans', 'Monthly', 'Fast', 'Cost', 'Pros', 'Which one?', 'Users', '2026-01', 'https://example.com/docs', 'Go deeper']) {
  assert.ok(html.includes(needle), `rendered card misses "${needle}"`)
}
assert.ok(!html.includes('javascript:'), 'no javascript: links')
console.log('  ok  every block type renders')
console.log(`\n1 passed, 0 failed (${html.length} characters of HTML)`)
