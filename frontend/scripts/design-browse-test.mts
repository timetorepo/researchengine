/**
 * Design mode's references, browsed in the app — R26.
 *
 * Until this round, Inspiration built the right search URL for Awwwards and
 * Dribbble and opened it in a *tab*. R26 asked for those sites to be browsable
 * inside the app, so they now open in the same reader the Library uses, standing
 * in a pane of the studio: Read for the text, Browser for the page itself.
 *
 * This suite holds down the parts that a screenshot cannot:
 *
 *   • the reader can stand in a pane (no modal, no backdrop) and the Library's
 *     modal is untouched;
 *   • every browse control in the board opens the reader *here*, and the
 *     external links that remain are explicitly labelled as new tabs;
 *   • the address bar takes any URL, and back walks the session;
 *   • a page read in the pane can be kept as a reference, with the title the
 *     reader found rather than the site's name;
 *   • the studio is drawn as panels on a canvas like the code page, its eleven
 *     tools are grouped, and the pick ring and the marquee both come from the
 *     Appearance colour.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/design-browse-test.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/code',
  pretendToBeVisual: true,
})
const win: any = dom.window
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 600, width: 900, height: 600, toJSON() { return {} } }
}
win.HTMLElement.prototype.scrollIntoView = function () {}
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'localStorage'] as const) {
  try { Object.defineProperty(globalThis, k, { configurable: true, value: win[k] }) } catch { /* keep */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Poll rather than guess: the reader is a real round trip inside the test. */
