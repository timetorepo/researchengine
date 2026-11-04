/**
 * "Cannot read properties of undefined (reading 'map')" — the bug, and the class
 * of bug it belongs to.
 *
 * A page in this app is assembled from three kinds of data: records this app
 * wrote to localStorage under an older version of itself, payloads that arrive
 * from its own server, and props handed down by a parent. Any of those can be
 * one field short — and a single `.map` on the missing field takes the whole
 * screen down, which is exactly what a user saw in Design mode.
 *
 * So this suite attacks the repair path directly: it starts the store with a
 * hostile persisted record (the way a real upgrade would), asserts every list
 * came back as a list, renders the two boards that read it, and then walks the
 * source for the receivers that can arrive incomplete and requires each one to
 * be read through `?? []`.
 *
 * Run from frontend/:  node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/resilience-test.mts
 */
import { JSDOM } from 'jsdom'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

/* ------------------------------ jsdom setup ------------------------------ */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/ide',
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

/* The record an older version of this app leaves behind: a direction with no
   palette and no components, an inspiration with no colours, a box entry with
   no description, a brief with holes, and one field that is not even the right
   type. Persisted before the store is imported, because that is when zustand
   reads it. */
storage.set('re.design.hub', JSON.stringify({
  state: {
    manager: 'not-a-manager',
    box: [{ provider: 'shadcn', item: 'button' }, { nonsense: true }],
    brief: { subject: 'a pricing page', theme: 'chartreuse', density: 12 },
    directions: [
      { id: 'old-1', title: 'Quiet editorial', idea: 'Space does the work.', palette: undefined, components: undefined, createdAt: 1 },
      { id: 'old-2', palette: 'not-an-array', components: null },
    ],
    inspirations: [{ id: 'i1', source: 'awwwards', title: 'A site', url: 'https://example.com', note: '', addedAt: 2 }],
  },
  version: 0,
}))

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { readFileSync } = await import('node:fs')

  /* =============== [1] the store repairs a hostile record =============== */

  console.log('\n[1] A stored record from an older version is repaired, not trusted')
  const { useDesign, sanitizeDesign } = await import('../src/stores/useDesign')
  const st = useDesign.getState()

  check('an unknown manager falls back to a real one', st.manager === 'npm', st.manager)
  check('a direction with no palette gets an empty list, not undefined',
    Array.isArray(st.directions[0]?.palette) && st.directions[0].palette.length === 0)
  check('a direction with no components gets an empty list too',
    Array.isArray(st.directions[0]?.components) && st.directions[0].components.length === 0)
  check('a palette stored as a string is not accepted as a list',
    Array.isArray(st.directions[1]?.palette) && st.directions[1].palette.length === 0)
  check('a direction that lost its title still has one', st.directions[1]?.title === 'Untitled direction')
  check('an inspiration with no palette is left without one, not with undefined.map',
    st.inspirations[0] && (st.inspirations[0].palette === undefined || Array.isArray(st.inspirations[0].palette)))
  check('an entry that is not a box entry is dropped rather than rendered',
    st.box.length === 1 && st.box[0].item === 'button')
  check('a box entry with no description gets an empty string', st.box[0].what === '')
  check('a brief with a hole in it is filled in', st.brief.audience === '' && st.brief.subject === 'a pricing page')
  check('a theme that is not a theme becomes no theme', st.brief.theme === '')

  console.log('\n[1b] The repair path itself, on the shapes that actually arrive')
  const repaired = sanitizeDesign({ directions: 'nope', inspirations: null, box: undefined, brief: null })
  check('every list comes back a list, whatever was stored',
    Array.isArray(repaired.directions) && Array.isArray(repaired.inspirations) && Array.isArray(repaired.box))
  check('a null brief becomes the empty brief', repaired.brief.subject === '' && repaired.brief.avoid === '')
  const junk = sanitizeDesign({ directions: [null, 4, 'x', { id: 1, palette: [1, '#fff', null] }] })
  check('junk in the list cannot reach the renderer', junk.directions.length === 1)
  check('only real strings survive as colours', junk.directions[0].palette.join() === '#fff')

  /* =================== [2] the boards that crashed render =================== */

  console.log('\n[2] The boards that read those records render them')

  async function render(el: any): Promise<{ html: string; error: string }> {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    let error = ''
    const root = createRoot(host)
    try {
      root.render(el)
      await wait(120)
    } catch (e: any) {
      error = String(e?.message ?? e)
    }
    return { html: host.innerHTML, error }
  }

  const { DesignBoard } = await import('../src/components/design/DesignBoard')
  const board = await render(React.createElement(DesignBoard as any, { onOpenBrief: () => {} }))
  check('the board renders with a direction that had no palette or components',
    !board.error && board.html.length > 40, board.error || 'empty render')
  check('and it still draws the direction it was given', board.html.includes('Quiet editorial') || board.html.includes('Untitled direction'))

  const { InspirationBoard } = await import('../src/components/design/InspirationBoard')
  const inspo = await render(React.createElement(InspirationBoard as any, { onDone: () => {} }))
  check('the inspiration board renders with an inspiration that had no colours',
    !inspo.error && inspo.html.includes('A site'), inspo.error || 'the saved reference is missing')

  /* ================== [3] the whole class, held still ================== */

  console.log('\n[3] Every payload-shaped list is read through a default')

  const risky: [string, string][] = [
    ['src/components/ide/AgentsDock.tsx', 'task.claim'],
    ['src/components/ide/AgentsDock.tsx', 'task.changes'],
    ['src/components/ide/AgentPanel.tsx', 'm.attachments'],
    ['src/components/ide/AgentSafety.tsx', 'access.roots'],
    ['src/components/ide/DesignStudio.tsx', 'data.flags'],
    ['src/components/ide/TestPanel.tsx', 'run.steps'],
    ['src/components/design/DesignBoard.tsx', 'd.palette'],
    ['src/components/design/DesignBoard.tsx', 'd.components'],
    ['src/components/design/InspirationBoard.tsx', 'i.palette'],
    ['src/components/design/ShipPanel.tsx', 't.manual'],
    ['src/components/library/LibrarySearch.tsx', 'g.hits'],
    ['src/components/library/LibraryView.tsx', 'c.tags'],
    ['src/components/library/RecommendationsPanel.tsx', 'g.items'],
    ['src/components/library/SourceViewer.tsx', 'doc.blocks'],
    ['src/components/library/SourceViewer.tsx', 'doc.outline'],
  ]
  for (const [file, receiver] of risky) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    check(`${receiver} is defaulted before it is mapped`, src.includes(`(${receiver} ?? []).map(`))
  }

  const storeSrc = readFileSync(new URL('../src/stores/useDesign.ts', import.meta.url), 'utf8')
  check('the store repairs what it loads, so nothing downstream has to guess',
    /merge: \(persisted/.test(storeSrc) && /sanitizeDesign/.test(storeSrc))

  console.log('')
  if (failed) {
    console.log(`FAILURES: ${passed} passed, ${failed} failed`)
    for (const f of fails) console.log(`  failed: ${f}`)
    process.exit(1)
  }
  console.log(`ALL PASS: ${passed} passed, 0 failed`)
}

void main()
