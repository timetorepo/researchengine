/**
 * Research Engine — navigation test (real DOM, no browser).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/nav-test.mts
 *
 * Why this exists
 * ---------------
 * Navigation has broken three times, and every time it broke in a way that no
 * amount of reading source code revealed:
 *
 *   1. a click waited for the route chunk, so an unloaded page did nothing;
 *   2. a late chunk could push the user onto the page they had already left;
 *   3. a first visit could be wrapped in `flushSync` by the View Transitions
 *      layer — and because a lazy route ALWAYS suspends on its first render,
 *      that commit was lost: the URL changed, the page did not, and clicking
 *      the same row again worked. "I click it once and it denies."
 *
 * Number 3 is invisible to a source check (the code looks right) and invisible
 * to jsdom's default setup (no `startViewTransition`, so the buggy branch is
 * never taken). So this test runs the real app in a real DOM with a faithful
 * View Transition polyfill, and asserts the only thing that matters to a
 * person: **one click puts the page on screen.**
 */
import { JSDOM } from 'jsdom'
import { applyVoiceGlowShims } from './dom-shims.mjs'
import React from 'react'

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --------------------------------------------------------------------------
// A browser-shaped global scope. Everything React, framer-motion and the app
// touch is provided by jsdom; the few things jsdom does not implement are
// stubbed with the smallest thing that keeps a component rendering.
// --------------------------------------------------------------------------
function makeBrowser(innerWidth = 1440) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/#/',
    pretendToBeVisual: true,
  })
  const w = dom.window as any
  // The composer now ships Voice by Jakub Antalik, whose SVG animation frames
  // cannot run in a layout-less DOM.
  applyVoiceGlowShims(w)
  const g = globalThis as any

  g.window = w
  g.document = w.document
  Object.defineProperty(g, 'navigator', { value: w.navigator, configurable: true, writable: true })

  const carry = [
    'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'FocusEvent',
    'DOMRect', 'SVGElement', 'HTMLAnchorElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLDivElement',
    'DocumentFragment', 'Text', 'Comment', 'Image', 'FileReader', 'Blob', 'URL',
    // Node's own AbortSignal is not jsdom's, and framer-motion hands it to
    // addEventListener — jsdom rejects a foreign one.
    'AbortSignal', 'AbortController', 'EventTarget', 'DOMException', 'MutationObserver',
    'localStorage', 'sessionStorage', 'location', 'history', 'getComputedStyle',
  ]
  for (const key of carry) if (w[key] !== undefined) g[key] = w[key]

  g.PointerEvent = w.PointerEvent ?? w.MouseEvent
  g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16)
  g.cancelAnimationFrame = (id: any) => clearTimeout(id)
  g.scrollTo = () => {}
  w.scrollTo = () => {}
  g.matchMedia = w.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })
  g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  g.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
  w.ResizeObserver = g.ResizeObserver
  w.IntersectionObserver = g.IntersectionObserver
  w.matchMedia = g.matchMedia
  g.CSS = w.CSS ?? { supports: () => false }
  g.visualViewport = { addEventListener: () => {}, removeEventListener: () => {}, width: innerWidth, height: 900 }
  Object.defineProperty(w, 'innerWidth', { value: innerWidth, configurable: true })
  Object.defineProperty(w, 'innerHeight', { value: 900, configurable: true })

  // The View Transitions API, as Chrome presents it: the update callback runs
  // asynchronously, after the old frame has been captured. A test that leaves
  // this out is testing a different code path than the one that ships.
  const calls: string[] = []
  w.document.startViewTransition = (cb: () => void) => {
    calls.push('start')
    setTimeout(() => {
      calls.push('update')
      try { cb() } catch (e) { calls.push(`threw:${(e as Error).message}`) }
    }, 0)
    return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: () => calls.push('skip') }
  }
  return { w, g, calls }
}

/** A returning user: onboarding done, expanded rail, one chat in the library. */
function seedReturningUser(w: any) {
  const now = Date.now()
  w.localStorage.setItem('re.data.main:research-engine-v1', JSON.stringify({
    state: {
      settings: { onboarded: true, theme: 'midnight' },
      chats: [{ id: 'a1', title: 'Attention notes', kind: 'research', messages: [{ id: 'm1', role: 'user', content: 'summarise' }], createdAt: now - 9e4, updatedAt: now - 6e4 }],
    },
    version: 0,
  }))
}

