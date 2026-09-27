// Headless navigation repro: drives the real App (HashRouter + AnimatePresence
// route transitions) with jsdom and verifies that nav clicks keep working after
// the sequence: sidebar -> page -> home -> page ...
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

const w = dom.window as any
// ---- wire globals BEFORE importing react/app ----
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'SVGElement', 'MouseEvent', 'KeyboardEvent', 'Event', 'CustomEvent', 'PointerEvent', 'getComputedStyle', 'localStorage', 'sessionStorage', 'history', 'location', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSS', 'Image', 'DocumentFragment', 'AbortController', 'AbortSignal']) {
  try { (globalThis as any)[k] = w[k] } catch {
    try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }) } catch { /* keep node's */ }
  }
}
w.matchMedia = w.matchMedia || ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false } }))
;(globalThis as any).matchMedia = w.matchMedia
w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = w.ResizeObserver
w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).IntersectionObserver = w.IntersectionObserver
w.scrollTo = () => {}
w.Element.prototype.scrollTo = function () {} as any

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react') as any
const { useStore } = await import('../src/stores/useStore')
// seed through the real store (keeps all defaults like defaultModel)
useStore.setState((st: any) => ({
  settings: { ...st.settings, onboarded: true },
  chats: [{ id: 'c-demo', title: 'Demo chat', createdAt: Date.now(), updatedAt: Date.now(), spaceId: null, messages: [{ id: 'm1', role: 'user', content: 'hi', t: Date.now() }] }],
}))
const { default: App } = await import('../src/App')
const { useUI } = await import('../src/stores/useUI')
// simulate a non-collapsed desktop sidebar
useUI.setState({ sidebarCollapsed: false })

const root = createRoot(document.getElementById('root')!)
await act(async () => { root.render(React.createElement(App)) })
await sleep(350)

const body = () => (document.querySelector('body')!.textContent || '')
// TextGenerateEffect splits words into spans, so use stable plain-text markers
const onHome = () => /tokens saved across all sessions|Getting started|Ask with citations|Recent research/.test(body())
const onArticles = () => /articles/i.test(document.querySelector('main')?.textContent?.slice(0, 200) || '')
const onQuiz = () => /quiz|flashcard|drop a file/i.test(document.querySelector('main')?.textContent?.slice(0, 400) || '')

function clickNav(href: string) {
  const a = document.querySelector(`a[href="${href}"]`) as HTMLElement | null
  if (!a) throw new Error(`nav link not found: ${href}`)
  a.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
}

async function step(label: string, href: string, check: () => boolean) {
  await act(async () => { clickNav(href) })
  await act(async () => { await sleep(450) }) // let exit+enter transitions finish
  const ok = check()
  console.log(`${ok ? 'PASS' : 'FAIL'} -> ${label} | hash=${w.location.hash} | ${ok ? 'view mounted' : 'VIEW DID NOT MOUNT'}`)
  return ok
}

let failed = 0
console.log('start: hash=' + w.location.hash, '| home mounted:', onHome())
if (!onHome()) {
  failed++
  const b = body()
  console.log('--- BODY SNIPPET (first 600 chars) ---')
  console.log(b.slice(0, 600))
}

// The user's repro: sidebar item -> another page -> back home -> then try pages again
if (!await step('Articles (1st visit)', '#/articles', onArticles)) failed++
if (!await step('Quiz', '#/quiz', onQuiz)) failed++
if (!await step('Home (back)', '#/', onHome)) failed++
if (!await step('Articles (2nd visit)', '#/articles', onArticles)) failed++
if (!await step('Home again', '#/', onHome)) failed++
if (!await step('Quiz again', '#/quiz', onQuiz)) failed++
if (!await step('Library', '#/library', () => !onHome() && !onQuiz())) failed++
if (!await step('Home final', '#/', onHome)) failed++

// Stress: rapid-fire navigation during in-flight transitions (would jam a
// mode="wait" exit gate). Final state must still be consistent.
const rapid = ['#/articles', '#/', '#/quiz', '#/library', '#/', '#/compare', '#/']
for (const href of rapid) {
  await act(async () => { clickNav(href) })
  await act(async () => { await sleep(30) }) // click again while transition is mid-flight
}
await act(async () => { await sleep(500) })
const rapidOk = w.location.hash === '#/' && onHome()
console.log(`${rapidOk ? 'PASS' : 'FAIL'} -> rapid-fire nav (${rapid.length} clicks) | hash=${w.location.hash} | home=${onHome()}`)
if (!rapidOk) failed++

console.log(failed ? `\nREPRODUCED: ${failed} navigation(s) failed` : '\nALL NAVIGATION OK')
process.exit(failed ? 1 : 0)
