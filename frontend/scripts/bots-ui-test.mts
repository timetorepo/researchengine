/**
 * Bots, round two — renders the group chat, projects, settings and setup screens in jsdom.
 *
 *  1. The group chat lists its members, shows a reply's web steps, and keeps its sources.
 *  2. The projects screen shows the owner and the handoff form.
 *  3. Settings shows the pause switch, the SearXNG and browser fields, and the export and import buttons.
 *  4. The setup tab offers 18 faces, a web switch, and the ECC role picker.
 *
 * Run: npm run bots-ui-test --workspace frontend
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
;(globalThis as any).IntersectionObserver = win.IntersectionObserver



let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { BotsView } = await import('../src/components/bots/BotsView.tsx')
  const { useBots } = await import('../src/lib/bots/store.ts')

  const t = Date.now()
  useBots.setState({
    bots: [
      {
        id: 'bot_a', name: 'Ana', job: 'Research lead', createdAt: t, memory: [], thread: [], routines: [], webAccess: true,
        role: { source: 'ecc', id: 'planner', name: 'planner', prompt: 'Plan first.' },
      },
      { id: 'bot_b', name: 'Ben', job: 'Writer', createdAt: t, memory: [], thread: [], routines: [] },
    ],
    rooms: [{
      id: 'room_1', name: 'Launch team', memberIds: ['bot_a', 'bot_b'], createdAt: t,
      thread: [
        { id: 'rm1', role: 'user', text: 'What do solar panels cost?', at: t },
        { id: 'rm2', role: 'bot', botId: 'bot_a', text: 'About $0.20 per watt [1].', at: t, trace: ['Searched “solar panel cost”'], sources: [{ title: 'Guide', url: 'https://example.com/guide' }] },
      ],
    }],
    projects: [{ id: 'proj_1', name: 'Landing page', brief: 'Ship it', ownerId: 'bot_a', createdAt: t, log: [{ id: 'ev0', at: t, kind: 'created', text: 'Ship it' }] }],
    settings: { paused: false, searxng: '', browserUrl: '' },
  })

  const mount = async (el: React.ReactElement) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(el) })
    return root
  }
  const clickByText = async (text: string, selector = 'button, [role="tab"]') => {
    const el = [...win.document.querySelectorAll(selector)].find((n: any) => n.textContent?.trim() === text) as HTMLElement | undefined
    if (!el) return false
    await act(async () => { el.click() })
    return true
  }
  const body = () => win.document.querySelector('[data-ui="bots"]')?.textContent ?? ''

  console.log('1. Group chat')
  const root = await mount(React.createElement(BotsView))
  check('the group tab is there', await clickByText('Group chats', '[role="tab"]'))
  check('the group is listed by name', body().includes('Launch team'))
  check('the reply shows how many web steps it took', body().includes('How it answered (1 web step)'))
  check('the reply lists its source', !!win.document.querySelector('ol[aria-label="Sources"] a[href="https://example.com/guide"]'))
  check('the message box for the group is there', !!win.document.querySelector('textarea[aria-label="Message Launch team"]'))

  console.log('2. Projects')
  check('the projects tab is there', await clickByText('Projects', '[role="tab"]'))
  check('the project shows its owner', body().includes('Owned by Ana'))
  check('the handoff form is there', body().includes('Hand off with a brief'))

  console.log('3. Settings')
  check('the settings button is there', await clickByText('Settings'))
  check('the pause switch is there', body().includes('Pause all routines') || !!win.document.querySelector('[aria-label="Pause all routines"]'))
  check('the SearXNG field is there', body().includes('SearXNG address'))
  check('the browser field is there', body().includes('Headless browser in Docker'))
  check('export and import are there', body().includes('Export all bots') && body().includes('Import a bots file'))

  console.log('4. Setup')
  check('the bots tab is there', await clickByText('Bots', '[role="tab"]'))
  check('the setup tab is there', await clickByText('Setup'))
  const faces = win.document.querySelectorAll('[role="radiogroup"][aria-label="Avatar"] [role="radio"]').length
  check('there are eighteen faces to choose from', faces === 18, String(faces))
  check('the web switch is there', !!win.document.querySelector('[aria-label="Web access for Ana"]'))
  check('the ECC role picker is there', body().includes('Start from an ECC role'))
  check('the role credit names its licence', body().includes('MIT'))

  await act(async () => { root.unmount() })
}

await main()
console.log(failed === 0 ? `\nALL PASS: ${passed} passed, 0 failed` : `\n${failed} FAILED, ${passed} passed`)
process.exit(failed === 0 ? 0 : 1)
