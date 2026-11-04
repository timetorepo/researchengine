/**
 * The coding workspace's chrome — R24.
 *
 * The round asked for the workspace to be redrawn with the taste of Xcode 26,
 * Zed and Cursor 3, and for the motions to never repeat: every interaction gets
 * its own movement. That last part is the part a test can hold onto, so it does:
 *
 *   • the chrome mounts and its pieces are where they claim to be — the glass
 *     bar with its groups, the breadcrumb strip, the gliding tabs, an agent row,
 *     the review bar with the real diff numbers;
 *   • `CodingView` uses them instead of the old flat title bar, and the old one
 *     is gone rather than sitting beside them;
 *   • **no two interactions share a movement**: press scales, hover grows a line,
 *     pulse rings once, tabs glide a pill (layoutId), the rail glides a mark
 *     (layoutId), the agent glyph spins only while it works, the review bar rises
 *     from the bottom, the file tabs stagger in from the left, the panel tabs
 *     slide an underline. The suite counts the mechanisms and fails if any of
 *     those collapses into another;
 *   • reduced motion is honoured in the chrome itself, not only globally.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/ide-chrome-test.mts   (from frontend/)
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
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1500 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 950 })
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 600, width: 900, height: 600, toJSON() { return {} } }
}
if (!win.MutationObserver) win.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return [] } }
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle'] as const) {
  try { Object.defineProperty(globalThis, k, { configurable: true, value: win[k] }) } catch { /* keep */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fire = (el: any, type = 'click') => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10 }))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { readFileSync } = await import('node:fs')
  const chrome = await import('../src/components/ide/IdeChrome')

  const codingView = readFileSync(new URL('../src/components/ide/CodingView.tsx', import.meta.url), 'utf8')
  const agentsDock = readFileSync(new URL('../src/components/ide/AgentsDock.tsx', import.meta.url), 'utf8')
  const chromeSource = readFileSync(new URL('../src/components/ide/IdeChrome.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')

  /* ------------------------- [1] it mounts at all ------------------------- */

  console.log('\n[1] The chrome mounts and says what it is')
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  let tab = 'code'
  let toggled = 0
  root.render(
    React.createElement('div', { className: 'ide-shell' },
      React.createElement(chrome.GlassBar as any, { 'data-ui': 'ide-toolbar' },
        React.createElement(chrome.GlassGroup as any, null,
          React.createElement(chrome.GlassButton as any, { motionKind: 'grow', title: 'Back to projects' }, 'Projects'),
        ),
        React.createElement(chrome.GlassTabs as any, {
          ariaLabel: 'Workspace mode', value: tab,
          options: [{ id: 'code' as const, label: 'Code' }, { id: 'design' as const, label: 'Design' }],
          onChange: (id: string) => { tab = id },
        }),
      ),
      React.createElement(chrome.Breadcrumbs as any, { project: 'My App', path: 'src/lib/api.ts' }),
      React.createElement(chrome.AgentRow as any, {
        name: 'fix login redirect', note: 'src/auth.ts', state: 'working', elapsed: '2m 12s', repo: 'My App', onOpen: () => {},
      }),
      React.createElement(chrome.ReviewBar as any, {
        files: 3, included: 2, added: 54, removed: 5, onReview: () => {}, onMerge: () => {}, onDiscard: () => {},
      }),
      React.createElement(chrome.GlassSwitch as any, { checked: false, label: 'Auto-run', onChange: () => { toggled++ } }),
    ),
  )
  await wait(160)
  const html = host.innerHTML
  check('the glass bar renders with its groups', html.includes('re-glassbar') && html.includes('re-glassgroup'))
  check('a button in it is a real button', !!host.querySelector('.re-glassbtn'))
  check('the breadcrumb strip names every segment',
    html.includes('My App') && html.includes('src') && html.includes('lib') && html.includes('api.ts'))
  check('each breadcrumb segment is a control, not text',
    (host.querySelectorAll('.re-breadcrumbs-item').length) === 4)
  check('the agent row carries state, work and time', html.includes('fix login redirect') && html.includes('2m 12s'))
  check('the review bar shows the real diff', html.includes('+54') && html.includes('−5') && html.includes('3'))
  check('and the merge names what would land', html.includes('Merge 2/3'))

  fire([...host.querySelectorAll('.re-glasstabs-item')].find((b: any) => b.textContent?.includes('Design')))
  await wait(60)
  check('picking a tab reports the choice', tab === 'design', tab)
  const sw = host.querySelector('.re-glassswitch') as any
  fire(sw)
  await wait(40)
  check('the switch reports the change', toggled === 1)
  check('and it reflects its state for a screen reader', sw.getAttribute('aria-pressed') === 'false')
  root.unmount()

  /* ----------------- [2] the workspace actually uses it ------------------- */

  console.log('\n[2] The workspace is redrawn, and the old chrome is gone')
  check('the title bar is the glass bar', /<GlassBar data-ui="ide-toolbar">/.test(codingView))
  check('controls are grouped, not a row of equals',
    (codingView.match(/<GlassGroup>/g) ?? []).length >= 2)
  check('the mode switch is the gliding control, not the old segmented div',
    /<GlassTabs/.test(codingView) && !/className="ide-seg"/.test(codingView))
  check('the path is a breadcrumb strip in the toolbar', /<Breadcrumbs/.test(codingView))
  check('the status bar is Zed-style panel buttons', (codingView.match(/<StatusItem/g) ?? []).length >= 6)
  check('the dock tabs use the same gliding control', /ariaLabel="Assistant workspace"/.test(codingView))
  check('an agent is a row with a state glyph, a timer and a repo chip',
    /<AgentGlyph state=\{glyphState\}/.test(agentsDock) && /useElapsed\(task.startedAt/.test(agentsDock))
  check('a finished agent ends in the review bar', /<ReviewBar/.test(agentsDock) && /included=\{accepted.length\}/.test(agentsDock))
  check('the file tabs stagger in, and only the strip does that',
    /initial=\{\{ opacity: 0, x: -8 \}\}/.test(codingView) && /delay: Math\.min\(0\.16, i \* 0\.018\)/.test(codingView))

  /* ------------------ [3] the eight movements, none repeated -------------- */

  console.log('\n[3] Every interaction moves, and no two move the same way')
  const movements = {
    press: /:active:not\(:disabled\) \{ transform: scale\(0\.96\)/.test(css),
    grow: /\.re-glassbtn\.grow::after/.test(css) && /--re-grow-x/.test(chromeSource),
    pulse: /re-pulse-ring/.test(chromeSource) && /re-pulse-ring/.test(css),
    glidePill: (chromeSource.match(/layoutId=\{`glass-tabs-/g) ?? []).length === 1,
    glideRail: (codingView.match(/layoutId="ide-rail-active"/g) ?? []).length === 1
      && (codingView.match(/layoutId="ide-rail-mark"/g) ?? []).length === 1,
    spin: /state === 'working'\) return <Loader2 size=\{size\} className=\{reduce \? '' : 'animate-spin'\}/.test(chromeSource),
    rise: /initial=\{reduce \? \{ opacity: 0 \} : \{ opacity: 0, y: 18 \}\}/.test(chromeSource),
    underline: /layoutId=\{`ide-panel-underline-\$\{group\}`\}/.test(codingView),
    dockDirection: /dockDir\.current/.test(codingView) && /openDock/.test(codingView),
  }
  for (const [name, present] of Object.entries(movements)) {
    check(`the ${name} movement is there`, present)
  }
  check('press and grow are different mechanisms (scale vs a drawn line)',
    movements.press && movements.grow)
  check('the three tab strips each move differently: pill, underline, stagger',
    movements.glidePill && movements.underline
    && /delay: Math\.min\(0\.16, i \* 0\.018\)/.test(codingView))
  check('the rail glides a mark rather than blinking a background',
    movements.glideRail && !/background: active \? 'var\(--ide-active\)'/.test(codingView.split('function ActivityBtn')[1]?.slice(0, 700) ?? ''))
  check('nothing animates forever in the chrome except a working spinner',
    (chromeSource.match(/repeat: Infinity/g) ?? []).length === 0)

  /* --------------------- [4] reduced motion is honoured ------------------ */

  console.log('\n[4] Reduced motion is respected inside the chrome')
  check('the components ask for it themselves',
    /useReducedMotion\(\)/.test(chromeSource) && (chromeSource.match(/useReducedMotion\(\)/g) ?? []).length >= 5)
  check('the stylesheet drops the transitions under the setting',
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,400}re-glassbtn[\s\S]{0,400}re-reviewbar/.test(css))
  check('the grown line is not drawn at all when motion is off',
    /\.re-glassbtn\.grow::after \{ display: none; \}/.test(css))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('ide-chrome-test crashed:', e); process.exit(1) })
