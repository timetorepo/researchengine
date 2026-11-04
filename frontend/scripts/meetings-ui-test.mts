/**
 * Meetings UI round — renders the real list and detail views in jsdom.
 *
 *  1. The list shows each meeting, with its status.
 *  2. The detail shows a timed transcript, a lost-audio line between the parts,
 *     the typed-notes box, and the template picker.
 *  3. With no recording on file, the audio player and seek buttons are not shown.
 *
 * Run: npm run meetings-ui-test --workspace frontend
 */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

/* ------------------------------ jsdom setup ------------------------------ */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/library',
  pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1440 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 900 })
const storage = new Map<string, string>()
Object.defineProperty(win, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size },
  },
})
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.scrollTo = () => {}
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
if (!win.MutationObserver) win.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return [] } }
win.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON() { return {} } }
}
win.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {}
  return { canvas: this, save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop, clearRect: noop, fillRect: noop, arc: noop, rect: noop, roundRect: noop, scale: noop, translate: noop, rotate: noop, setTransform: noop, resetTransform: noop, drawImage: noop, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }
}

for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLCanvasElement', 'SVGElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'getComputedStyle', 'localStorage', 'DOMParser', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  if (!(key in globalThis) || key.startsWith('HTML') || ['window', 'document', 'navigator', 'localStorage', 'getComputedStyle'].includes(key)) {
    try { Object.defineProperty(globalThis, key, { configurable: true, value: win[key] }) } catch { /* keep what exists */ }
  }
}


;(globalThis as any).NodeFilter = win.NodeFilter
for (const name of ['Event', 'CustomEvent', 'FocusEvent', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'UIEvent', 'InputEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: win[name] })
}
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { MeetingsPanel } = await import('../src/components/meetings/MeetingsPanel.tsx')
  const { MeetingDetail } = await import('../src/components/meetings/MeetingDetail.tsx')
  const { useMeetings } = await import('../src/lib/meetings/store.ts')

  const meeting = {
    id: 'mtg_test1',
    title: 'Weekly sync',
    createdAt: Date.UTC(2026, 9, 18, 9, 0),
    durationSec: 60,
    status: 'ready' as const,
    transcript: 'first part second part',
    notes: '',
    hasAudio: false,
    memo: 'Ask about the budget',
    template: 'one-to-one' as const,
    segments: [
      { id: 'a', startSec: 0, endSec: 20, text: 'first part' },
      { id: 'b', startSec: 40, endSec: 60, text: 'second part' },
    ],
    gaps: [{ startSec: 25, endSec: 35, reason: 'the microphone stopped' }],
  }
  useMeetings.setState({ meetings: [meeting] })

  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)

  console.log('1. The list')
  await act(async () => { root.render(React.createElement(MeetingsPanel)) })
  await act(async () => { await wait(60) })
  const text = win.document.body.textContent ?? ''
  check('the meeting is listed', text.includes('Weekly sync'))
  check('the start control is offered when nothing is recording', !!win.document.querySelector('button[aria-label="Start recording"]'))

  console.log('2. The detail')
  await act(async () => { root.render(React.createElement(MeetingDetail, { meeting, onBack: () => {} })) })
  await act(async () => { await wait(60) })
  const rows = win.document.querySelectorAll('ol[aria-label="Timed transcript"] > li')
  check('the transcript has the two parts and the gap, in time order', rows.length === 3, `rows ${rows.length}`)
  const order = Array.from(rows).map((r: any) => r.textContent ?? '')
  check('the first row is the first part at 0:00', order[0].startsWith('0:00') && order[0].includes('first part'), order[0])
  check('the gap row names the lost span', order[1].includes('Audio missing from 0:25 to 0:35'), order[1])
  check('the last row is the second part at 0:40', order[2].startsWith('0:40') && order[2].includes('second part'), order[2])
  check('the typed notes box shows the saved notes', (win.document.querySelector('textarea[aria-label="Your notes from the meeting"]') as HTMLTextAreaElement | null)?.value === 'Ask about the budget')
  check('the template picker is shown', !!win.document.body.textContent?.includes('1:1'))

  console.log('3. Without audio')
  check('no audio player when there is no recording', !win.document.querySelector('audio'))
  check('no seek buttons without audio', !win.document.querySelector('button[aria-label^="Play from"]'))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('meetings-ui-test crashed:', e); process.exit(1) })
