/**
 * Calendar, Bots and photo-carousel round — renders the real screens in jsdom.
 *
 *  1. The calendar puts a seeded event on its day and lists the imported calendar.
 *  2. The Bots screen shows a bot's thread, its routine, and its memory count.
 *  3. Two or more photos sent with one message open as a carousel with a caption.
 *
 * Run: npm run calendar-ui-test --workspace frontend
 */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

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
;(globalThis as any).IntersectionObserver = win.IntersectionObserver



let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { CalendarView } = await import('../src/components/calendar/CalendarView.tsx')
  const { BotsView } = await import('../src/components/bots/BotsView.tsx')
  const { AttachmentCarousel } = await import('../src/components/chat/AttachmentCarousel.tsx')
  const { useCalendar } = await import('../src/lib/calendar/store.ts')
  const { useBots } = await import('../src/lib/bots/store.ts')

  const now = new Date()
  const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).getTime()
  useCalendar.setState({
    events: [{ id: 'loc_1', title: 'Dentist visit', start: todayAt, end: todayAt + 3600000, allDay: false }],
    feeds: [{ id: 'feed_g_1', name: 'Google Calendar', kind: 'google', url: 'https://calendar.google.com/calendar/ical/a/basic.ics', count: 1, lastSyncedAt: Date.now() }],
  })
  useBots.setState({
    bots: [{
      id: 'bot_1', name: 'Ana', job: 'Keep my reading list', createdAt: Date.now(), memory: ['Prefers bullet points'],
      thread: [{ id: 'm1', role: 'user', text: 'Hello Ana', at: Date.now() }, { id: 'm2', role: 'bot', text: 'Hi, what do you need?', at: Date.now() }],
      routines: [{ id: 'rt_1', title: 'Morning brief', instructions: 'Summarise my list', everyMinutes: 60, enabled: true, nextRunAt: Date.now() + 3600000, runs: [] }],
    }],
  })

  const mount = async (el: React.ReactElement) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(el) })
    await act(async () => { await wait(80) })
    return root
  }

  console.log('1. Calendar')
  const calRoot = await mount(React.createElement(CalendarView))
  const todayCell = win.document.querySelector(`button[aria-label^="${now.toDateString()}"]`) as HTMLButtonElement | null
  check('today is in the month grid', !!todayCell)
  check('the seeded event shows on today', (todayCell?.textContent ?? '').includes('Dentist visit'), todayCell?.textContent ?? '')
  check('the imported Google calendar is listed in Calendars', (win.document.querySelector('[data-ui="calendar-sources"]')?.textContent ?? '').includes('Google Calendar'))
  check('the Google secret-address field is there', !!win.document.querySelector('input[aria-label="Google Calendar secret address"]'))
  await act(async () => { calRoot.unmount() })

  console.log('2. Bots')
  const botRoot = await mount(React.createElement(BotsView))
  const thread = win.document.querySelector('[data-ui="bots"]')?.textContent ?? ''
  check('the bot is listed', thread.includes('Ana'))
  check('its thread is shown', thread.includes('Hi, what do you need?'))
  check('its routine is counted in the side panel', thread.includes('Routines (1)'))
  check('the routine title is listed', thread.includes('Morning brief'))
  check('the message box is there', !!win.document.querySelector('textarea[aria-label="Message Ana"]'))
  await act(async () => { botRoot.unmount() })

  console.log('3. Photo carousel')
  const carRoot = await mount(React.createElement(AttachmentCarousel, { images: [
    { name: 'one.png', dataUrl: 'data:image/png;base64,AAAA' },
    { name: 'two.png', dataUrl: 'data:image/png;base64,AAAA' },
    { name: 'three.png', dataUrl: 'data:image/png;base64,AAAA' },
  ] }))
  const carText = win.document.querySelector('[data-ui="attachment-carousel"]')?.textContent ?? ''
  check('the first photo has its caption', carText.includes('1 of 3 · one.png'), carText)
  check('all three photos are in the carousel', win.document.querySelectorAll('[data-ui="attachment-carousel"] img').length === 3)
  check('there are arrows to move between them', !!win.document.querySelector('[data-ui="attachment-carousel"] button[aria-label="Next slide"]'))
  await act(async () => { carRoot.unmount() })

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('calendar-ui-test crashed:', e); process.exit(1) })
