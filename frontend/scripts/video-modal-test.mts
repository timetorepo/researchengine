/**
 * Video popup round — renders the real components in jsdom.
 *
 *  1. A saved video opens the popup player, from the youtube-nocookie embed, with autoplay
 *     and the saved start time.
 *  2. A closed popup renders no player at all.
 *  3. The Library grid shows each saved video as a button that opens the popup.
 *
 * Run: npm run video-modal-test --workspace frontend
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
  const { VideoPlayerModal } = await import('../src/components/video/VideoPlayerModal.tsx')
  const { LibraryVideos, useLibraryVideos } = await import('../src/components/library/LibraryVideos.tsx')

  useLibraryVideos.getState().add({ id: 'vid_dQw4w9WgXcQ', ytId: 'dQw4w9WgXcQ', title: 'A saved lecture', addedAt: 1, notes: '', startAt: 75 })

  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  console.log('1. The popup player')
  await act(async () => {
    root.render(React.createElement(VideoPlayerModal, { ytId: 'abcdefghijk', title: 'Lesson one', channel: 'Channel X', startAt: 75, onClose: () => {} }))
  })
  await act(async () => { await wait(80) })
  const frame = win.document.querySelector('iframe[title="Lesson one"]') as HTMLIFrameElement | null
  check('a player frame is rendered in the popup', !!frame)
  const src = frame?.getAttribute('src') ?? ''
  check('it uses the privacy embed', src.startsWith('https://www.youtube-nocookie.com/embed/abcdefghijk'), src)
  check('it autoplays from the saved start', src.includes('autoplay=1') && src.includes('start=75'), src)
  check('the channel is shown', win.document.body.textContent?.includes('Channel X') ?? false)
  check('the link out to YouTube is kept', !!win.document.querySelector('a[href="https://www.youtube.com/watch?v=abcdefghijk"]'))

  await act(async () => { root.unmount() })
  const closedHost = win.document.createElement('div')
  win.document.body.appendChild(closedHost)
  const closedRoot = createRoot(closedHost)
  await act(async () => { closedRoot.render(React.createElement(VideoPlayerModal, { ytId: null, title: 'Hidden', onClose: () => {} })) })
  await act(async () => { await wait(80) })
  check('a closed popup renders no player', !win.document.querySelector('iframe[title="Hidden"]'))
  await act(async () => { closedRoot.unmount() })
  const host2 = win.document.createElement('div')
  win.document.body.appendChild(host2)
  const root2 = createRoot(host2)

  console.log('2. The Library grid opens the popup')
  await act(async () => { root2.render(React.createElement(LibraryVideos)) })
  await act(async () => { await wait(80) })
  const card = win.document.querySelector('button[aria-label="Play A saved lecture"]') as HTMLButtonElement | null
  check('a saved video is a card', !!card)
  await act(async () => { card?.dispatchEvent(new win.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await wait(120) })
  const opened = win.document.querySelector('iframe[title="A saved lecture"]') as HTMLIFrameElement | null
  check('clicking the card opens the popup player', !!opened)
  check('the popup starts at the saved time', (opened?.getAttribute('src') ?? '').includes('start=75'))
  check('the notes box is in the popup', !!win.document.querySelector('textarea[aria-label="Notes on this video"]'))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('video-modal-test crashed:', e); process.exit(1) })
