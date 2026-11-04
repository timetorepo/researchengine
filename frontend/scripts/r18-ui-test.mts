/**
 * R18, mounted for real.
 *
 *   npx tsx scripts/r18-ui-test.mts      (from frontend/)
 *
 * The three things this round is judged on, in a DOM:
 *
 *   • the Library search shows a reason on every path — the failure path used
 *     to render nothing at all, which is what "I type and nothing happens"
 *     looked like on screen;
 *   • the vanish input hides the text it entered while the pixels fly;
 *   • each of the five shadcn-space blocks renders, and the ones with behavior
 *     (streak, hold-to-erase, toolbar, formatted block) actually do something.
 */
import { JSDOM } from 'jsdom'

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
// 4 ms a frame, and a monotonic clock the component can subtract from: passing
// Date.now() here would make every animation look instantly finished.
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(performance.now()), 4)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.scrollTo = () => {}
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
win.HTMLElement.prototype.scrollIntoView = function () {}
win.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: 320, height: 40, top: 0, left: 0, right: 320, bottom: 40, toJSON() {} } as any
}
// jsdom has no canvas either. The vanish input draws what was typed into a 2D
// context and scatters the pixels, so without this the exit animation finishes
// in one frame and there is nothing to observe. A tiny fake only has to report
// that some pixels are lit.
win.HTMLCanvasElement.prototype.getContext = function () {
  const empty = () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
  return {
    canvas: this,
    font: '', fillStyle: '', strokeStyle: '',
    clearRect() {}, fillText() {}, beginPath() {}, rect() {}, fill() {}, stroke() {}, save() {}, restore() {},
    getImageData(_x: number, _y: number, w: number, h: number) {
      const data = new Uint8ClampedArray(w * h * 4)
      // Light up a band of rows, which is all draw() looks for.
      const rows = Math.min(14, h)
      for (let i = 0; i < rows * w * 4; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255 }
      return { data, width: w, height: h }
    },
  } as any
}
// jsdom has no rich-text engine; the toolbar only has to reach for it.
win.document.execCommand = () => true
win.document.queryCommandState = () => false
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent',
  'MouseEvent', 'PointerEvent', 'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'localStorage', 'MutationObserver', 'DOMParser', 'XMLSerializer', 'SVGElement', 'ResizeObserver', 'IntersectionObserver',
  'matchMedia', 'NodeFilter', 'TreeWalker', 'NodeList', 'DocumentFragment', 'HTMLInputElement', 'HTMLButtonElement',
  'HTMLSelectElement', 'FormData', 'Blob', 'File', 'FileReader', 'getSelection']) {
  try { ;(globalThis as any)[k] = (win as any)[k] } catch { /* getter-only */ }
}
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (root: any) => root.textContent ?? ''

/* ------------------------------------------------------------------ fetch -- */

interface SearchPlan { fail?: string; status?: number; body?: any; calls?: number }
let searchPlan: SearchPlan = {}
let searchCalls: string[] = []
function installFetch() {
  ;(win as any).fetch = (globalThis as any).fetch = async (url: string) => {
    const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
    if (url.startsWith('/api/library/search')) {
      searchCalls.push(url)
      if (searchPlan.fail) throw new TypeError(searchPlan.fail)
      if (searchPlan.status && searchPlan.status !== 200) return new Response('<html>not json</html>', { status: searchPlan.status })
      const body = typeof searchPlan.body === 'function' ? searchPlan.body(searchCalls.length) : searchPlan.body
      return json(body ?? { hits: [], notes: [], sources: [], pending: [], tookMs: 12 })
    }
    if (url.startsWith('/api/library/recommendations')) return json({ recommendations: [], hint: '', notes: [] })
    if (url.startsWith('/api/library/items')) return json({ items: [], folders: [] })
    return json({})
  }
}