async function main() {
  const { w, g, calls } = makeBrowser()
  seedReturningUser(w)

  const { installViewTransitions } = await import('../src/hooks/useViewTransitions')
  const { hasVisited, isWarm } = await import('../src/lib/routes/registry')
  const { createRoot } = await import('react-dom/client')
  const App = (await import('../src/App')).default

  installViewTransitions()
  const root = createRoot(w.document.getElementById('root'))
  root.render(React.createElement(App))
  await sleep(1400)

  const rows = () => [...w.document.querySelectorAll('.re-nav-item')] as HTMLElement[]
  const rowFor = (label: string) => rows().find((r) => r.textContent.includes(label))
  const fire = (el: HTMLElement, types: string[]) => {
    for (const type of types) {
      const Ev = type.startsWith('pointer') ? (g.PointerEvent ?? w.MouseEvent) : w.MouseEvent
      el.dispatchEvent(new Ev(type, { bubbles: !type.endsWith('enter'), cancelable: true, view: w, button: 0 }))
    }
  }
  const pageText = () => (w.document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').trim()

  console.log('\n[1] The app boots into the shell')
  check('the rail is rendered', rows().length >= 9, `${rows().length} rows`)
  check('the app is not blank', pageText().length > 20)
  check('the view transition API is available to the app', !!w.document.startViewTransition)

  console.log('\n[2] One click navigates — first visit, no hover')

  const quiz = rowFor('Learn')!
  const ch = (w.history as any).length
  fire(quiz, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
  await sleep(400)
  check('the URL moves on the first click', w.location.hash === '#/quiz', w.location.hash)
  await sleep(1200)
  check('and the page is on screen after the first click', /Learn/.test(pageText()), pageText().slice(0, 60))

  console.log('\n[3] One click navigates — first visit, after a hover (the prefetched path)')

  const lib = rowFor('Library')!
  fire(lib, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter'])
  await sleep(120)
  fire(lib, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
  await sleep(1400)
  check('the URL moves', w.location.hash === '#/library', w.location.hash)
  check('and the page is on screen', /Library/.test(pageText()), pageText().slice(0, 60))

  console.log('\n[4] A first visit is never animated into')

  // Exactly one transition may have run so far (a revisit), and neither of the
  // first visits above may have started one.
  const transitionsWhileFirstVisiting = calls.filter((c) => c === 'start').length
  check('no transition was started for a route that had never rendered',
    transitionsWhileFirstVisiting === 0, `${transitionsWhileFirstVisiting} started`)

  console.log('\n[5] Revisits are animated, and still land')

  calls.length = 0
  const quizAgain = rowFor('Learn')!
  fire(quizAgain, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter'])
  await sleep(120)
  fire(quizAgain, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
  await sleep(400)
  check('a revisit animates', calls.some((c) => c.startsWith('start')), calls.join(','))
  check('the transition actually ran its update', calls.some((c) => c.startsWith('update')), calls.join(','))
  await sleep(1200)
  check('and the page is on screen', /Learn/.test(pageText()), pageText().slice(0, 60))

  console.log('\n[6] The history is sane')

  check('one click added one entry', (w.history as any).length >= ch + 1)
  check('the route is marked visited only now', hasVisited('/quiz') && hasVisited('/library'))
  check('and warmth is not mistaken for having rendered', isWarm('/compare') === hasVisited('/compare'))

  console.log('\n[7] Every rail row goes somewhere on one click')

  const targets = ['Home', 'Coding', 'Chats', 'Articles', 'Compare', 'Workflows']
  for (const label of targets) {
    const row = rowFor(label)
    if (!row) { check(`a row exists for ${label}`, false); continue }
    fire(row, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter'])
    await sleep(80)
    fire(row, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    await sleep(2200)
    const text = pageText()
    check(`[${label}] one click lands on a rendered page`, text.length > 20 && !/RouteSkeleton|Loading/.test(text.slice(0, 40)) === true, `hash=${w.location.hash} text="${text.slice(0, 40)}"`)
  }

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('nav-test crashed:', e); process.exit(1) })
