/**
 * Headless render check for the IDE chrome.
 *
 * Renders the real Coding workbench and the Design studio through React on a
 * jsdom document (with the API stubbed) and asserts the important chrome is
 * actually in the markup — activity bar, explorer, tabs, panel, status bar and
 * the AI composer. It catches runtime breakage that tsc cannot see.
 *
 * Run: npx tsx scripts/ui-test.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}

/* ---------------- browser shims ---------------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/#/code', pretendToBeVisual: true })
const win: any = dom.window
const storage = new Map<string, string>()
// jsdom exposes localStorage as a getter-only property — define over it.
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
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
win.scrollTo = () => {}
// jsdom has no layout engine: give elements a no-op scrollIntoView so effects
// that scroll a container do not explode.
win.HTMLElement.prototype.scrollIntoView = function () {}
// A desktop-sized viewport (the IDE only auto-opens the assistant dock when
// there is room for it).
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1600 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 1000 })

for (const k of ['window', 'document', 'navigator', 'localStorage', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
  'HTMLElement', 'HTMLIFrameElement', 'HTMLDivElement', 'SVGElement', 'Node', 'Element', 'Event', 'CustomEvent', 'MouseEvent',
  'KeyboardEvent', 'getComputedStyle', 'ResizeObserver', 'IntersectionObserver', 'FileReader', 'Blob', 'URL', 'location', 'history', 'scrollTo', 'DOMParser']) {
  if (!(k in globalThis) || k === 'window' || k === 'document' || k === 'location') {
    ;(globalThis as any)[k] = (win as any)[k]
  }
}
;(globalThis as any).window = win
;(globalThis as any).document = win.document
;(globalThis as any).location = win.location
;(globalThis as any).getComputedStyle = win.getComputedStyle.bind(win)
// Node defines navigator as getter-only on globalThis — redefine instead.
try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => win.navigator })
} catch { /* Node's navigator is fine for our purposes */ }

/* ---------------- API stub ---------------- */
const calls: string[] = []
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
const TREE = [
  { name: 'src', path: 'src', dir: true, children: [{ name: 'App.tsx', path: 'src/App.tsx', dir: false }, { name: 'main.tsx', path: 'src/main.tsx', dir: false }] },
  { name: 'package.json', path: 'package.json', dir: false },
  { name: 'README.md', path: 'README.md', dir: false },
]
const CODE = 'export function App() {\n  return <div className="app">hello</div>\n}\n'
;(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? '')
  calls.push(`${init?.method ?? 'GET'} ${url}`)
  if (url.includes('/api/ide/tree')) return json({ tree: TREE })
  if (url.includes('/api/ide/file')) return json({ content: CODE })
  if (url.includes('/api/ide/preview/status')) return json({ running: true, ready: true, port: 41234, kind: 'vite', project: 'demo' })
  if (url.includes('/api/ide/preview/logs')) return json({ logs: ['[re] vite ready in 120 ms'] })
  if (url.includes('/api/ide/preview')) return json({ running: false, project: 'demo' })
  if (url.includes('/api/ide/git')) return json({ norepo: true })
  if (url.includes('/api/ide/search')) return json({ results: [] })
  if (url.includes('/api/ide/projects')) return json({ projects: [{ name: 'demo', files: 3, size: 1024, mtime: Date.now(), git: true }] })
  return json({})
}
;(win as any).fetch = (globalThis as any).fetch