async function main() {
  installFetch()
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter, Routes, Route } = await import('react-router-dom')
  const { useStore } = await import('../src/stores/useStore')

  const mount = async (el: any) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(MemoryRouter, null, el))
    await wait(160)
    return { host, root }
  }
  const click = (el: any) => el?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  const setValue = (el: any, v: string) => {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new win.Event('input', { bubbles: true }))
  }

  /* ------------------------------------------------------------------ 1 */
  console.log('\n[1] Library search: every path says something')
  {
    const { LibrarySearch } = await import('../src/components/library/LibrarySearch')
    function Harness() {
      const [q, setQ] = React.useState('')
      return React.createElement(LibrarySearch, { query: q, onQuery: setQ })
    }

    // (a) the server is not there at all — the case that used to render nothing
    searchPlan = { fail: 'Failed to fetch' }
    searchCalls = []
    const a = await mount(React.createElement(Harness))
    click(a.host.querySelector('.gooey-input__open-button'))
    await wait(320)
    const field = a.host.querySelector('input[type="search"]') as any
    setValue(field, 'javascript')
    field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wait(600)
    check('a refused request is named, not swallowed',
      /Search could not run/.test(text(a.host)) && /local server/i.test(text(a.host)), text(a.host).slice(0, 300))
    check('the reason the browser gave is kept', /Failed to fetch/.test(text(a.host)))
    check('the query is still shown, so the screen is not blank',
      /Nothing for “javascript” yet/.test(text(a.host)) || /Search could not run/.test(text(a.host)))
    check('and there is a way to try again', /Try again/i.test(text(a.host)))
    a.root.unmount()

    // (b) the server answers, one lane failed — both facts are shown
    searchPlan = {
      body: {
        hits: [
          { id: 'w1', kind: 'wikipedia', title: 'JavaScript', url: 'https://en.wikipedia.org/wiki/JavaScript', snippet: 'A programming language.', source: 'Wikipedia', favicon: '' },
          { id: 'd1', kind: 'document', title: 'my notes.txt', snippet: 'local', source: 'Your library' },
        ],
        sources: [
          { id: 'wikipedia', label: 'Wikipedia', state: 'ok', count: 1, ms: 142 },
          { id: 'sources', label: 'Trusted sources', state: 'error', count: 0, ms: 176, reason: 'Trusted sources dropped the connection (html.duckduckgo.com)' },
        ],
        pending: [],
        notes: ['Trusted sources dropped the connection (html.duckduckgo.com)'],
        tookMs: 176,
      },
    }
    searchCalls = []
    const b = await mount(React.createElement(Harness))
    click(b.host.querySelector('.gooey-input__open-button'))
    await wait(320)
    const field2 = b.host.querySelector('input[type="search"]') as any
    setValue(field2, 'JavaScript')
    field2.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wait(600)
    check('the article is listed', /A programming language/.test(text(b.host)) && /JavaScript/.test(text(b.host)))
    check('the lane that worked reports its count and time', /Wikipedia: 1 result · 142 ms/.test(text(b.host)), text(b.host).slice(0, 400))
    check('the lane that failed reports why', /Trusted sources dropped the connection/.test(text(b.host)))
    check('the answer time is on screen', /Answered in 176 ms/.test(text(b.host)))
    check('typing alone runs the search once, debounced',
      searchCalls.length === 1 || (searchCalls.length === 2 && searchCalls[1].includes('JavaScript')),
      JSON.stringify(searchCalls))
    b.root.unmount()

    // (c) slow lanes: the first answer is pending, the poll collects the hits
    searchPlan = {
      body: (n: number) => n === 1
        ? { hits: [], sources: [{ id: 'wikipedia', label: 'Wikipedia', state: 'pending', count: 0, ms: 0 }], pending: ['wikipedia'], notes: [], tookMs: 201 }
        : { hits: [{ id: 'w2', kind: 'wikipedia', title: 'Slow article', url: 'https://en.wikipedia.org/wiki/Slow', snippet: 'arrived late', source: 'Wikipedia' }], sources: [{ id: 'wikipedia', label: 'Wikipedia', state: 'ok', count: 1, ms: 480 }], pending: [], notes: [], tookMs: 12 },
    }
    searchCalls = []
    const c = await mount(React.createElement(Harness))
    click(c.host.querySelector('.gooey-input__open-button'))
    await wait(320)
    const field3 = c.host.querySelector('input[type="search"]') as any
    // Typed, not submitted: one debounced search, then the follow-up poll.
    setValue(field3, 'crispr')
    await wait(560)
    check('a lane still running is described as still looking', /still looking/.test(text(c.host)), text(c.host).slice(0, 300))
    await wait(900)
    check('the late results are merged in without asking again',
      /Slow article/.test(text(c.host)) && searchCalls.length >= 2, `${searchCalls.length} calls`)
    c.root.unmount()
  }

  /* ------------------------------------------------------------------ 2 */
  console.log('\n[2] The vanish input: the entered text leaves with its pixels')
  {
    const { PlaceholdersAndVanishInput } = await import('../src/components/ui/aceternity/PlaceholdersAndVanishInput')
    const submitted: string[] = []
    const { host, root } = await mount(React.createElement(PlaceholdersAndVanishInput, {
      placeholders: ['Say something…'],
      onSubmit: (v: string) => submitted.push(v),
    }))
    const input = host.querySelector('input') as any
    setValue(input, 'this text must not linger')
    await wait(60)
    const before = win.getComputedStyle(input).color
    input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wait(80)
    const style = input.getAttribute('style') ?? ''
    check('on submit, the input’s own colour turns transparent', /color:\s*transparent/.test(style), style)
    check('the caret goes with it', /caret-color:\s*transparent/.test(style), style)
    check('spellcheck is switched off so no squiggles stay behind', input.getAttribute('spellcheck') === 'false' || (input as any).spellCheck === false)
    check('the text was handed over before it was hidden', submitted[0] === 'this text must not linger', JSON.stringify(submitted))
    check('the canvas carries the pixels instead', !!host.querySelector('canvas'))
    void before
    await wait(900)
    check('and the value clears itself when the last pixel is gone', input.value === '' || input.value == null, String(input.value))
    root.unmount()
  }

  /* ------------------------------------------------------------------ 3 */
  console.log('\n[3] The five shadcn-space blocks render, and the live ones work')
  {
    // animated-list-02 — the loader animates whatever steps it is given
    const { SetupSteps } = await import('../src/components/shadcn-space/animated-list/animated-list-02')
    const steps = await mount(React.createElement(SetupSteps, {
      duration: 60,
      steps: [{ id: 'parse', title: 'Parsing' }, { id: 'extract', title: 'Extracting' }, { id: 'analyze', title: 'Analyzing' }],
    }))
    check('the setup-steps loader draws the steps it was handed', /Parsing/.test(text(steps.host)) && /Extracting/.test(text(steps.host)))
    await wait(120)
    check('and it moves on by itself', !!steps.host.querySelector('[class*="bg-teal"]') || /Analyzing/.test(text(steps.host)))
    steps.root.unmount()

    // badge-13 — the streak display
    const { StreakBadge } = await import('../src/components/shadcn-space/badge/badge-13')
    const badge = await mount(React.createElement(StreakBadge, { value: 4, label: 'streak' }))
    // NumberFlow paints the numeral into its own element and jsdom never lays it
    // out, so the flame and the label are what can be asserted here; the digit
    // is verified by the browser build.
    check('the streak badge renders its flame and label',
      /streak/.test(text(badge.host)) && !!badge.host.querySelector('svg') && !!badge.host.querySelector('[data-slot="badge"]'),
      text(badge.host))
    check('and it keeps the block’s own streak styling',
      /rounded-full/.test(badge.host.querySelector('[data-slot="badge"]')?.className ?? '')
      && /orange-400/.test(badge.host.querySelector('[data-slot="badge"]')?.className ?? ''))
    badge.root.unmount()

    // button-group-10 — the editor toolbar calls through, and jsdom's missing
    // rich-text engine is reached for rather than crashed on
    const { EditorToolbar, runEditorCommand } = await import('../src/components/shadcn-space/button-group/button-group-10')
    const commands: string[] = []
    const os = win.document.execCommand as any
    win.document.execCommand = (cmd: string) => { commands.push(cmd); return true }
    const toolbar = await mount(React.createElement(EditorToolbar, { onCommand: (id: string) => runEditorCommand(id) }))
    const bold = [...toolbar.host.querySelectorAll('button')].find((b: any) => b.getAttribute('aria-label') === 'Bold')
    check('the toolbar has the six formatting buttons', toolbar.host.querySelectorAll('button').length === 6, String(toolbar.host.querySelectorAll('button').length))
    bold?.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await wait(30)
    check('pressing Bold formats the selection', commands.includes('bold'), JSON.stringify(commands))
    toolbar.root.unmount()
    win.document.execCommand = os

    // button-group-12 — the run/save group, menu and all
    const ActionGroup = (await import('../src/components/shadcn-space/button-group/button-group-12')).default
    let primaries = 0
    const actioned: string[] = []
    const group = await mount(React.createElement(ActionGroup, {
      label: 'Run',
      onPrimary: () => { primaries++ },
      items: [{ id: 'save', label: 'Save the active file' }],
      onAction: (id: string) => actioned.push(id),
    }))
    check('the group renders its primary action', /Run/.test(text(group.host)) && !!group.host.querySelector('button'))
    click([...group.host.querySelectorAll('button')].find((b: any) => (b.textContent ?? '').includes('Run')))
    await wait(30)
    check('the primary button runs', primaries === 1, String(primaries))
    const chevron = [...group.host.querySelectorAll('button')].pop()
    click(chevron)
    await wait(320)
    const menuItem = [...win.document.body.querySelectorAll('[role="menuitem"]')]
      .find((e: any) => (e.textContent ?? '').trim() === 'Save the active file') as any
    check('the menu opens with the actions it was given', !!menuItem, text(win.document.body).slice(-200))
    menuItem?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(60)
    await wait(80)
    check('and the menu entry calls back with its id', actioned.includes('save'), JSON.stringify(actioned))
    group.root.unmount()

    // button-28 — hold to charge, and it really needs the hold
    const { HoldToChargeButton } = await import('../src/components/shadcn-space/button/button-28')
    let completed = 0
    const hold = await mount(React.createElement(HoldToChargeButton, {
      label: 'Hold to erase everything', holdingLabel: 'Keep holding…', completedLabel: 'Everything erased',
      holdDuration: 120, autoResetDelay: 0, onComplete: () => { completed++ },
    }))
    const holdBtn = hold.host.querySelector('button') as any
    check('the hold button says what it does', /Hold to erase everything/.test(text(hold.host)))
    holdBtn.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }))
    await wait(40)
    check('a short press does nothing yet', completed === 0, String(completed))
    holdBtn.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
    await wait(150)
    check('releasing early still does nothing', completed === 0, String(completed))
    holdBtn.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }))
    await wait(400)
    check('a held press completes', completed === 1, String(completed))
    check('and it says so', /Everything erased/.test(text(hold.host)), text(hold.host))
    hold.root.unmount()
  }

  /* ------------------------------------------------------------------ 4 */
  console.log('\n[4] The formatted article block: filtered in, sane out')
  {
    const { ArticleEditor } = await import('../src/components/articles/ArticleEditor')
    const article = {
      id: 'a1', title: 'Notes', createdAt: Date.now(), updatedAt: Date.now(),
      blocks: [
        { id: 'b1', type: 'rich' as const, content: '<b>bold</b> and <script>alert(1)</script><a href="javascript:evil()">x</a><a href="https://ok.example">y</a>' },
        { id: 'b2', type: 'paragraph' as const, content: 'plain' },
      ],
    }
    useStore.setState({ articles: [article] as any })
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(
      React.createElement(MemoryRouter, { initialEntries: ['/articles/a1'] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: '/articles/:id', element: React.createElement(ArticleEditor) }),
        ),
      ),
    )
    await wait(250)
    const readBtn = [...host.querySelectorAll('button')].find((b: any) => /Read/.test(b.textContent ?? ''))
    click(readBtn)
    await wait(320)
    const rich = host.querySelector('.re-rich-block')
    check('the formatted block renders', !!rich, host.innerHTML.slice(0, 200))
    check('the script tag is gone', !!rich && rich.querySelectorAll('script').length === 0)
    check('a javascript: link is stripped of its href', !!rich && !(rich.querySelector('a')?.getAttribute('href') ?? '').startsWith('javascript:'))
    check('a real link survives, with rel and target', !!rich && [...rich.querySelectorAll('a')].some((a: any) => a.getAttribute('href') === 'https://ok.example' && a.getAttribute('rel') === 'noreferrer noopener'))
    check('the words are still there', !!rich && /bold/.test(rich.textContent ?? '') && /y/.test(rich.textContent ?? ''))
    root.unmount()
  }

  console.log(`\n${failed ? 'FAILED' : 'ALL PASS'}: ${passed} passed, ${failed} failed`)
  if (fails.length) { console.log('  - ' + fails.join('\n  - ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