async function waitFor(pred: () => boolean, ms = 2000) {
  const until = Date.now() + ms
  while (Date.now() < until) { if (pred()) return true; await wait(25) }
  return pred()
}
const fire = (el: any, type = 'click', init: any = {}) => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, ...init }))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { readFileSync } = await import('node:fs')
  const { SourceViewer } = await import('../src/components/library/SourceViewer')
  const { InspirationBoard } = await import('../src/components/design/InspirationBoard')
  const { useDesign } = await import('../src/stores/useDesign')

  const studio = readFileSync(new URL('../src/components/ide/DesignStudio.tsx', import.meta.url), 'utf8')
  const board = readFileSync(new URL('../src/components/design/InspirationBoard.tsx', import.meta.url), 'utf8')
  const viewer = readFileSync(new URL('../src/components/library/SourceViewer.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')

  // The reader is the app's own server: answer it the way it answers for a page
  // it could reduce.
  const realFetch = (globalThis as any).fetch
  const asked: string[] = []
  const doc = (url: string) => ({
    ok: true, url, via: 'html', title: 'Sites of the day — Awwwards', siteName: 'awwwards.com',
    wordCount: 412, minutes: 2,
    blocks: [
      { type: 'heading', level: 1, text: 'Sites of the day', id: 's1' },
      { type: 'paragraph', text: 'A reduced page, for reading inside the app.' },
    ],
    outline: [{ id: 's1', text: 'Sites of the day', level: 1 }],
    images: [], fetchedAt: Date.now(),
  })
  ;(globalThis as any).fetch = async (input: any) => {
    const url = String(input)
    asked.push(url)
    const target = decodeURIComponent((/url=([^&]+)/.exec(url)?.[1] ?? ''))
    return new Response(JSON.stringify(doc(target)), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const mount = (el: any) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(el)
    return { host, root }
  }

  /* -------------------- [1] the reader can stand in a pane --------------- */

  console.log('\n[1] The reader fits into a pane, and the Library still gets its modal')
  const one = mount(React.createElement(SourceViewer as any, {
    inline: true, source: { url: 'https://www.awwwards.com/websites/', title: 'Awwwards' }, onClose: () => {},
  }))
  await waitFor(() => (one.host.textContent ?? '').includes('A reduced page'))
  check('the inline reader is on screen', !!one.host.querySelector('[data-ui="source-viewer"]'))
  check('and it is not a modal over the window',
    !one.host.innerHTML.includes('fixed inset-0 z-[95]'))
  check('the reader reduced the page and shows what it found',
    one.host.textContent?.includes('A reduced page, for reading inside the app.') ?? false,
    (one.host.textContent ?? '').slice(0, 80))
  check('it asked the app\'s own reader for the page, not the site',
    asked.some((u) => u.includes('/api/library/read') && u.includes('awwwards.com')), asked[0] ?? 'nothing asked')

  const two = mount(React.createElement(SourceViewer as any, {
    source: { url: 'https://refero.design', title: 'Refero' }, onClose: () => {},
  }))
  await wait(120)
  check('without the inline flag it is still the Library\'s modal',
    two.host.innerHTML.includes('fixed inset-0 z-[95]'))
  check('and the prop is opt-in, so no page pays for it',
    /inline\?: boolean/.test(viewer) && /const inlineShell/.test(viewer))

  /* --------------------- [2] the board browses in here ------------------- */

  console.log('\n[2] The references open in the studio, not in a tab')
  check('every source advertises pages, and they are controls rather than links',
    /browses: Browse\[\]/.test(board) && /data-inspiration-browse=/.test(board))
  check('the only external links left say they are new tabs',
    /new tab <ExternalLink/.test(board) && !/href=\{s\.search/.test(board))

  let componentsAsked = 0
  const boardMount = mount(React.createElement(InspirationBoard as any, {
    onDone: () => {},
    onOpenComponents: () => { componentsAsked++ },
  }))
  await wait(120)
  // Every transition re-renders the board, so each step asks the live tree for
  // its controls rather than holding on to a node from the step before.
  const q = (sel: string) => boardMount.host.querySelector(sel) as any
  const qa = (sel: string) => [...boardMount.host.querySelectorAll(sel)] as any[]
  const btn = (re: RegExp) => qa('button').find((b) => re.test(b.textContent ?? ''))
  const chip = (i: number) => qa('[data-inspiration-browse]')[i]

  check('all four sources are offered', qa('[data-inspiration-source]').length === 4, String(qa('[data-inspiration-source]').length))
  check('and they carry real pages to open', qa('[data-inspiration-browse]').length >= 8, String(qa('[data-inspiration-browse]').length))
  check('the browse controls are buttons, not anchors', qa('[data-inspiration-browse]').every((b) => b.tagName === 'BUTTON'))

  fire(chip(0))
  await wait(200)
  check('clicking one opens the reader inside the board', !!q('[data-inspiration-reading]'))
  check('the address bar shows the page that was opened',
    (q('input[aria-label="Browse a URL here"]')?.value ?? '').includes('awwwards.com'),
    String(q('input[aria-label="Browse a URL here"]')?.value))
  check('and the page itself is being read here, not linked away',
    (boardMount.host.textContent ?? '').includes('A reduced page, for reading inside the app.'),
    (boardMount.host.textContent ?? '').slice(-90))

  check('there is a way back to the sources', !!btn(/Back/))
  fire(btn(/Back/))
  await wait(120)
  check('and back returns to the pick view', !q('[data-inspiration-reading]') && !!q('[data-inspiration-source]'))

  // Any URL, not only the curated ones.
  fire(chip(0))
  await wait(160)
  const address = q('input[aria-label="Browse a URL here"]')
  check('the address bar accepts other sites too', !!address)
  if (address) {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set
    setter?.call(address, 'dribbble.com/shots/popular')
    address.dispatchEvent(new win.Event('input', { bubbles: true }))
    await wait(40)
    address.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wait(200)
    const now = q('input[aria-label="Browse a URL here"]')?.value ?? ''
    check('typing a host reads that page here, with the scheme added for you',
      now.startsWith('https://dribbble.com/shots/popular'), now)
  }

  /* --------------------- [3] keeping what you read ----------------------- */

  console.log('\n[3] A page you read here can be kept as a reference')
  const keep = btn(/Keep/)
  check('the reader in the studio offers Keep, the way the Library offers Save', !!keep)
  const keptBefore = useDesign.getState().inspirations.length
  fire(keep)
  await wait(160)
  const kept = useDesign.getState().inspirations
  const last = kept[kept.length - 1] as any
  check('keeping files it under the site it came from',
    kept.length === keptBefore + 1 && last?.source === 'dribbble', JSON.stringify(last ?? null))
  check('with the title the reader found, not the domain',
    last?.title === 'Sites of the day — Awwwards', String(last?.title))
  check('and the URL it was read from',
    String(last?.url ?? '').includes('dribbble.com'), String(last?.url))

  // Back is a walk, not a jump: the trail holds every page this session opened,
  // so going home means walking it until the sources are on screen again.
  for (let i = 0; i < 5 && q('[data-inspiration-reading]'); i++) { fire(btn(/Back/)); await wait(140) }
  check('a kept reference is listed with a way to read it here again',
    qa('button').some((b) => b.title === 'Read it here'), 'no read-here control')
  fire(qa('button').find((b) => b.title === 'Read it here'))
  await wait(200)
  check('and that control opens the reader, in the board, on that page',
    !!q('[data-inspiration-reading]'), 'the board did not open the reader')

  /* ---------------------- [4] reach the UI components -------------------- */

  console.log('\n[4] The components are reachable from the references')
  fire(btn(/Back/))
  await wait(140)
  const componentsRow = boardMount.host.querySelector('[data-inspiration-components]')
  check('the board offers the component registry', !!componentsRow)
  fire(componentsRow)
  await wait(40)
  check('and it hands over to the components tab', componentsAsked === 1, String(componentsAsked))
  check('the studio wiring sends it to that tab',
    /onOpenComponents=\{\(\) => setTab\('hub'\)\}/.test(studio))

  /* ------------------------ [5] the studio itself ------------------------ */

  console.log('\n[5] The studio is panels on a canvas, and the picker wears the theme')
  check('the studio body is the canvas',
    /className="ide-canvas flex-1 min-h-0 flex"/.test(studio))
  check('the screen is a panel and the findings strip is another',
    /className="ide-pane ide-pane-elev flex-1 min-h-0 flex flex-col"/.test(studio)
    && /className="ide-pane shrink-0 flex items-center gap-2 px-3 py-1\.5 text-\[11px\]"/.test(studio))
  check('the inspector is a panel, with no border of its own left over',
    /className="ide-pane shrink-0 min-h-0 flex flex-col"/.test(studio)
    && !/borderLeft: '1px solid var\(--ide-border\)'/.test(studio))
  check('the eleven tools are two tiers, not one row that has to scroll',
    (studio.match(/className="ide-rail-row ide-tabscroll"/g) ?? []).length === 2
    && /data-ui="rail-look"/.test(studio) && /data-ui="rail-build"/.test(studio)
    && /\.ide-rail-row \{/.test(css))
  check('the mode switch is the same glass control the code page uses',
    /<GlassTabs/.test(studio) && !/className="ide-seg"/.test(studio))
  check('the device bar is grouped into the same glass pills as the status bar',
    (studio.match(/className="ide-toolbar-group/g) ?? []).length >= 3
    && /\.ide-toolbar-group \{[^}]*border-radius: 9px/.test(css)
    && /data-ui="device-presets"/.test(studio) && /data-ui="design-grids"/.test(studio))
  check('shots are a filmstrip with the actions on the picture',
    /className="ide-shot"/.test(studio) && /grid grid-cols-2 gap-2/.test(studio)
    && /\.ide-shot-actions \{[^}]*position: absolute/.test(css)
    && /\.ide-shot:hover \.ide-shot-actions/.test(css))
  check('the Appearance colour is read at the moment it is needed',
    /function themeAccent\(\)/.test(studio)
    && /getPropertyValue\('--primary'\)/.test(studio)
    && /color-mix\(in srgb, \$\{accent\} 16%, transparent\)/.test(studio))
  check('and it is handed to every pick and every highlight',
    (studio.match(/\.\.\.themeAccent\(\)/g) ?? []).length === 3,
    String((studio.match(/\.\.\.themeAccent\(\)/g) ?? []).length))
  check('the surface says the picker is armed, in the same colour',
    /picking \? '2px solid color-mix\(in srgb, var\(--ide-accent\) 55%, transparent\)'/.test(studio)
    && /Picking — click an element/.test(studio))
  check('and a picked element scrolls its own row into view',
    /scrollChildIntoView\(list, row, \{ block: 'nearest', smooth: true \}\)/.test(studio)
    && /data-el-uid=\{el\.uid\}/.test(studio))

  ;(globalThis as any).fetch = realFetch
  one.root.unmount(); two.root.unmount(); boardMount.root.unmount()

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('design-browse-test crashed:', e); process.exit(1) })