/* ---------------- render ---------------- */
async function main() {
  const React = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CodingView } = await import('../src/components/ide/CodingView')
  const { DesignStudio } = await import('../src/components/ide/DesignStudio')
  const { TestPanel } = await import('../src/components/ide/TestPanel')
  const { AgentPanel } = await import('../src/components/ide/AgentPanel')

  console.log('\n[1] Coding workbench renders')
  const { useStore } = await import('../src/stores/useStore')
  useStore.setState({ settings: { ...useStore.getState().settings, onboarded: true } } as any)

  // The project list is the entry surface.
  let html = renderToStaticMarkup(React.createElement(CodingView))
  check('project list renders', html.includes('Coding') && html.includes('Try a sample app'))

  console.log('\n[2] Design studio (mounted, effects run)')
  // Server rendering cannot show the preview frame (its URL comes from an
  // effect). Mount for real so the fetch-driven state settles first.
  const { createRoot } = await import('react-dom/client')
  const container = win.document.createElement('div')
  win.document.body.appendChild(container)
  const root = createRoot(container)
  root.render(React.createElement(DesignStudio as any, { project: 'demo', tree: TREE, onExit: () => {} }))
  await new Promise((r) => setTimeout(r, 400))
  const studio = container.innerHTML
  check('design studio fetched the preview status', calls.some((c) => c.includes('/api/ide/preview/status')), calls.slice(0, 4).join(' | '))
  check('design studio renders a preview pane', studio.includes('<iframe'))
  check('design studio shows the Code/Preview segmented control', studio.includes('ide-seg'))
  check('design studio has the device presets', studio.includes('Desktop') && studio.includes('Phone'))
  check('design studio exposes Pick / Shot / Send to AI', studio.includes('Pick') && studio.includes('Shot') && studio.includes('Send to AI'))
  check('design studio has the rail tabs', studio.includes('Assistant') && studio.includes('Inspect') && studio.includes('Tests') && studio.includes('Console'))
  check('design studio renders the assistant composer', studio.includes('ide-composer') && studio.includes('Attach') && studio.includes('Send'))
  check('design studio uses the IDE shell class', studio.includes('ide-shell'))

  const agent = container.innerHTML
  check('design studio embedded the running preview', agent.includes('<iframe') && agent.includes('title="Preview of demo"'), agent.slice(0, 200))
  check('agent panel offers design quick actions', agent.includes('Audit the screen') && agent.includes('Test every button'))
  check('agent panel has the shortcut chips', agent.includes('to send') && agent.includes('/ audit'))
  check('agent panel styles the composer', agent.includes('ide-composer'))

  const tests = renderToStaticMarkup(React.createElement(TestPanel as any, {
    controls: [
      { uid: 'e1', sel: '#go', kind: 'button', name: 'Get started', rect: { x: 0, y: 0, w: 120, h: 40 }, aboveFold: true, disabled: false },
      { uid: 'e2', sel: '#q', kind: 'input', name: 'Search', rect: { x: 0, y: 50, w: 200, h: 32 }, aboveFold: true, currentValue: '', disabled: false },
    ],
    loading: false, onRefresh: () => {}, onHighlight: () => {}, project: 'demo',
  }))
  check('test panel lists discovered controls as buttons', tests.includes('Get started') && tests.includes('Run all'))
  check('test panel groups by control kind', tests.includes('buttons · 1') && tests.includes('inputs · 1'))

  console.log('\n[3] Workbench chrome (open a project)')
  root.unmount()
  container.innerHTML = ''
  const root2 = createRoot(container)
  root2.render(React.createElement(CodingView))
  await new Promise((r) => setTimeout(r, 300))
  const card = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('demo'))
  check('project card is listed', !!card, container.textContent?.slice(0, 80))
  card?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const wb = container.innerHTML
  check('workbench opens with the IDE shell', wb.includes('ide-shell'))
  check('title bar shows the project + mode switch', wb.includes('demo') && wb.includes('ide-seg') && wb.includes('Design'))
  check('activity bar has explorer / search / source control', wb.includes('aria-label="Explorer"') && wb.includes('aria-label="Search"') && wb.includes('aria-label="Source control"'))
  check('explorer shows the project tree', wb.includes('src') && wb.includes('package.json'))
  check('bottom panel offers terminal / problems / git / preview', wb.includes('Terminal') && wb.includes('Problems') && wb.includes('Preview'))
  check('status bar reports preview + file state', wb.includes('preview') && wb.includes('local'))
  check('AI assistant dock is present', wb.includes('AI pair-programmer') || wb.includes('ide-composer'))
  check('unsaved-changes affordances exist', wb.includes('Save'))

  console.log('\n[4] IDE theme tokens are wired')
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')
  check('globals define the IDE shell tokens', css.includes('.ide-shell {') && css.includes('--ide-accent:'))
  check('segmented control styles exist', css.includes('.ide-seg > button.design[data-active="true"]'))
  check('segmented progress bars exist', css.includes('.ide-progress > i.on'))
  check('syntax highlighting is overridden inside the shell', css.includes('.ide-shell .tok-kw'))
  check('IDE surfaces are used by the components', studio.includes('ide-badge') || studio.includes('ide-btn'))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed\n`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('ui-test crashed:', e); process.exit(1) })
