/**
 * The coding workspace's layout, redrawn — R26.
 *
 * R24 redrew the *chrome*; this round redraws the page it sits on. The old one
 * was four full-height columns sharing one hairline grid: a rail, an explorer,
 * an editor and an assistant, each flush against the next. The new one is a
 * canvas with panels nested on it, the way Tahoe draws a Finder window — the
 * rail, the explorer, the editor, the panel under it and the assistant are each
 * their own rounded surface with a gutter between them.
 *
 * A layout is hard to test and easy to lie about, so this suite holds onto the
 * parts that are not a matter of taste:
 *
 *   • the caret readout is real — a caret moved in the editor arrives in the
 *     status bar, through a ref so typing re-renders one line, not the page;
 *   • the welcome rows are real controls that call real handlers;
 *   • the page is made of panes, and none of them still carries the old
 *     full-height inline border the flush layout needed;
 *   • the stylesheet draws the pane, the gutter and the two status pills, and
 *     drops the panel's own border because the pane supplies it;
 *   • reduced motion turns the pane entrance off.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/workbench-test.mts   (from frontend/)
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
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle'] as const) {
  try { Object.defineProperty(globalThis, k, { configurable: true, value: win[k] }) } catch { /* keep */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fire = (el: any, type = 'click') => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true }))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { readFileSync } = await import('node:fs')
  const { CaretReadout, WelcomeRow } = await import('../src/components/ide/CodingView')
  const { CodeEditor } = await import('../src/components/ide/CodeEditor')

  const view = readFileSync(new URL('../src/components/ide/CodingView.tsx', import.meta.url), 'utf8')
  const editor = readFileSync(new URL('../src/components/ide/CodeEditor.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')

  /* --------------------- [1] the caret reaches the bar -------------------- */

  console.log('\n[1] The caret in the editor is the readout in the status bar')
  let registered: ((c: { line: number; col: number }) => void) | null = null
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(CaretReadout as any, { register: (fn: any) => { registered = fn } }))
  await wait(40)
  check('the readout starts where a file starts', host.textContent?.includes('1:1') ?? false, host.textContent ?? '')
  // The subscription is an effect, so give it as many ticks as it needs rather
  // than one: a cold jsdom import has taken longer than 40 ms before now.
  for (let i = 0; i < 40 && !registered; i++) await wait(10)
  check('and it subscribes to the editor that will report to it', !!registered)
  registered?.({ line: 12, col: 4 })
  await wait(60)
  check('and follows the caret when the editor reports one', host.textContent?.includes('12:4') ?? false, host.textContent ?? '')

  const calls: Array<{ line: number; col: number }> = []
  const editorHost = win.document.createElement('div')
  win.document.body.appendChild(editorHost)
  const editorRoot = createRoot(editorHost)
  editorRoot.render(React.createElement(CodeEditor as any, {
    value: 'hello\nworld', path: 'src/a.ts', onChange: () => {},
    onCaret: (c: any) => calls.push(c),
  }))
  await wait(60)
  check('the editor reports its caret as soon as it opens',
    calls.length > 0 && calls[0].line === 1 && calls[0].col === 1, JSON.stringify(calls[0] ?? null))
  const ta = editorHost.querySelector('textarea') as any
  check('a real textarea is what you type into', !!ta)
  if (ta) {
    ta.selectionStart = 8
    ta.selectionEnd = 8
    fire(ta, 'click')
    await wait(60)
    const last = calls[calls.length - 1]
    check('and a click inside a line moves the readout to that line and column',
      last.line === 2 && last.col === 3, JSON.stringify(last ?? null))
  }
  check('the readout is wired to the editor through a ref, not through state',
    /const caretSink = useRef</.test(view)
    && /onCaret=\{\(c\) => caretSink\.current\?\.\(c\)\}/.test(view)
    && /<CaretReadout register=\{registerCaret\} \/>/.test(view))
  check('the editor only reports when the caret actually moves',
    /useEffect\(\(\) => \{ onCaret\?\.\(\{ line: caret\.line, col: caret\.col \}\) \}, \[caret\.line, caret\.col\]\)/.test(editor))

  /* ------------------------- [2] the welcome window ----------------------- */

  console.log('\n[2] Nothing open is a welcome window, not a dead end')
  const welcome = win.document.createElement('div')
  win.document.body.appendChild(welcome)
  const welcomeRoot = createRoot(welcome)
  let opened = 0
  welcomeRoot.render(React.createElement(WelcomeRow as any, {
    icon: null, label: 'Open a file', hint: '⌘B', onClick: () => { opened++ },
  }))
  await wait(40)
  check('a welcome row names what it does and the key that also does it',
    (welcome.textContent?.includes('Open a file') && welcome.textContent?.includes('⌘B')) ?? false)
  fire(welcome.querySelector('button'))
  await wait(30)
  check('and the whole row is the button, not an icon inside it', opened === 1, String(opened))
  check('the three rows call the real thing: explorer, the AI dock, the preview',
    /setActivity\('explorer'\); setSidebarOpen\(true\)/.test(view)
    && /openDock\('ai'\); setAgentOpen\(true\)/.test(view)
    && /onClick=\{\(\) => void startPreview\(\)\}/.test(view))
  check('the keys it advertises are the keys the workspace binds',
    /'b'\) \{ e\.preventDefault\(\); setSidebarOpen/.test(view)
    && /'j'\) \{ e\.preventDefault\(\); setPanelOpen/.test(view)
    && /e\.key\.toLowerCase\(\) === 'f'/.test(view))

  /* --------------------------- [3] the layout ----------------------------- */

  console.log('\n[3] The page is panels nested on a canvas, not columns sharing edges')
  check('the workspace body is the canvas', /className="ide-canvas flex-1 min-h-0 flex"/.test(view))
  check('the rail is a pane, and no longer a bordered column',
    /className="ide-pane ide-rail w-11/.test(view)
    && !/w-11 shrink-0 flex flex-col items-center py-2 gap-1" style=\{\{ borderRight/.test(view))
  check('the explorer is a pane of its own',
    /className="ide-pane w-\[250px\]/.test(view))
  check('the editor is a pane, and the panel below it is a second one',
    /className="ide-pane ide-pane-elev flex-1 min-h-0 flex flex-col"/.test(view)
    && /className="ide-pane ide-panel-strip shrink-0/.test(view))
  check('the assistant is a pane at the edge, not a column with a border-left',
    /className="ide-pane shrink-0 min-h-0 overflow-hidden flex flex-col"/.test(view)
    && !/className="shrink-0 min-h-0 overflow-hidden flex flex-col" style=\{\{ borderLeft/.test(view))
  check('the canvas is the only thing with the gutter',
    /\.ide-canvas \{[^}]*gap: 6px/.test(css) && /\.ide-canvas \{[^}]*padding: 6px 6px 0/.test(css))
  check('a pane is a rounded surface with a border of its own',
    /\.ide-pane \{[^}]*border-radius: 13px/.test(css) && /\.ide-pane \{[^}]*overflow: hidden/.test(css))
  check('panes settle in once, and not when motion is off',
    /@keyframes ide-pane-in/.test(css) && /prefers-reduced-motion: reduce\) \{ \.ide-pane \{ animation: none; \} \}/.test(css))
  check('the panel no longer draws its own top border — the pane does',
    /\.ide-panel-strip \{ background: color-mix\(in srgb, var\(--ide-panel\) 62%, var\(--ide-bg\)\); \}/.test(css)
    && !/\.ide-panel-strip \{ background: var\(--ide-panel\); border-top/.test(css))
  check('the panel tabs keep room for the underline that slides under them',
    /flex items-center gap-1 px-2 pt-1\.5 pb-2 shrink-0 min-w-0/.test(view)
    && /-bottom-\[7px\] h-\[2px\]/.test(view))
  check('the file tabs sit inside the pane with their own gutter',
    /ide-tabstrip px-1\.5/.test(view)
    && /className="shrink-0 flex items-stretch overflow-x-auto ide-tabstrip px-1\.5"\n            style=\{\{ borderBottom: '1px solid var\(--ide-border\)' \}\}/.test(view))

  /* -------------------------- [4] the status bar -------------------------- */

  console.log('\n[4] The status bar is two floating pills with the canvas between them')
  const bar = view.slice(view.indexOf("className=\"shrink-0 flex items-center gap-1.5 px-2 pt-1.5 pb-2"))
  const barBody = bar.slice(0, bar.indexOf('<IDECommandPalette'))
  check('two pills, and the spacer between them',
    (barBody.match(/className="ide-statuspill/g) ?? []).length === 2 && /<div className="flex-1" \/>/.test(barBody))
  check('the left pill says what this workspace is',
    /Back to projects/.test(barBody) && /guarded/.test(barBody) && /font-mono truncate max-w-\[300px\]/.test(barBody))
  check('the right pill says what it is doing',
    /ready to review/.test(barBody) && /preview :/.test(barBody) && /files\.length/.test(barBody))
  check('the pills are glass, and they are scoped to the workspace',
    /\.ide-statuspill \{[^}]*border-radius: 9px/.test(css) && /\.ide-statuspill \{[^}]*backdrop-filter: blur/.test(css))
  check('the bar is no longer a full-width bordered strip',
    !/shrink-0 h-\[28px\] flex items-center gap-1 px-2 text-\[10\.5px\]" style=\{\{ borderTop/.test(view))
  check('every movement the chrome test knows about is still on the page',
    (view.match(/<StatusItem/g) ?? []).length >= 6 && /layoutId="ide-rail-active"/.test(view)
    && /ariaLabel="Assistant workspace"/.test(view))

  root.unmount()
  editorRoot.unmount()
  welcomeRoot.unmount()

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('workbench-test crashed:', e); process.exit(1) })
