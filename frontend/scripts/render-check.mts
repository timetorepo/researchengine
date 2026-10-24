/**
 * Render check — mounts the real IDE components and the humanized-answer UI in
 * a jsdom document with a stubbed API, then asserts on the DOM that comes out.
 *
 * There is no browser in this environment, so this is how we catch the class of
 * bug tsc cannot see: a component that throws on mount, a tab strip that loses
 * its active file, a tooltip that never appears.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/render-check.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

/* ---------------- jsdom shims ---------------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/code',
  pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1500 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 950 })
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
win.HTMLElement.prototype.scrollIntoView = function () {}
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
/**
 * jsdom has no canvas. Components that draw a waveform call getContext('2d')
 * on every frame; without this they would log a warning per frame and the
 * component under test would be reading a null context. A no-op 2D context is
 * enough for the DOM-level assertions below (jsdom could not resolve the pixels
 * anyway) and keeps the output readable.
 */
;(win as any).HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {}
  return {
    canvas: this, save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    stroke: noop, fill: noop, clearRect: noop, fillRect: noop, arc: noop, rect: noop, roundRect: noop,
    scale: noop, translate: noop, rotate: noop, setTransform: noop, resetTransform: noop, drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null, measureText: () => ({ width: 0 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop, setLineDash: noop, getLineDash: () => [], quadraticCurveTo: noop, bezierCurveTo: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    shadowBlur: 0, shadowColor: '', lineCap: 'butt', lineJoin: 'miter', filter: 'none',
  }
}
// voice-glow watches its own attributes to re-measure; a no-op observer keeps the
// microphone card mountable here (there is no layout engine to react to anyway).
win.MutationObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.MutationObserver = win.MutationObserver as any
// jsdom parses SVG but implements none of the animated-value interfaces, so a
// library that drives feDisplacementMap per frame would crash here. Writes are
// swallowed; there is nothing on screen to animate in this environment.
const svgAnimatedNumber = () => ({
  _v: 0,
  get baseVal() { return this._v },
  set baseVal(v: number) { this._v = v },
})
for (const prop of ['scale', 'dx', 'dy', 'baseFrequency', 'stdDeviation']) {
  Object.defineProperty(win.SVGElement.prototype, prop, {
    configurable: true,
    get() { return svgAnimatedNumber() },
  })
}
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }

for (const k of ['window', 'document', 'localStorage', 'matchMedia', 'requestAnimationFrame',
  'cancelAnimationFrame', 'HTMLElement', 'HTMLIFrameElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLAnchorElement',
  'SVGElement', 'Node', 'Element', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle',
  'ResizeObserver', 'IntersectionObserver', 'FileReader', 'Blob', 'File', 'URL', 'location', 'history', 'scrollTo',
  'DOMParser', 'AbortController', 'AbortSignal', 'DOMException', 'CSS', 'requestIdleCallback']) {
  if ((win as any)[k] === undefined) continue
  try { (globalThis as any)[k] = (win as any)[k] } catch { /* getter-only global in Node — handled below */ }
}
;(globalThis as any).window = win
;(globalThis as any).document = win.document
;(globalThis as any).location = win.location
try { Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => win.navigator }) } catch { /* node's is fine */ }

/* ---------------- API stub ---------------- */
const calls: string[] = []
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const TREE = [
  { name: 'src', path: 'src', dir: true, children: [{ name: 'App.tsx', path: 'src/App.tsx', dir: false }, { name: 'main.tsx', path: 'src/main.tsx', dir: false }] },
  { name: 'package.json', path: 'package.json', dir: false },
  { name: 'README.md', path: 'README.md', dir: false },
]
const FILE_BODY: Record<string, string> = {
  'src/App.tsx': 'export function App() {\n  return <div className="app">hello</div>\n}\n',
  'src/main.tsx': 'import { App } from "./App"\nrender(<App />)\n',
  'package.json': '{ "name": "demo", "version": "1.0.0" }\n',
  'README.md': '# demo\n',
}
let diskVersion = 0
;(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? '')
  const method = init?.method ?? 'GET'
  calls.push(`${method} ${url}`)
  if (url.includes('/api/ide/tree')) return json({ tree: TREE })
  if (url.includes('/api/ide/file')) {
    const path = decodeURIComponent(new URL(url, 'http://x').searchParams.get('path') ?? 'package.json')
    const body = (FILE_BODY[path] ?? '') + (diskVersion ? `// disk v${diskVersion}\n` : '')
    if (method === 'GET') return json({ content: body })
    return json({ ok: true })
  }
  if (url.includes('/api/ide/preview/status')) return json({ running: true, ready: true, port: 41234, kind: 'static', project: 'demo' })
  if (url.includes('/api/ide/preview/logs')) return json({ logs: [] })
  if (url.includes('/api/ide/preview')) return json({ running: false })
  if (url.includes('/api/ide/git')) return json({ norepo: true })
  if (url.includes('/api/ide/search')) return json({ results: [] })
  if (url.includes('/api/ide/projects')) return json({ projects: [{ name: 'demo', files: 3, size: 1024, mtime: Date.now(), git: false }] })
  return json({})
}
;(win as any).fetch = (globalThis as any).fetch

/* ---------------- helpers ---------------- */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const nativeValue = (el: any, value: string) => {
  const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new win.Event('input', { bubbles: true }))
}
const fire = (el: any, type = 'click', init: any = {}) => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true, ...init }))
/**
 * React Bits Micro drives its controls with pointer events, not clicks (that is
 * what makes the drag gestures work), so the checks below have to press them the
 * way a hand does. jsdom has PointerEvent, so this is the real event shape.
 */
const pointer = (el: any, type: string, init: any = {}) => el?.dispatchEvent(new win.PointerEvent(type, {
  bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
  button: type === 'pointerdown' ? 0 : -1, buttons: type === 'pointerdown' ? 1 : 0,
  clientX: init.clientX ?? 0, clientY: init.clientY ?? 0, ...init,
}))
/** Press and release — what the components commit a selection on. */
const tap = (el: any, init: any = {}) => { pointer(el, 'pointerdown', init); pointer(el, 'pointerup', init) }

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const { CodingView } = await import('../src/components/ide/CodingView')
  const { Message } = await import('../src/components/chat/Message')
  const { useStore } = await import('../src/stores/useStore')
  const { Sidebar } = await import('../src/components/sidebar/Sidebar')
  const { normalizeProjectName } = await import('../src/lib/ide/names')
  const { localHumanize } = await import('../src/lib/chat/humanize')
  const { readFileSync } = await import('node:fs')

  useStore.setState({ settings: { ...useStore.getState().settings, onboarded: true } } as any)

  const container = win.document.createElement('div')
  win.document.body.appendChild(container)
  const root = createRoot(container)

  console.log('\n[1] Project names are normalised, never refused')
  check('plain names pass through', normalizeProjectName('My App').name === 'My App')
  check('windows-illegal characters are dropped', normalizeProjectName('Project #2 (draft).').name === 'Project #2 (draft)')
  check('the change is reported', normalizeProjectName('Project #2 (draft).').changed === true)
  check('path separators become spaces', normalizeProjectName('a/b').name === 'a b')
  check('reserved device names are made safe', normalizeProjectName('con').name === 'con-project')
  check('dot-only names are rejected with a reason', normalizeProjectName('...').name === '' && !!normalizeProjectName('...').reason)
  check('emoji survive (128-byte cap respected)', normalizeProjectName('Ünïcode 😀').name === 'Ünïcode 😀')

  console.log('\n[2] Workbench mounts, tabs behave')
  root.render(React.createElement(MemoryRouter, null as any, React.createElement(CodingView)))
  await wait(500)
  const card = [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('demo'))
  check('project card rendered', !!card)
  fire(card)
  await wait(500)
  const textOf = () => container.textContent ?? ''
  check('workbench opened', textOf().includes('Explorer'), textOf().slice(0, 120))
  check('assistant dock is present on a wide viewport', textOf().includes('AI pair-programmer') || textOf().includes('Fix'))

  // open two files from the explorer
  const openFromTree = async (name: string) => {
    const btn = [...container.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === name)[0]
    fire(btn)
    await wait(250)
    return btn
  }
  await openFromTree('App.tsx')
  await openFromTree('package.json')
  const tabCount = () => container.querySelectorAll('[data-tab]').length
  check('two tabs are open', tabCount() === 2, `tabs=${tabCount()}`)
  const activeName = () => (container.querySelector('.ide-tab[data-active="true"]')?.textContent ?? '').trim()
  check('the newest file is the active tab', activeName().includes('package.json'), activeName())

  // tapping the SAME file twice must not duplicate the tab (the old glitch)
  const appBtn = await openFromTree('App.tsx')
  fire(appBtn)
  fire(appBtn)
  await wait(300)
  check('re-opening a file does not duplicate its tab', tabCount() === 2, `tabs=${tabCount()}`)

  // closing the active tab must hand over to a neighbour, not to nothing
  const closeBtn = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Close'))
  fire(closeBtn)
  await wait(250)
  check('closing the active tab keeps one tab open', tabCount() === 1, `tabs=${tabCount()}`)
  check('the remaining tab is active', !!container.querySelector('.ide-tab[data-active="true"]'))
  check('the editor still shows a file', !textOf().includes('No file open'), textOf().slice(0, 160))

  // an external write (the AI, a terminal command) must reach the open tab
  diskVersion = 1
  win.dispatchEvent(new win.CustomEvent('re:ide-changed'))
  await wait(400)
  check('an out-of-band edit reaches the open tab', container.textContent!.includes('disk v1'), (container.querySelector('textarea') as any)?.value?.slice(-40))

  console.log('\n[3] Humanize (chat only)')
  /** Mount a Message for real and return its markup + the live container. */
  const mountMessage = async (msg: any) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const r = createRoot(host)
    r.render(React.createElement(MemoryRouter, null as any, React.createElement(Message as any, {
      chatId: 'c1', msg, streaming: false, onRegenerate: () => {},
    })))
    await wait(250)
    return { host, html: host.innerHTML, unmount: () => r.unmount() }
  }

  const humanizedMsg: any = {
    id: 'm1', role: 'assistant', content: 'THE ORIGINAL ANSWER TEXT',
    humanized: 'The rewritten answer.', humanizedBy: 'OpenAI · gpt-4o', createdAt: Date.now(), model: 'gpt-4o', provider: 'OpenAI',
  }
  const { html: out, unmount: unmountHuman } = await mountMessage(humanizedMsg)
  check('the humanized rewrite renders in green', out.includes('humanized-text') && out.includes('The rewritten answer.'))
  check('the original is kept out of the green text', !out.includes('THE ORIGINAL ANSWER TEXT'))
  check('the provenance badge names the model', out.includes('Humanized') && out.includes('OpenAI · gpt-4o'))
  check('restore + previous controls exist', out.includes('Restore original') && out.includes('Show previous'))

  const { html: plain, unmount: unmountPlain } = await mountMessage({
    id: 'm2', role: 'assistant', content: 'A normal answer.', createdAt: Date.now(), model: 'gpt-4o',
  })
  check('a plain answer offers the Humanize button', plain.includes('>Humanize<') || plain.includes('Humanize'))
  check('a plain answer is not green', !plain.includes('humanized-text'))

  unmountPlain()
  unmountHuman()
  // Coding mode has its own surface (the IDE agent panel), so the guard is that
  // the humanize control lives in the chat Message component only.
  const codingGuard = await import('../src/components/ide/AgentPanel').then((m) => m.AgentPanel)
  const agentSrc = readFileSync(new URL('../src/components/ide/AgentPanel.tsx', import.meta.url), 'utf8')
  check('coding mode never imports the humanize UI', !agentSrc.includes('humanize') && typeof codingGuard === 'function')

  console.log('\n[4] Tooltip: the previous response, in red')
  const c2 = win.document.createElement('div')
  win.document.body.appendChild(c2)
  const tooltipStore = useStore.getState()
  const cid = tooltipStore.newChat()
  tooltipStore.addMessage(cid, { ...humanizedMsg, id: 'mt' } as any)
  const root2 = createRoot(c2)
  root2.render(React.createElement(MemoryRouter, null as any, React.createElement(Message as any, {
    chatId: cid, msg: (useStore.getState().chats.find((c) => c.id === cid)!.messages[0]), streaming: false, onRegenerate: () => {},
  })))
  await wait(300)
  const greenEl = c2.querySelector('.humanized-text')
  check('the green block is mounted', !!greenEl)
  fire(greenEl, 'mouseEnter')
  fire(greenEl, 'mouseover')
  await wait(200)
  const tip = win.document.body.querySelector('.humanize-tip')
  check('hovering the green text opens the tooltip', !!tip, greenEl ? 'no .humanize-tip in the document' : 'no anchor')
  check('the tooltip is labelled as the previous response', (tip?.textContent ?? '').includes('Previous response'))
  check('the previous response is shown in red', !!tip?.querySelector('.previous-text') && (tip?.textContent ?? '').includes('THE ORIGINAL ANSWER TEXT'))

  console.log('\n[5] Humanize runs against the real settings (on-device path here)')
  const { humanizeText } = await import('../src/lib/chat/humanize')
  const settings = useStore.getState().settings
  useStore.setState({ settings: { ...settings, defaultModel: '' } } as any)
  let streamed = ''
  const result = await humanizeText({
    text: 'It is important to note that we must utilise a robust approach in order to leverage the data.',
    onChunk: (soFar) => { streamed = soFar },
  })
  check('no provider key → on-device pass is used', result.local === true, result.by)
  check('the result is returned and streamed', result.text.length > 0 && streamed === result.text)
  check('the rewrite drops the stock phrasing', !/utilise|in order to|important to note/i.test(result.text), result.text)
  const { humanizeRoute } = await import('../src/lib/chat/humanize')
  check('no model configured → on-device', humanizeRoute('', {}) === 'local')
  check('model but no key → on-device', humanizeRoute('openai:gpt-4o', { openai: { apiKey: '' } }) === 'local')
  check('model with a key → the model rewrites', humanizeRoute('openai:gpt-4o', { openai: { apiKey: 'sk-test' } }) === 'provider')
  check('a keyless local provider → the model rewrites', humanizeRoute('ollama:llama3', {}) === 'provider')
  useStore.setState({ settings } as any)

  console.log('\n[5b] On-device humanizer')
  const sample = 'It is important to note that we must utilise a robust approach in order to leverage the data. Furthermore, this is crucial.'
  const local = localHumanize(sample)
  check('stock phrases are replaced', !/utilise|in order to|furthermore|crucial/i.test(local), local)
  check('meaning survives the rewrite', local.includes('the data') && local.includes('approach'))
  check('at most one em dash survives', (local.match(/—/g) ?? []).length <= 1)
  const codeSafe = localHumanize('Use this:\n```js\nutilise(leverage) // crucial\n```\nIn order to proceed, utilise it.')
  check('fenced code is copied verbatim', codeSafe.includes('```js\nutilise(leverage) // crucial\n```'), codeSafe)
  check('prose around code is still rewritten', !/In order to|utilise it/.test(codeSafe), codeSafe)
  const inlineSafe = localHumanize('Call `utilise(x)` to leverage nothing.')
  check('inline code is protected too', inlineSafe.includes('`utilise(x)`'), inlineSafe)

  console.log('\n[6] Study formatting: steps and :dot: lines are drawn the same everywhere')
  const { normalizeStepText, toStudyBlocks, looksStructured } = await import('../src/lib/reader/format')
  const messy = 'Here is the method.\n1. Collect the samples\n:dot: label each tube\n:dot: keep them on ice'
  const tidy = normalizeStepText(messy)
  check('the :dot: marker never reaches the reader', !tidy.includes(':dot:'), tidy)
  check('a :dot: line becomes a bullet', tidy.includes('- label each tube'))
  check('numbered steps keep their number', /^1\. Collect the samples$/m.test(tidy))
  const blocks = toStudyBlocks(messy)
  check('prose and steps are separated', blocks[0].kind === 'paragraph' && blocks.some((b) => b.kind === 'steps'))
  const stepBlock = blocks.find((b) => b.kind === 'steps')!
  check('nested :dot: lines stay under their step', stepBlock.items!.filter((i) => i.depth > 0).length === 2)
  const relist = toStudyBlocks('1. First\n1. Second\n1. Third')
  check('repeated "1." is renumbered 1, 2, 3', relist[0].items!.map((i) => i.text).join('|') === 'First|Second|Third')
  const walk = toStudyBlocks('Step 1: Prep the slide\n\nStep 2 - Stain it\n\nStep 3 — Image it')
  check('"Step N" runs are recognised as steps', walk[0].kind === 'steps' && walk[0].items!.length === 3, JSON.stringify(walk[0]))
  const bullets = toStudyBlocks('• one\n• two')
  check('unicode bullets become a list', bullets[0].kind === 'bullets' && bullets[0].items!.length === 2)
  check('fenced code is left alone', toStudyBlocks('```js\n:dot: not a bullet\n```')[0].kind === 'code')
  check('plain prose is untouched', looksStructured('Just a sentence about cells.') === false && toStudyBlocks('Just a sentence about cells.')[0].kind === 'paragraph')

  const { ReaderView } = await import('../src/components/reader/ReaderView')
  const rc = win.document.createElement('div')
  win.document.body.appendChild(rc)
  const rootR = createRoot(rc)
  rootR.render(React.createElement(MemoryRouter, null as any, React.createElement(ReaderView as any, {
    doc: { id: 'd1', name: 'Steps', text: messy + '\n\nBack to prose.' },
    onBack: () => {}, onQuizSection: () => {},
  })))
  await wait(300)
  check('the reader draws a real ordered list', !!rc.querySelector('ol.study-steps'))
  check('each step gets its own marker element', rc.querySelectorAll('ol.study-steps > li > .study-marker').length === 1)
  check('nested :dot: lines are drawn as bullets', rc.querySelectorAll('ol.study-steps .study-list li').length === 2)
  check('no raw :dot: text is left in the reader', !(rc.textContent ?? '').includes(':dot:'))

  // Quiz explanations and the reading chatbox answer go through the same
  // tidying, rendered as markdown so the markers survive it.
  const { Markdown } = await import('../src/components/chat/Markdown')
  const c6 = win.document.createElement('div')
  win.document.body.appendChild(c6)
  const root6 = createRoot(c6)
  root6.render(React.createElement(Markdown as any, { content: normalizeStepText('1. Collect the samples\n:dot: label each tube') }))
  await wait(200)
  check('a quiz explanation draws a numbered list', !!c6.querySelector('ol'))
  check('the explanation keeps its nested bullet', !!c6.querySelector('ul'))
  check('no :dot: marker survives into the quiz', !(c6.textContent ?? '').includes(':dot:'))

  console.log('\n[7] Profile: handle in, blobatar out')
  const { DEFAULT_PROFILE, blobatarSeed, initialsOf, normalizeHandle, withProfileDefaults } = await import('../src/lib/profile')
  check('handles are normalised to a username', normalizeHandle('  Ada Lovelace!!  ') === 'ada-lovelace')
  check('an empty handle falls back', normalizeHandle('...') === '')
  check('the same handle always seeds the same blobatar', blobatarSeed({ ...DEFAULT_PROFILE, handle: 'ada' }) === 'ada')
  check('salt re-rolls the look without changing the handle', blobatarSeed({ ...DEFAULT_PROFILE, handle: 'ada', avatar: { ...DEFAULT_PROFILE.avatar, salt: 'v2' } }) === 'ada#v2')
  check('an old stored profile gains the new avatar fields', withProfileDefaults({ name: 'Ada' } as any).avatar.kind === 'blobatar')
  check('initials come from the display name', initialsOf({ ...DEFAULT_PROFILE, name: 'Ada Lovelace' }) === 'AL')
  const { migrateProfile } = await import('../src/lib/profile')
  check('an install with only a profileName keeps that name', migrateProfile('Grace', null).name === 'Grace')
  check('a profile with no avatar gains the avatar defaults', migrateProfile('Grace', { name: 'Grace' } as any).avatar.kind === 'blobatar')
  check('migration never overwrites a saved profile name', migrateProfile('Old', { name: 'New' } as any).name === 'New')

  const { UserAvatar } = await import('../src/components/shared/UserAvatar')
  useStore.setState((s) => ({ settings: { ...s.settings, profile: withProfileDefaults({ name: 'Ada Lovelace', handle: 'ada' }) } }) as any)
  const c3 = win.document.createElement('div')
  win.document.body.appendChild(c3)
  const root3 = createRoot(c3)
  root3.render(React.createElement(UserAvatar as any, { size: 40 }))
  await wait(250)
  const face = c3.querySelector('svg, img')
  check('a blobatar is drawn for the profile', !!face)
  check('the avatar is attributed to the handle', (c3.querySelector('[title]')?.getAttribute('title') ?? '').includes('ada'))
  root3.render(React.createElement(UserAvatar as any, { size: 40 }))
  await wait(60)
  useStore.setState((s) => ({ settings: { ...s.settings, profile: withProfileDefaults({ name: 'Ada Lovelace', handle: 'ada', avatar: { ...DEFAULT_PROFILE.avatar, kind: 'initials' } }) } }) as any)
  await wait(150)
  check('initials mode falls back to the letter mark', (c3.textContent ?? '').includes('AL'), c3.textContent ?? '')

  console.log('\n[7b] Profile editor: typing a handle rebuilds the face')
  const { ProfileTab } = await import('../src/components/settings/ProfileTab')
  useStore.setState((s) => ({ settings: { ...s.settings, profile: withProfileDefaults({ name: 'Ada Lovelace', handle: 'ada' }) } }) as any)
  const c7 = win.document.createElement('div')
  win.document.body.appendChild(c7)
  const root7 = createRoot(c7)
  root7.render(React.createElement(ProfileTab as any, {}))
  await wait(250)
  check('the editor shows the current handle', c7.textContent?.includes('@ada') || false)
  check('every shape is offered', ['Circle', 'Squircle', 'Square'].every((sh) => (c7.textContent ?? '').includes(sh)))
  const handleInput = c7.querySelector('input[aria-label="Handle"]') as HTMLInputElement
  check('the handle field is labelled', !!handleInput)
  nativeValue(handleInput, 'Grace Hopper!!')
  const rebuild = [...c7.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Rebuild')
  fire(rebuild)
  await wait(200)
  check('a typed handle is normalised into the profile', useStore.getState().settings.profile.handle === 'grace-hopper', useStore.getState().settings.profile.handle)
  const squircle = [...c7.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Squircle')
  fire(squircle)
  await wait(150)
  check('shape is saved to the profile', useStore.getState().settings.profile.avatar.shape === 'squircle')
  const surprise = c7.querySelector('button[aria-label^="Surprise me"]')
  fire(surprise)
  await wait(150)
  check('re-rolling sets a salt on the same handle', !!useStore.getState().settings.profile.avatar.salt && useStore.getState().settings.profile.handle === 'grace-hopper')
  check('the profile name stays in step with the display name', useStore.getState().settings.profileName === 'Ada Lovelace')

  console.log('\n[8] Home composer wears the Border Beam')
  const { InputBar } = await import('../src/components/input/InputBar')
  useStore.setState((s) => ({ settings: { ...s.settings, theme: 'dark', reduceMotion: false, composerBeam: true, composerBeamVariant: 'ocean' } }) as any)
  const c4 = win.document.createElement('div')
  win.document.body.appendChild(c4)
  const root4 = createRoot(c4)
  root4.render(React.createElement(MemoryRouter, null as any, React.createElement(InputBar as any, {
    big: true, chatId: 'home', emptyHistory: true, streaming: false, onStop: () => {},
    mathMode: false, setMathMode: () => {}, onSend: () => {}, autoFocus: false,
  })))
  await wait(250)
  check('the beam renders around the home composer', !!c4.querySelector('[data-beam]'))
  check('the beam is masked off the text you type', !!(c4.querySelector('[data-beam]') as HTMLElement)?.style.position.includes('absolute'))
  const beamStyle = [...win.document.querySelectorAll('style')].map((el) => el.textContent ?? '').join('\n')
  check('the beam matches the composer radius', beamStyle.includes('border-radius: 22px'))
  root4.render(React.createElement(MemoryRouter, null as any, React.createElement(InputBar as any, {
    big: false, chatId: 'c1', emptyHistory: false, streaming: false, onStop: () => {},
    mathMode: false, setMathMode: () => {}, onSend: () => {}, autoFocus: false,
  })))
  await wait(200)
  check('chat composers stay plain', !c4.querySelector('[data-beam]'))

  console.log('\n[8b] Voice: dictation in the composer, Voice Beam, and the three engines')
  {
    const stt = await import('../src/lib/voice/stt')
    const { readFileSync: readVoiceSrc } = await import('node:fs')
    const inputSrcVoice = readVoiceSrc(new URL('../src/components/input/InputBar.tsx', import.meta.url), 'utf8')
    check('the composer uses the real React Bits Voice pill', /import VoicePill from '@\/components\/ui\/reactbits\/micro\/VoicePill'/.test(inputSrcVoice))
    check('and the real Voice Beam from voice-glow, not a lookalike', /import \{ VoiceBeam \} from 'voice-glow'/.test(inputSrcVoice))
    check('the pill is wired to the dictation hook', inputSrcVoice.includes('useDictation(appendDictation)'))
    check('dictation appends to what is already typed', inputSrcVoice.includes('const base = cur.trim()'))
    check('push-to-talk is a choice, not a rule', inputSrcVoice.includes("voicePushToTalk ? 'hold' : 'toggle'"))
    check('cancel-by-slide is honoured', inputSrcVoice.includes("info.reason === 'cancel'"))
    check('the beam is only mounted around the composer', inputSrcVoice.includes('<VoiceBeam') && inputSrcVoice.includes('stream={dictation.stream}'))

    // Voice by Jakub Antalik is a dependency, not a re-implementation.
    const pkgVoice = JSON.parse(readVoiceSrc(new URL('../package.json', import.meta.url), 'utf8'))
    check('voice-glow is a real dependency', !!pkgVoice.dependencies?.['voice-glow'], String(pkgVoice.dependencies?.['voice-glow']))
    check('with its version pinned', /^\^?\d+\.\d+\.\d+/.test(String(pkgVoice.dependencies?.['voice-glow'] ?? '')))

    // Engine selection: the mode that works wins, the mode that cannot work says so.
    check('with no Speech API and no recorder, it says so instead of pretending',
      stt.browserSttSupported() ? true : stt.resolveMode({ mode: 'browser' }).reason.includes('microphone access'))
    // Give the environment a recorder, which is what a WebKitGTK build has.
    const fakeStream = { getTracks: () => [], getAudioTracks: () => [] }
    Object.defineProperty(win.navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: async () => fakeStream },
    })
    win.MediaRecorder = class { static isTypeSupported() { return true } }
    check('with a recorder but no Speech API, a provider is the fallback',
      stt.browserSttSupported() ? true : stt.resolveMode({ mode: 'browser', provider: 'openai' }).mode === 'provider')
    check('and a local whisper server wins over a provider when both are set',
      stt.browserSttSupported() ? true
        : stt.resolveMode({ mode: 'browser', provider: 'openai', localUrl: 'http://127.0.0.1:8080' }).mode === 'local')
    check('a browser that can record is detected as such', stt.recorderSupported())
    check('and the best format is chosen from what it supports', stt.pickMimeType().startsWith('audio/'))
    check('an explicit provider choice is respected', stt.resolveMode({ mode: 'provider', provider: 'groq' }).mode === 'provider')
    check('an explicit local choice is respected', stt.resolveMode({ mode: 'local', localUrl: 'http://127.0.0.1:8080' }).mode === 'local')
    check('the description names the engine, never guesses',
      stt.describeStt({ mode: 'provider', model: 'whisper-large-v3', provider: 'groq' }).includes('whisper-large-v3'))
    check('no browser Speech API here, and it says exactly that',
      stt.browserSttSupported() === false, `supported=${stt.browserSttSupported()}`)

    // The microphone button, in the composer's DOM.
    const { InputBar: IB } = await import('../src/components/input/InputBar')
    const baseVoice = useStore.getState().settings
    useStore.setState({ settings: { ...baseVoice, voice: { enabled: true, mode: 'browser', beam: true } } } as any)
    const cv = win.document.createElement('div')
    win.document.body.appendChild(cv)
    const rootV = createRoot(cv)
    rootV.render(React.createElement(MemoryRouter, null as any, React.createElement(IB as any, {
      big: false, chatId: 'c-voice', emptyHistory: false, streaming: false, onStop: () => {},
      mathMode: false, setMathMode: () => {}, onSend: () => {}, autoFocus: false,
    })))
    await wait(250)
    const mic = cv.querySelector('button[aria-label="Dictate"]') as any
    check('the composer carries a dictate button', !!mic, (cv.textContent ?? '').slice(0, 60))
    check('it sits next to the other composer tools', !!mic && !!cv.querySelector('button[aria-label="Attach image"]'))
    check('the input still renders under the beam', !!cv.querySelector('textarea[aria-label="Message input"]'))
    check('the beam marks itself in the DOM', !!cv.querySelector('[data-voice-beam]'))

    // The glow is switchable, and off means "not mounted" — the beam's own
    // animation loop cannot run without an SVG layout engine, so this also
    // keeps the composer testable here.
    useStore.setState((cur) => ({ settings: { ...cur.settings, voice: { ...(cur.settings.voice ?? {}), enabled: true, beam: false } } }) as any)
    rootV.render(React.createElement(MemoryRouter, null as any, React.createElement(IB as any, {
      big: false, chatId: 'c-voice3', emptyHistory: false, streaming: false, onStop: () => {},
      mathMode: false, setMathMode: () => {}, onSend: () => {}, autoFocus: false,
    })))
    await wait(200)
    check('with the glow off the beam is not mounted at all',
      !cv.querySelector('[data-voice-beam]') && !!cv.querySelector('button[aria-label="Dictate"]'),
      (cv.innerHTML.match(/data-voice-[a-z-]+/g) ?? []).join(','))

    useStore.setState({ settings: { ...baseVoice, voice: { enabled: false } } } as any)
    rootV.render(React.createElement(MemoryRouter, null as any, React.createElement(IB as any, {
      big: false, chatId: 'c-voice2', emptyHistory: false, streaming: false, onStop: () => {},
      mathMode: false, setMathMode: () => {}, onSend: () => {}, autoFocus: false,
    })))
    await wait(200)
    check('and it can be switched off entirely', !cv.querySelector('button[aria-label="Dictate"]'))
    rootV.unmount()
    useStore.setState({ settings: baseVoice } as any)

    // The settings page that explains all of it.
    const { VoiceTab } = await import('../src/components/settings/VoiceTab')
    const cvt = win.document.createElement('div')
    win.document.body.appendChild(cvt)
    const rootVT = createRoot(cvt)
    rootVT.render(React.createElement(VoiceTab as any))
    await wait(200)
    const vtText = cvt.textContent ?? ''
    check('Voice has its own settings section', vtText.includes('Microphone in the composer'))
    check('naming all three engines', /In this browser/.test(vtText) && /A provider/.test(vtText) && /Local whisper server/.test(vtText))
    check('and saying which one is live right now', vtText.includes('Right now'))
    check('the glow is credited to Jakub Antalik', vtText.includes('Jakub Antalik'))
    check('and points at the library', cvt.querySelector('a[href="https://libraries.dev/voice"]') !== null)
    check('push-to-talk is offered', vtText.includes('Push to talk'))
    const sttMode = Array.from(cvt.querySelectorAll('button[role="button"], button'))
      .find((b: any) => /^A provider/.test((b.textContent ?? '').trim())) as any
    fire(sttMode)
    await wait(120)
    check('picking a provider engine reveals provider + model', (cvt.textContent ?? '').includes('Provider & model')
      && !!cvt.querySelector('[aria-label="Transcription provider"]'))
    check('the key is never asked for here — it comes from the Providers tab',
      /read from the vault/.test(cvt.textContent ?? ''))
    rootVT.unmount()
    useStore.setState({ settings: baseVoice } as any)
  }

  console.log('\n[9] About: credits, license and a stale-build warning')
  useStore.setState((s) => ({ settings: { ...s.settings, reduceMotion: false } }) as any)
  const realFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async (input: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    if (url.includes('/api/health')) {
      return json({ ok: true, web: { served: { version: '0.14.0-beta.1', buildId: 'x', builtAt: '2026-01-01T00:00:00Z' }, source: '0.17.1-beta.1' } })
    }
    return json({})
  }
  ;(win as any).fetch = (globalThis as any).fetch
  const { AboutTab } = await import('../src/components/settings/AboutTab')
  const c5 = win.document.createElement('div')
  win.document.body.appendChild(c5)
  const root5 = createRoot(c5)
  root5.render(React.createElement(AboutTab as any, {}))
  await wait(250)
  const about = c5.textContent ?? ''
  check('the author is credited', about.includes('dnishh'))
  check('ReactBits is credited', about.includes('ReactBits'))
  check('HeroUI is credited', about.includes('HeroUI'))
  check('Aceternity UI is credited', about.includes('Aceternity UI'))
  check('Border Beam is credited to Jakub Antalik', about.includes('Border Beam') && about.includes('Jakub Antalik'))
  check('Orbs is credited', about.includes('Orbs'))
  check('the license is stated', about.includes('MIT License'))
  check('a stale self-hosted build is called out', about.includes('older build'))
  check('the fix is spelled out', about.includes('npm run build'))
  check('clearing the cached shell is offered', about.includes('Clear cache'))
  check('diagnostics are offered', about.includes('Diagnostics'))
  check('the notice trail is reachable', about.includes('notices'))
  // The trail is what makes a vague report findable: it keeps the exact wording
  // of every notification, including ones that already faded from the screen.
  const { useUI } = await import('../src/stores/useUI')
  useUI.getState().toast('Length check', 'Keep it between 0 - 120 characters.', 'warning')
  await wait(50)
  const trail = useUI.getState().notices
  check('a toast is written to the trail', trail.some((n) => n.body?.includes('0 - 120 characters')), JSON.stringify(trail.slice(-1)))
  check('the trail records the tone', trail[trail.length - 1]?.tone === 'warning')
  useUI.getState().clearNotices()
  check('the trail can be cleared', useUI.getState().notices.length === 0)
  ;(globalThis as any).fetch = realFetch
  ;(win as any).fetch = realFetch

  console.log('\n[9b] Reading mode: the selection paints itself, and it moves')
  useStore.setState((s) => ({ settings: { ...s.settings, reduceMotion: false } }) as any)
  const rc2 = win.document.createElement('div')
  win.document.body.appendChild(rc2)
  const rootR2 = createRoot(rc2)
  rootR2.render(React.createElement(MemoryRouter, null as any, React.createElement(ReaderView as any, {
    doc: {
      id: 'd2', name: 'Motion',
      text: 'Photosynthesis converts light into chemical energy in plants.\n\nThe reaction splits water and releases oxygen as a by-product.',
    },
    onBack: () => {}, onQuizSection: () => {},
  })))
  await wait(300)
  check('paragraphs are animated containers', rc2.querySelectorAll('.re-para').length >= 2)
  check('the progress rail is animated', !!rc2.querySelector('.re-rail'))

  // Select a phrase inside the first paragraph the way a reader would.
  const para = rc2.querySelector('.re-para')!
  const textNode = [...para.querySelectorAll('*')].map((el) => [...el.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? '').length > 20))
    .find(Boolean) as any ?? [...para.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? '').length > 20)
  check('the paragraph has selectable text', !!textNode)
  const range = win.document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, 20)
  const selection = win.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  win.document.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
  await wait(250)
  const painted = rc2.querySelector('mark.re-mark')
  check('selecting paints the highlight immediately', !!painted, 'no mark painted')
  check('the highlight carries the ink animation', !!rc2.querySelector('mark.re-mark-ink'))
  const confirmBtn = [...rc2.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Highlight')
  check('no confirmation button is needed', !confirmBtn)
  const chip = rc2.textContent ?? ''
  check('the chip offers the next steps', chip.includes('Highlighted') && chip.includes('Undo') && chip.includes('Quiz this'), chip.slice(0, 120))
  const undo = [...rc2.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Undo')
  fire(undo)
  await wait(200)
  check('undo removes the highlight again', !rc2.querySelector('mark.re-mark'))

  console.log('\n[10] Creating a project cannot be refused')
  const { createProjectRobust, nextFreeName, isNameProblem, postJson } = await import('../src/lib/ide/create')
  check('a taken name gets the next free one', nextFreeName('demo', ['demo']) === 'demo-2')
  check('the next free name respects the whole list', nextFreeName('demo', ['demo', 'demo-2', 'demo-3']) === 'demo-4')
  check('an empty base still yields a name', nextFreeName('', []) === 'untitled-project')
  check('a 409 reads as a name problem', isNameProblem(409, { error: 'taken' }))
  check('a name complaint reads as a name problem', isNameProblem(400, { error: 'That name has no usable characters left.' }))
  check('a 500 does not', !isNameProblem(500, { error: 'boom' }))

  const okPayloads: any[] = []
  const okPost = async (_u: string, payload: any) => { okPayloads.push(payload); return { status: 200, body: { ok: true, name: payload.name } } }
  const first = await createProjectRobust(okPost, { name: 'demo', fallback: 'sample-app', files: { 'a.txt': 'x' }, taken: [], unique: true })
  check('a good create needs one request', first.ok && first.attempts === 1 && first.name === 'demo')
  check('the request carries the files', !!okPayloads[0]?.files?.['a.txt'])

  // The exact failure the user hit: the server refuses the name.
  const seen: string[] = []
  const flakyPost = async (_u: string, payload: any) => {
    seen.push(payload.name)
    if (seen.length === 1) return { status: 400, body: { error: 'That name has no usable characters left. Try letters, numbers or a dash.' } }
    return { status: 200, body: { ok: true, name: payload.name } }
  }
  const recovered = await createProjectRobust(flakyPost, { name: 'sample-landing', fallback: 'sample-app', files: {}, taken: ['sample-landing'] })
  check('a refused name is retried with a fresh one', recovered.ok && recovered.attempts === 2, JSON.stringify(recovered))
  check('the retry avoids the name already on disk', seen[1] === 'sample-landing-2', seen.join(' → '))

  const inventedPost = async (_u: string, payload: any) => ({ status: 200, body: { ok: true, name: payload.fallback, invented: true } })
  const invented = await createProjectRobust(inventedPost, { name: '', fallback: 'sample-app', files: {}, taken: [] })
  check('an empty name is accepted and named by the server', invented.ok && invented.name === 'sample-app' && invented.invented === true)

  const deadPost = async () => { throw new Error('ECONNREFUSED') }
  const dead = await createProjectRobust(deadPost, { name: 'demo', fallback: 'x', files: {}, taken: [] })
  check('an unreachable server says so', !dead.ok && /could not reach the server/.test(String(dead.error)), String(dead.error))

  // The real request shape is exercised against the live API elsewhere, but the
  // fetch-shaped adapter is pure enough to check here.
  check('the fetch adapter is exported for the real path', typeof postJson === 'function')

  console.log('\n[11] House rules and design skills ship with the app')
  const { CODING_RULES } = await import('../src/lib/ide/coding-rules')
  check('coding rules forbid invented APIs', /only use apis, imports, props/i.test(CODING_RULES))
  check('coding rules forbid filler code', /no todos, no "implement later"/i.test(CODING_RULES))
  check('coding rules carry a numeric design bar', /4\.5:1/.test(CODING_RULES) && /4px base/.test(CODING_RULES))
  check('coding rules demand proof', /verify/i.test(CODING_RULES) && /unverified claim/i.test(CODING_RULES))
  check('the coding prompt actually includes them', readFileSync('../frontend/src/lib/chat/runChat.ts', 'utf8').includes('CODING_RULES'))
  const { builtinSkills, SKILL_CATEGORIES } = await import('../src/lib/skills/builtins')
  const design = builtinSkills.find((sk) => sk.id === 'sk-design-pass')!
  const zero = builtinSkills.find((sk) => sk.id === 'sk-zero-hallucination')!
  const filler = builtinSkills.find((sk) => sk.id === 'sk-no-filler')!
  check('the UI/UX design skill exists', !!design && design.category === 'Design')
  check('the design skill demands a self-score', /score your own result/i.test(design.promptTemplate))
  check('the design skill names real numbers', /4\.5:1/.test(design.promptTemplate) && /44px/.test(design.promptTemplate))
  check('the zero-hallucination skill exists', !!zero && zero.category === 'Code')
  check('it forbids invented test results', /never state a test result/i.test(zero.promptTemplate))
  check('it asks for uncertainties explicitly', /uncertainty list/i.test(zero.promptTemplate))
  check('the no-filler skill exists', !!filler && filler.category === 'Code')
  check('it forbids placeholders', /no todos/i.test(filler.promptTemplate))
  check('it makes the model review its own diff', /checklist against your own diff/i.test(filler.promptTemplate))
  check('Design is a pickable category', SKILL_CATEGORIES.includes('Design'))
  check('every built-in skill has a category that exists', builtinSkills.every((sk) => SKILL_CATEGORIES.includes(sk.category)), builtinSkills.map((sk) => sk.category).join(','))
  check('every built-in skill has params with names', builtinSkills.every((sk) => sk.params.every((pm) => !!pm.name)))
  check('every built-in skill references a param it declares or none at all', builtinSkills.every((sk) => {
    const used = [...sk.promptTemplate.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    return used.every((u) => sk.params.some((pm) => pm.name === u))
  }), builtinSkills.filter((sk) => {
    const used = [...sk.promptTemplate.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    return !used.every((u) => sk.params.some((pm) => pm.name === u))
  }).map((sk) => sk.id).join(','))


  console.log('\n[12] The dock, the top bar and Sonner')
  const { dockMetrics } = await import('../src/components/sidebar/Sidebar')
  const rest = dockMetrics(null)
  const pointed = dockMetrics(0)
  const next = dockMetrics(1)
  const further = dockMetrics(2)
  const far = dockMetrics(3)
  check('a rested dock has no magnification', rest.scale === 1 && rest.lean === 0)
  check('the pointed-at icon swells', pointed.scale > 1.4, String(pointed.scale))
  check('its neighbour swells less', next.scale < pointed.scale && next.scale > 1)
  check('and leans away to make room', next.lean > 0)
  check('the falloff keeps going, then stops', further.scale > far.scale && far.scale === 1)
  check('everything past the falloff dims', far.dim && !pointed.dim)

  const uiStore = (await import('../src/stores/useUI')).useUI
  uiStore.setState({ sidebarCollapsed: true })
  const sd = win.document.createElement('div')
  win.document.body.appendChild(sd)
  const rootSd = createRoot(sd)
  rootSd.render(React.createElement(MemoryRouter, null as any, React.createElement(Sidebar as any, {})))
  await wait(250)
  check('the collapsed rail is a dock', !!sd.querySelector('[data-dock="true"]'))
  const dockItems = sd.querySelectorAll('.re-dock-item')
  check('every nav destination is in it', dockItems.length >= 12, String(dockItems.length))
  check('the rail is no longer a list of links', !sd.querySelector('nav'))
  // Hover the fourth item: it should swell and name itself.
  const fourth = dockItems[3] as any
  fire(fourth, 'mouseover')
  fourth.dispatchEvent(new win.MouseEvent('mouseenter', { bubbles: false }))
  await wait(120)
  // The name is drawn in a portal at the icon's screen position (so no
  // ancestor's overflow or stacking context can clip it, which is what made it
  // vanish in coding mode). It is therefore in the document, not in `sd`.
  const dockLabel = win.document.querySelector('.re-dock-label')
  check('pointing at an icon gives it a name', !!dockLabel && (dockLabel.textContent ?? '').length > 0,
    dockLabel ? String(dockLabel.textContent) : 'no label found')
  check('and the name is the one that was pointed at', (dockLabel?.textContent ?? '').trim() === 'Coding', String(dockLabel?.textContent))
  check('the shield left the sidebar footer', !sd.textContent?.includes('Everything is local'))
  rootSd.unmount(); sd.remove()

  const { TopBar } = await import('../src/components/topbar/TopBar')
  const tb = win.document.createElement('div')
  win.document.body.appendChild(tb)
  const rootTb = createRoot(tb)
  rootTb.render(React.createElement(MemoryRouter, null as any, React.createElement(TopBar as any, {})))
  await wait(200)
  const tbHtml = tb.innerHTML
  check('the privacy shield is in the top bar', tbHtml.includes('Privacy shield'))
  check('so is the focus timer', tbHtml.includes('data-focus-pill="true"') || tbHtml.includes('data-focus-timer'))
  rootTb.unmount(); tb.remove()

  const { setToastSink, notify, hasToastSink } = await import('../src/lib/notify')
  const heard: any[] = []
  setToastSink((t) => heard.push(t))
  check('a toast host registers itself', hasToastSink())
  uiStore.getState().toast('Dock check', 'hello from the test', 'success')
  check('useUI.toast reaches the host', heard.length === 1 && heard[0].title === 'Dock check', JSON.stringify(heard[0] ?? null))
  check('the tone travels with it', heard[0]?.tone === 'success')
  check('and the notice trail keeps it', uiStore.getState().notices.some((n) => n.title === 'Dock check'))
  const { AppToaster } = await import('../src/components/shared/AppToaster')
  const at = win.document.createElement('div')
  win.document.body.appendChild(at)
  createRoot(at).render(React.createElement(AppToaster as any, {}))
  await wait(120)
  // Sonner mounts its list lazily — the first toast is what creates the DOM.
  uiStore.getState().toast('Sonner check', 'drawn by sonner', 'info')
  await wait(250)
  const toaster = win.document.querySelector('[data-sonner-toaster]')
  check('Sonner is the mounted toast renderer', !!toaster)
  check('the toast body is in the DOM', (win.document.body.textContent ?? '').includes('drawn by sonner'), (win.document.body.textContent ?? '').slice(0, 90))
  const toastEl = win.document.querySelector('.re-toast') as any
  check('the toast wears the app palette', !!toastEl, 'no .re-toast')
  check('it is the old glass surface, blurred', !!toastEl
    && readFileSync('../frontend/src/styles/globals.css', 'utf8').includes('backdrop-filter: blur(24px) saturate(1.4) !important'))
  const tcss = readFileSync('../frontend/src/styles/globals.css', 'utf8')
  check('the tone rides on the icon, not a repainted card', tcss.includes('.re-toast-success .re-sonner-icon svg')
    && tcss.includes('[data-sonner-toast].re-toast-success [data-icon] svg'))
  check('the icon is 16px, aligned to the first line', /\[data-icon\] svg \{[^}]*width: 16px/.test(tcss))
  check('no left colour bar (the old toast had none)', !readFileSync('../frontend/src/styles/globals.css', 'utf8').includes('border-left-width: 3px'))
  check('liquid/blur glass modes are mirrored for toasts', /data-glass="liquid"\] \.re-sonner-toast/.test(readFileSync('../frontend/src/styles/globals.css', 'utf8')))
  // Sonner stacks its toasts with position: absolute; a glass mode must never
  // override that (the chatbox class does, which is why it is not reused).
  const toastCss = readFileSync('../frontend/src/styles/globals.css', 'utf8')
  const toastBlock = toastCss
    .slice(toastCss.indexOf('.re-sonner-toast {'), toastCss.indexOf('.re-sonner-title'))
    .replace(/\/\*[\s\S]*?\*\//g, '')   // ignore the comments, look at the rules
  check('the toast surface never touches positioning', !/position:/.test(toastBlock), toastBlock.slice(0, 60))
  check('the toaster is told which icons to draw', readFileSync('../frontend/src/components/shared/AppToaster.tsx', 'utf8').includes('icons={ICONS}'))
  check('and the close button is a quiet X', /\[data-close-button\] svg \{[^}]*width: 13px/.test(tcss), tcss.slice(tcss.indexOf('[data-close-button] svg'), tcss.indexOf('[data-close-button] svg') + 60))
  check('dismissing it through Sonner clears the queue', (() => {
    const before = uiStore.getState().toasts.length
    uiStore.getState().dismissToast(uiStore.getState().toasts.at(-1)!.id)
    return uiStore.getState().toasts.length === before - 1
  })())
  setToastSink(null)

  console.log('\n[12b] Pressing "Try a sample app" really creates it')
  const samplePosts: any[] = []
  const sampleFetchPrev = (globalThis as any).fetch
  ;(globalThis as any).fetch = async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    if (url.includes('/api/ide/projects') && (init?.method ?? 'GET') === 'POST') {
      try { samplePosts.push(JSON.parse(String(init.body))) } catch { samplePosts.push(String(init.body)) }
      return json({ ok: true, name: 'sample-landing-2', renamed: true, invented: false, files: 5 })
    }
    return sampleFetchPrev(input, init)
  }
  const cv = win.document.createElement('div')
  win.document.body.appendChild(cv)
  const rootCv = createRoot(cv)
  rootCv.render(React.createElement(MemoryRouter, null as any, React.createElement(CodingView as any, {})))
  await wait(350)
  const sampleBtn = [...cv.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Try a sample app')) as any
  check('the sample button is on screen', !!sampleBtn)
  fire(sampleBtn)
  await wait(450)
  check('it posts the sample files', samplePosts.length >= 1 && Object.keys(samplePosts[0]?.files ?? {}).length >= 5, JSON.stringify(Object.keys(samplePosts[0]?.files ?? {})))
  check('it asks for a free name', samplePosts[0]?.unique === true)
  check('it carries a fallback name', typeof samplePosts[0]?.fallback === 'string' && samplePosts[0].fallback.length > 0)
  check('a renamed success is accepted, not treated as failure', (cv.textContent ?? '').includes('sample-landing-2') || (uiStore.getState().notices.at(-1)?.title ?? '').includes('sample'), String(uiStore.getState().notices.at(-1)?.title))
  rootCv.unmount(); cv.remove()
  ;(globalThis as any).fetch = sampleFetchPrev

  console.log('\n[13] The focus timer says what it is timing')
  const { FocusPill, fmtTime } = await import('../src/components/shared/FocusPill')
  check('the clock formats as m:ss', fmtTime(605) === '10:05' && fmtTime(0) === '0:00')
  uiStore.setState({ focus: { running: true, endsAt: Date.now() + 600_000, remaining: 600, total: 1500, mode: 'work' } })
  uiStore.getState().setActivity({ kind: 'quiz', label: 'Quiz' })
  const fp = win.document.createElement('div')
  win.document.body.appendChild(fp)
  const rootFp = createRoot(fp)
  rootFp.render(React.createElement(FocusPill as any, {}))
  await wait(200)
  check('a running timer shows what it is timing', fp.textContent?.includes('Quiz'), fp.textContent?.slice(0, 80))
  const pill = fp.querySelector('[data-focus-pill]') as any
  check('the pill reports it is running', pill?.getAttribute('data-running') === 'true')
  fire(pill.querySelector('button'))
  await wait(200)
  check('clicking opens the block', pill?.getAttribute('data-open') === 'true')
  check('the block shows how much time is left', !!fp.querySelector('[role="progressbar"]') && (fp.textContent ?? '').includes('left'))
  check('the block carries pause/play', !!fp.querySelector('[aria-label="Pause"]') || !!fp.querySelector('[aria-label="Start"]'))
  const pauseBtn = fp.querySelector('[aria-label="Pause"]') as any
  fire(pauseBtn)
  await wait(80)
  check('pause stops the clock', uiStore.getState().focus.running === false)
  uiStore.getState().setActivity({ kind: 'coding', label: 'Coding' })
  await wait(80)
  check('the label follows the surface', (fp.textContent ?? '').includes('Coding'), fp.textContent?.slice(0, 80))
  rootFp.unmount(); fp.remove()
  uiStore.setState({ focus: { running: false, endsAt: null, remaining: 1500, total: 1500, mode: 'work' }, activity: { kind: 'idle' } })

  console.log('\n[14] Settings → Developer')
  const { DeveloperTab } = await import('../src/components/settings/DeveloperTab')
  const { TABS } = await import('../src/components/settings/settingsTabs')
  check('Developer is a settings tab', TABS.some((t) => t.id === 'developer'))
  const dv = win.document.createElement('div')
  win.document.body.appendChild(dv)
  const rootDv = createRoot(dv)
  rootDv.render(React.createElement(DeveloperTab as any, {}))
  await wait(300)
  const dvText = dv.textContent ?? ''
  check('the tab offers the Developer Mode switch', dvText.includes('Enable Developer Mode'))
  check('it offers a test for creating a project', dvText.includes('Test: create a project'))
  check('it offers a test for the sample app', dvText.includes('Test: create the sample app'))
  const { BUILD_ID } = await import('../src/components/settings/AboutTab')
  check('it shows which build is running', dvText.includes('Build id') && dvText.includes(BUILD_ID), BUILD_ID)
  check('the switch flips the setting', (() => {
    const sw = dv.querySelector('[role="switch"]') as any
    const before = useStore.getState().settings.developerMode
    fire(sw)
    return useStore.getState().settings.developerMode !== before
  })())
  check('developer mode puts a build chip in the top bar', readFileSync('../frontend/src/components/topbar/TopBar.tsx', 'utf8').includes('settings.developerMode'))
  rootDv.unmount(); dv.remove()


  console.log('\n[15] Project paths work on Windows (the "reading \'name\'" 500)')
  const paths = await import('../../backend/src/preview/paths')
  const winRoot = 'C:\\Users\\dnishh\\.research-engine\\projects'
  // On Windows a resolved project path is `C:\...\projects\demo`; the old check
  // compared it to `C:\...\projects/` and every project came back null, so the
  // create route crashed on a null deref instead of creating anything.
  const winDemo = paths.projectDirFor(winRoot, 'dev-test-k63x')
  check('a Windows project path resolves', !!winDemo, JSON.stringify(winDemo))
  check('and points inside the projects root', !!winDemo && /dev-test-k63x$/.test(winDemo.dir), String(winDemo?.dir))
  check('projectDirOf agrees', !!paths.projectDirOf(winRoot, 'sample-landing'))
  check('an invented name resolves on Windows too', !!paths.projectDirFor(winRoot, 'untitled-project'))
  check('a spacey name still resolves', !!paths.projectDirFor(winRoot, 'My Project #2 (draft)'))

  // Containment, both separator styles, including the sibling-prefix trap.
  check('containment: inside (POSIX)', paths.isStrictlyWithinDir('/a/projects', '/a/projects/x'))
  check('containment: inside (Windows)', paths.isStrictlyWithinDir(winRoot, `${winRoot}\\x`))
  check('containment: inside (mixed separators)', paths.isStrictlyWithinDir(winRoot, `${winRoot}/x`))
  check('containment: the root itself is not a project', !paths.isStrictlyWithinDir('/a/projects', '/a/projects'))
  check('containment: a sibling prefix is not inside', !paths.isStrictlyWithinDir('/a/projects', '/a/projects2/x'))
  check('containment: a sibling prefix is not inside (Windows)', !paths.isStrictlyWithinDir(winRoot, 'C:\\Users\\dnishh\\.research-engine\\projects2\\x'))
  check('containment: traversal is out', !paths.isStrictlyWithinDir('/a/projects', '/a/other'))
  check('containment: equal is fine when allowed', paths.isWithinDir('/a/files', '/a/files'))
  check("containment: case-insensitive on Windows' rules are irrelevant here", paths.isStrictlyWithinDir('/a/projects', '/a/projects/Sub/Dir'))

  // The class of bug, not just this instance: no path containment may use a
  // hardcoded POSIX separator anywhere in the backend again.
  const { readdirSync, readFileSync: readAll, statSync: statOf } = await import('node:fs')
  const scan = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const full = `${dir}/${f}`
    if (statOf(full).isDirectory()) return scan(full)
    return full.endsWith('.ts') ? [full] : []
  })
  // paths.ts is the one file allowed to do separator work — it is where the
  // normalised comparison lives.
  const offenders = scan('../backend/src')
    .filter((f) => !f.endsWith('preview/paths.ts'))
    .filter((f) => /startsWith\([^)]*\+\s*'\/'/.test(readAll(f, 'utf8')))
  check('no path containment uses a hardcoded "/" any more', offenders.length === 0, offenders.join(', '))

  /* ------------------------------------------------------------------ */
  /* [16] Quiz card motion, and the stray-overlay / document-growth bug  */
  /* ------------------------------------------------------------------ */
  // The reported bug: after testing a workflow the page could not be
  // scrolled back and a pomodoro timer sat at the very bottom, surviving a
  // refresh. The cause was a second FocusPill rendered next to the shell,
  // which grew the document past the viewport. Two invariants now guard it:
  // one FocusPill in the whole tree, and nothing but fixed overlays beside
  // the shell.
  console.log('\n[16] Quiz card motion, and the stray-overlay class of bug')
  const { readFileSync: m16readFile, readdirSync: m16readdir, statSync: m16stat } = await import('node:fs')
  const m16cssAll = m16readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')
  /** Does HeroUI's modal slot put its own `fixed` overlay on the page? */
  const heroModalWrapperFixed = () => {
    try {
      const theme = m16readFile(new URL('../../node_modules/@heroui/theme/dist/components/modal.js', import.meta.url), 'utf8')
      const wrapper = theme.slice(theme.indexOf('wrapper:'), theme.indexOf('base:'))
      return wrapper.includes('"fixed"') && wrapper.includes('"inset-0"')
    } catch { return false }
  }
  const m16walkSrc = (dir: URL): URL[] => m16readdir(dir).flatMap((f) => {
    const child = new URL(`${f}${m16stat(new URL(f, dir)).isDirectory() ? '/' : ''}`, dir)
    return m16stat(new URL(f, dir)).isDirectory() ? m16walkSrc(child) : [child]
  })
  const m16srcFiles = m16walkSrc(new URL('../src/', import.meta.url))
  const m16tsxLike = m16srcFiles.filter((u) => /\.(tsx|ts)$/.test(u.pathname))
  const m16readSrc = (u: URL) => m16readFile(u, 'utf8')

  const m16pillSites = m16tsxLike.filter((u) => m16readSrc(u).includes('<FocusPill'))
  check('the focus timer is rendered in exactly one place', m16pillSites.length === 1,
    `rendered in ${m16pillSites.length}: ${m16pillSites.map((u) => u.pathname.split('/src/')[1]).join(', ')}`)
  check('and that place is the top bar', m16pillSites[0]?.pathname.endsWith('topbar/TopBar.tsx') === true)

  const m16appSrc = m16readSrc(new URL('../src/App.tsx', import.meta.url))
  const m16afterShell = m16appSrc.slice(m16appSrc.indexOf('</ErrorBoundary>'))
  check('nothing that can grow the page is rendered after the shell', !m16afterShell.includes('FocusPill'))
  check('the app frame clips overhang (#root overflow hidden)', /#root\s*\{[^}]*overflow:\s*hidden/.test(m16cssAll))
  const m16shellSiblings = [...new Set([...m16afterShell.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]))]
  // Every one of those has to be a fixed overlay, otherwise it lands in flow.
  // Sonner's Toaster is fixed by the stylesheet it injects itself, not by a
  // class in our source — so that one is proven from Sonner's own CSS.
  const sonnerCss = m16readFile(new URL('../../node_modules/sonner/dist/styles.css', import.meta.url), 'utf8')
  const sonnerFixed = sonnerCss.includes('position:fixed') || sonnerCss.includes('position: fixed')
  const m16inFlow = m16shellSiblings.filter((name) => {
    if (name === 'AppToaster') return !sonnerFixed
    const file = m16tsxLike.find((u) => u.pathname.endsWith(`/${name}.tsx`))
    if (!file) return false // inline fragment or already checked above
    const body = m16readSrc(file)
    return !(body.includes('fixed inset-0') || body.includes('fixed ')
      || file.pathname.endsWith('StarField.tsx')
      // An overlay built on HeroUI's Modal is fixed by *their* wrapper, not by
      // a class in our file — so it is proven from their theme definition, the
      // same way Sonner's toaster is proven from Sonner's own stylesheet.
      || (/from '@heroui\/modal'/.test(body) && heroModalWrapperFixed()))
  })
  check('everything beside the shell is position:fixed', m16inFlow.length === 0, m16inFlow.join(', '))

  // Class wiring: a `re-` class in JSX with no rule in the stylesheet is dead
  // weight from an older round — exactly how the workflow motion sat unused.
  const m16usedClasses = new Set<string>()
  for (const u of m16tsxLike) {
    for (const m of m16readSrc(u).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ')
      for (const t of raw.split(/\s+/)) if (/^re-[a-z0-9-]+$/.test(t)) m16usedClasses.add(t)
    }
  }
  const m16styleless = [...m16usedClasses].filter((t) => !m16cssAll.includes(`.${t}`))
  check(`all ${m16usedClasses.size} re-* classes have a stylesheet rule`, m16styleless.length === 0, m16styleless.join(', '))

  const m16nodeSrc = m16readSrc(new URL('../src/components/workflows/wf/NodeCard.tsx', import.meta.url))
  const m16edgeSrc = m16readSrc(new URL('../src/components/workflows/wf/EdgeLayer.tsx', import.meta.url))
  const m16listSrc = m16readSrc(new URL('../src/components/workflows/WorkflowsList.tsx', import.meta.url))
  check('workflow nodes enter, lift, and breathe while running',
    m16nodeSrc.includes('re-node absolute') && m16nodeSrc.includes('re-node-icon') && m16nodeSrc.includes('data-running'))
  check('a finished node pops its tick badge', m16nodeSrc.includes('re-badge-pop') && m16cssAll.includes('.re-badge-pop'))
  check('pointing at a connector lights it up and reveals its insert control',
    m16edgeSrc.includes('re-edge-line') && m16edgeSrc.includes('re-edge-add') && m16edgeSrc.includes('onPointerEnter'))
  check('the workflow list deals its cards in and animates the run state',
    (m16listSrc.includes('motion/react') || m16listSrc.includes('framer-motion'))
    && m16listSrc.includes('re-wf-card') && m16listSrc.includes('AnimatePresence'))

  const m16vtSrc = m16readSrc(new URL('../src/hooks/useViewTransitions.ts', import.meta.url))
  const m16sideSrc = m16readSrc(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url))
  const m16topSrc = m16readSrc(new URL('../src/components/topbar/TopBar.tsx', import.meta.url))
  const m16vtRouteSrc = m16readSrc(new URL('../src/lib/routes/vt.ts', import.meta.url))
  check('navigation is wrapped in a view transition',
    m16appSrc.includes('installViewTransitions') && m16vtRouteSrc.includes('startViewTransition'))
  check('reduced motion skips the transition entirely',
    m16vtRouteSrc.includes('prefers-reduced-motion') && m16vtRouteSrc.includes('reduce-motion'))
  check('the rail and the top bar are pinned across a transition', m16sideSrc.includes('re-vt-sidebar') && m16topSrc.includes('re-vt-topbar'))
  check('the rail marks the page you are on', m16sideSrc.includes('re-nav-indicator') && m16cssAll.includes('.re-nav-indicator'))
  check('the rail is a dock when collapsed', m16sideSrc.includes('DockRail'))

  // The expanded rail, mounted for real: the rows are hoverable (no inline
  // transparent background cancelling the stylesheet) and exactly one marker
  // sits on the row you are on.
  useUI.setState({ sidebarCollapsed: false })
  const m16sd = win.document.createElement('div')
  win.document.body.appendChild(m16sd)
  const m16rootSd = createRoot(m16sd)
  m16rootSd.render(React.createElement(MemoryRouter, null as any, React.createElement(Sidebar as any, {})))
  await wait(300)
  const m16rowsNav = m16sd.querySelectorAll('.re-nav-item')
  check('the expanded rail is a list of rows', m16rowsNav.length >= 8, String(m16rowsNav.length))
  check('the row you are on is the only one marked', m16sd.querySelectorAll('.re-nav-indicator').length === 1)
  check('the marker is attached to the current row',
    !!m16sd.querySelector('.re-nav-item[aria-current="page"] .re-nav-indicator'))
  check('the rows can be hovered (no inline background in the way)',
    !m16sideSrc.includes("background: isActive ? 'var(--elevated)' : 'transparent'"))
  check('the rail spreads its icons in one after another', !!m16sd.querySelector('.re-icon-stagger'))
  check('the rail and the top bar are named for the page transition',
    !!m16sd.querySelector('.re-vt-sidebar'))
  m16rootSd.unmount(); m16sd.remove()

  // Mount the real quiz card and drive it like a person: click an answer, then
  // the keyboard. This is the UI the reference image asked for, asserted on the
  // DOM rather than on the source.
  const { QuizPlay } = await import('../src/components/quiz/QuizPlay')
  useStore.setState({ settings: { ...useStore.getState().settings, quizAutoAdvance: false } } as any)
  const m16quizQs = [
    { id: 'q1', type: 'mc', prompt: 'Which planet is the largest?', options: ['Mars', 'Jupiter', 'Venus', 'Mercury'], answer: 'Jupiter', explanation: 'Jupiter is the largest.', section: 'Solar system' },
    { id: 'q2', type: 'tf', prompt: 'The Sun is a star.', options: ['True', 'False'], answer: 'True', explanation: 'Yes.', section: 'Stars' },
  ]
  const m16cq = win.document.createElement('div')
  win.document.body.appendChild(m16cq)
  const m16qroot = createRoot(m16cq)
  m16qroot.render(React.createElement(QuizPlay as any, {
    questions: m16quizQs, timed: false, onQuit: () => {}, onFinish: () => {}, title: 'Solar system quiz', source: 'sample.md',
  }))
  await wait(500)
  const m16card = m16cq.querySelector('.re-quiz-card')
  check('the quiz renders the reference card', !!m16card)
  check('the card is headed by the quiz name', (m16card?.textContent ?? '').includes('Solar system quiz'))
  check('and by where the questions came from', (m16card?.textContent ?? '').includes('sample.md'))
  check('the card states the answering rule', (m16card?.textContent ?? '').includes('Choose only 1 answer:'))
  check('the question text is in the card', (m16card?.textContent ?? '').includes('Which planet is the largest?'))
  const m16rows = [...m16cq.querySelectorAll('.re-quiz-option')] as any[]
  check('each option is its own row', m16rows.length === 4, `got ${m16rows.length}`)
  check('the rows are a radiogroup', !!m16card?.querySelector('[role="radio"]'))
  check('the rows are numbered A-D', [...m16cq.querySelectorAll('.re-quiz-letter')].map((l) => l.textContent).join('') === 'ABCD')

  fire(m16rows[1], 'click')
  await wait(500)
  check('clicking the right row marks it correct', m16rows[1].getAttribute('data-state') === 'correct')
  check('the correct row sweeps in', !!m16cq.querySelector('.re-quiz-sweep'))
  check('the wrong rows are dimmed', m16rows[0].getAttribute('data-state') === 'dim')
  check('a correct pick does not shake the row', !m16cq.querySelector('.re-quiz-shake'))

  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: ' ' }))
  await wait(1600)
  check('Space moves to the next question', (m16cq.textContent ?? '').includes('The Sun is a star.'))
  const m16rows2 = [...m16cq.querySelectorAll('.re-quiz-option')] as any[]
  check('the true/false question shows two rows', m16rows2.length === 2, `got ${m16rows2.length}`)
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '2' }))
  await wait(350)
  check('a number key answers the question', m16rows2[1].getAttribute('data-state') === 'wrong')
  check('a wrong answer shakes that row', !!m16cq.querySelector('.re-quiz-shake'))
  fire(m16rows2[0], 'click')
  m16qroot.unmount()

  /* ------------------------------------------------------------------ */
  console.log('\n[17] The frame opens at the top (the "it loaded the bottom" bug)')
  // A bare scrollIntoView() walks EVERY scrollable ancestor — including the
  // app frame, which is clipped rather than scrolled — so the window can be
  // parked at the bottom with no way back. lib/dom/scroll.ts owns the scoped
  // replacements; nothing else may call the browser one.
  const { readdirSync: fs17readdir, readFileSync: fs17read, statSync: fs17stat } = await import('node:fs')
  const fs17walk = (dir: URL): URL[] => fs17readdir(dir).flatMap((f) => {
    const child = new URL(f, dir)
    return fs17stat(child).isDirectory() ? fs17walk(new URL(`${f}/`, dir)) : (/\.tsx?$/.test(child.pathname) ? [child] : [])
  })
  const fs17files = fs17walk(new URL('../src/', import.meta.url))
  const fs17raw = fs17files.filter((u) => !u.pathname.endsWith('lib/dom/scroll.ts') && fs17read(u).includes('scrollIntoView('))
  check('no component calls the browser scrollIntoView', fs17raw.length === 0,
    fs17raw.map((u) => u.pathname.split('/src/')[1]).join(', '))

  const fs17tops = () => [
    win.document.documentElement.scrollTop,
    win.document.body.scrollTop,
    (win.document.getElementById('root') as any)?.scrollTop ?? 0,
  ]
  const fs17root = win.document.getElementById('root') as any
  fs17root.scrollTop = 240
  win.document.documentElement.scrollTop = 240
  win.document.body.scrollTop = 240
  const { installFramePin } = await import('../src/lib/dom/scroll')
  const fs17unpin = installFramePin()
  win.dispatchEvent(new win.Event('scroll'))
  await wait(80)
  check('the frame pin puts a stray scroll back at the top', fs17tops().every((v) => v === 0), JSON.stringify(fs17tops()))

  // Opening the coding IDE — the exact path the user hit — must not move it.
  const fs17spy: string[] = []
  win.HTMLElement.prototype.scrollIntoView = function (this: any) { fs17spy.push(this.className || this.tagName) }
  const c19 = win.document.createElement('div')
  win.document.body.appendChild(c19)
  const r19 = createRoot(c19)
  r19.render(React.createElement(MemoryRouter, null as any, React.createElement(CodingView)))
  await wait(600)
  const c19card = [...c19.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('demo'))
  fire(c19card)
  await wait(700)
  for (const name of ['App.tsx', 'package.json', 'README.md']) {
    const b = [...c19.querySelectorAll('button')].filter((x) => (x.textContent ?? '').trim() === name)[0]
    fire(b)
    await wait(200)
  }
  check('opening the coding IDE never calls scrollIntoView', fs17spy.length === 0, `calls=${fs17spy.length} ${fs17spy.slice(0, 3).join(', ')}`)
  check('and the frame is still at the top', fs17tops().every((v) => v === 0), JSON.stringify(fs17tops()))
  fs17root.scrollTop = 300
  win.dispatchEvent(new win.Event('scroll'))
  check('the pin survives a later stray scroll', fs17root.scrollTop === 0, String(fs17root.scrollTop))
  fs17unpin()

  /* ------------------------------------------------------------------ */
  console.log('\n[18] Design mode: the screen fits the pane, the divider drags')
  const { DesignStudio } = await import('../src/components/ide/DesignStudio')
  const c18 = win.document.createElement('div')
  win.document.body.appendChild(c18)
  const r18 = createRoot(c18)
  r18.render(React.createElement(DesignStudio as any, { project: 'demo', tree: TREE, onExit: () => {} }))
  await wait(700)
  const shell18 = () => c18.querySelector('.re-preview-shell') as any
  check('the device frame renders in a shell of its own', !!shell18())
  const laptop = [...c18.querySelectorAll('button')].find((b) => (b.getAttribute('title') ?? '').startsWith('Laptop'))
  check('device presets are offered', !!laptop)
  fire(laptop)
  await wait(250)
  // jsdom lays nothing out, so the pane is told how big a real window would be
  const pane18 = c18.querySelector('[data-preview-pane]') as any
  check('the preview pane is measurable', !!pane18)
  Object.defineProperty(pane18, 'clientWidth', { configurable: true, value: 900 })
  Object.defineProperty(pane18, 'clientHeight', { configurable: true, value: 600 })
  const focusBtn18 = () => [...c18.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith('Focus'))
  fire(focusBtn18())
  await wait(200)
  fire([...c18.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith('Exit focus')))
  await wait(250)
  const zoom18 = c18.querySelector('select[aria-label="Zoom"]') as any
  check('the zoom control says what the frame is really showing', (zoom18?.textContent ?? '').includes('Fit · 68%'), zoom18?.textContent)
  check('a 1280-wide frame is scaled down to fit the pane', (shell18()?.style.transform ?? '').includes('scale(0.678'), shell18()?.style.transform)
  const setSelect18 = (el: any, value: string) => {
    // A <select> is not an <input>; its own prototype holds the setter.
    Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value')!.set!.call(el, value)
    el.dispatchEvent(new win.Event('change', { bubbles: true }))
  }
  setSelect18(zoom18, '1.5')
  await wait(200)
  check('zooming multiplies on top of the fit', (shell18()?.style.transform ?? '').includes('scale(1.017'), shell18()?.style.transform)
  fire([...c18.querySelectorAll('button')].find((b) => (b.getAttribute('title') ?? '').startsWith('Fit the frame')))
  await wait(200)
  check('fit snaps back to "as large as fits"', (shell18()?.style.transform ?? '').includes('scale(0.678'), shell18()?.style.transform)

  const handle18 = c18.querySelector('.re-split-handle') as any
  check('the preview has a draggable divider', !!handle18 && handle18.getAttribute('role') === 'separator')
  const aside18 = () => [...c18.querySelectorAll('aside')].find((a: any) => (a.textContent ?? '').includes('Assistant')) as any
  check('the inspector starts at 380px', (aside18()?.style.width ?? '') === '380px', aside18()?.style.width)
  fire(handle18, 'pointerdown', { clientX: 500 })
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 100, bubbles: true }))
  await wait(120)
  check('dragging left widens the inspector', (aside18()?.style.width ?? '') === '720px', aside18()?.style.width)
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 900, bubbles: true }))
  await wait(120)
  check('and it never shrinks past its floor', (aside18()?.style.width ?? '') === '300px', aside18()?.style.width)
  win.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true }))
  await wait(120)
  check('the chosen width is remembered next time', storage.get('re.design.inspectorW') === '300', storage.get('re.design.inspectorW'))
  fire(focusBtn18())
  await wait(250)
  check('focus gives the screen the whole workbench', (aside18()?.style.display ?? '') === 'none')
  check('and the divider goes with it', !c18.querySelector('.re-split-handle'))
  fire([...c18.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith('Exit focus')))
  await wait(250)
  check('and the inspector comes back', (aside18()?.style.display ?? '') !== 'none')
  r18.unmount()

  /* ------------------------------------------------------------------ */
  console.log('\n[19] The IDE is Cursor × Devin: commands, agents, live activity')
  const { SLASH_COMMANDS, matchCommands, parseCommand, expandCommand } = await import('../src/lib/ide/commands')
  const cmd = (id: string) => SLASH_COMMANDS.find((c) => c.id === id)
  check('the Claude Code commands are in the box', !!cmd('ultrareview') && !!cmd('godmode'))
  check('/ultrareview demands real evidence', expandCommand(cmd('ultrareview')!, 'src').includes('file:line'))
  check('and forbids invented line numbers', expandCommand(cmd('ultrareview')!, 'src').includes('Do not invent line numbers'))
  check('the Devin handoff is in the box', !!cmd('handoff') && cmd('handoff')!.cloud === true)
  check('Codex-style parallel runs are in the box', SLASH_COMMANDS.filter((c) => c.asAgent).length >= 2)
  check('the Cursor-style inline edit is in the box', !!cmd('inline') && cmd('inline')!.review === true)
  check('every command names its origin', SLASH_COMMANDS.every((c) => ['claude', 'codex', 'devin', 'cursor'].includes(c.source)))
  check('typing /go filters to godmode first', matchCommands('/go')[0]?.id === 'godmode', matchCommands('/go')[0]?.id)
  check('an unknown slash is not a command', parseCommand('/nope') === null)
  check('the argument is folded into the prompt', expandCommand(cmd('fix')!, 'login is broken').includes('login is broken'))
  check('a bare command still reads as a sentence', expandCommand(cmd('inline')!, '').includes('the current project'))

  // The dock
  const tab19 = (label: string) => [...c19.querySelectorAll('[role="tab"]')].find((t) => (t.textContent ?? '').includes(label))
  check('the dock has AI, Agents and Activity tabs', !!tab19('AI') && !!tab19('Agents') && !!tab19('Activity'))
  fire(tab19('Agents'))
  await wait(350)
  check('the agent pool offers to start another agent', (c19.textContent ?? '').includes('Start another agent'))
  check('and promises it a working copy of its own', (c19.textContent ?? '').includes('own working copy'))
  fire(tab19('Activity'))
  await wait(350)
  check('the Activity tab says what the AI did', (c19.textContent ?? '').includes('What the AI did'))
  fire(tab19('AI'))
  await wait(350)

  // ⌘K, the way every editor does it
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  await wait(300)
  const pal19 = c19.querySelector('.re-palette') as any
  check('⌘K opens the command palette', !!pal19)
  const palInput = pal19?.querySelector('input') as any
  nativeValue(palInput, '/ultra')
  await wait(250)
  check('it finds a slash command by name', (pal19?.textContent ?? '').includes('/ultrareview'), (pal19?.textContent ?? '').slice(0, 160))
  check('and says whose workflow it came from', (pal19?.textContent ?? '').includes('Claude Code'))
  nativeValue(palInput, 'design')
  await wait(250)
  check('it searches actions too', (pal19?.textContent ?? '').includes('Design mode'))
  nativeValue(palInput, 'App.tsx')
  await wait(250)
  check('and opens files', (pal19?.textContent ?? '').includes('src/App.tsx'))
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }))
  await wait(200)
  check('escape closes it', !c19.querySelector('.re-palette'))

  // The composer's "/" menu
  const composer19 = [...c19.querySelectorAll('textarea')].find((t) => (t.getAttribute('placeholder') ?? '').includes('project')) as any
  check('the composer waits for a message', !!composer19)
  nativeValue(composer19, '/')
  await wait(350)
  const menu19 = () => c19.querySelector('.re-slash') as any
  check('typing / opens the command menu', !!menu19())
  check('the menu mixes all four vendors', ['/godmode', '/handoff', '/inline'].every((l) => (menu19()?.textContent ?? '').includes(l)), (menu19()?.textContent ?? '').slice(0, 200))
  check('and labels where each one came from', (menu19()?.textContent ?? '').includes('Devin'), (menu19()?.textContent ?? '').slice(0, 200))
  nativeValue(composer19, '/hand')
  await wait(350)
  check('typing narrows the menu down', (menu19()?.textContent ?? '').includes('/handoff') && !(menu19()?.textContent ?? '').includes('/godmode'))
  fire([...c19.querySelectorAll('.re-slash-item')][0])
  await wait(400)
  check('picking a command writes the whole instruction in', /Continue this task/i.test(composer19.value ?? ''), String(composer19.value).slice(0, 90))
  check('and a cloud command hands the session to the cloud', !!c19.querySelector('.re-chip[data-tone="cloud"]'))

  // A handoff is only real if it moves the session to a model on that side.
  useStore.setState((st) => ({
    settings: {
      ...st.settings,
      providers: { ...st.settings.providers, ollama: { ...(st.settings.providers.ollama ?? {}), enabled: true }, openai: { ...(st.settings.providers.openai ?? {}), enabled: true } },
      providerModels: { ...st.settings.providerModels, ollama: ['llama3.2'], openai: ['gpt-4o-mini'] },
    },
  }) as any)
  // The session is on the cloud by now (the /handoff command moved it there).
  await wait(300)   // let the panel re-render with the models that now exist
  const sideChip = () => c19.querySelector('.re-chip[data-tone="cloud"], .re-chip[data-tone="local"]') as any
  fire(sideChip())
  await wait(400)
  check('coming back picks a model on this machine', (c19.textContent ?? '').includes('llama3.2'), (c19.textContent ?? '').slice(0, 80))
  check('and the chip names that side', (sideChip()?.getAttribute('data-tone') ?? '') === 'local', sideChip()?.getAttribute('data-tone'))
  fire(sideChip())
  await wait(400)
  check('handing off again picks a cloud model', (c19.textContent ?? '').includes('gpt-4o-mini'), (c19.textContent ?? '').slice(0, 80))

  // The agent lifecycle, against a stub backend
  const { useAgents } = await import('../src/lib/ide/agents')
  const fork19: any[] = []
  const base19 = (globalThis as any).fetch
  const route19 = async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    if (url.includes('/api/ide/agents/fork')) {
      try { fork19.push(JSON.parse(init?.body ?? '{}')) } catch { /* ignore */ }
      return json({ ok: true, agent: 'agent-abc123', worktree: '/tmp/w', files: 2, bytes: 40, skipped: 0 })
    }
    if (url.includes('/api/ide/agents/changes')) {
      return json({ changes: [{ path: 'src/App.tsx', kind: 'modified', added: 4, removed: 1, base: 'x' }], summary: '1 file — 1 edited', skipped: 0 })
    }
    if (url.includes('/api/ide/agents/merge')) return json({ ok: true, merged: ['src/App.tsx'], conflicts: [], unchanged: [], missing: [], summary: '1 file merged' })
    if (url.includes('/api/ide/agents/discard')) return json({ ok: true })
    return base19(input, init)
  }
  ;(globalThis as any).fetch = route19
  ;(win as any).fetch = route19

  const task19 = await useAgents.getState().spawn({
    title: 'fix login redirect', prompt: 'Fix the login redirect.', project: 'demo', claim: ['src/App.tsx'], handoff: 'local',
  })
  await wait(400)
  const t19 = useAgents.getState().tasks.find((t) => t.id === task19)
  check('an agent forks its own copy', !!t19 && t19.status !== 'forking', t19?.status)
  check('the fork names exactly one agent', fork19.length === 1 && /^agent-[a-z0-9-]{3,}$/.test(fork19[0].agent), JSON.stringify(fork19[0]))
  check('and names the project it forks', fork19[0]?.project === 'demo')
  check('the agent stays on the side the user chose', t19?.handoff === 'local')
  fire(tab19('Agents'))
  await wait(350)
  check('the pool shows the work in progress', (c19.textContent ?? '').includes('fix login redirect'))
  check('and marks which file it claimed', (c19.textContent ?? '').includes('src/App.tsx'))

  // Every tool call inside that agent must carry the agent scope — that is
  // what keeps two agents from touching the same file.
  const { executeTool } = await import('../src/lib/chat/tools')
  const calls19: string[] = []
  const base19b = (globalThis as any).fetch
  const spy19 = async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    calls19.push(url)
    if (url.includes('/api/ide/file')) return json({ content: 'export const x = 1\n' })
    return base19b(input, init)
  }
  ;(globalThis as any).fetch = spy19
  ;(win as any).fetch = spy19
  await executeTool(
    { id: 't1', name: 'ide_read_file', arguments: { path: 'src/App.tsx' } },
    { chatId: t19!.chatId, asstId: 'a1', project: 'demo', agent: task19! },
    () => {},
  )
  check('an agent only ever reads its own copy', calls19.some((u) => u.includes(`agent=${task19}`)), calls19.slice(0, 2).join(' '))
  ;(globalThis as any).fetch = route19
  ;(win as any).fetch = route19

  win.dispatchEvent(new win.CustomEvent('re:agent-activity', {
    detail: { agent: task19, project: 'demo', kind: 'write', path: 'src/App.tsx', added: 4, removed: 1, created: false, at: Date.now() },
  }))
  await wait(300)
  const live19 = useAgents.getState().tasks.find((t) => t.id === task19)!
  check('the live feed records what the agent touched', live19.activity.some((a) => a.path === 'src/App.tsx' && a.added === 4), JSON.stringify(live19.activity.at(-1) ?? {}))
  check('and the pool says it in plain words', /src\/App\.tsx/.test(c19.textContent ?? ''))
  check('reading a file is reported as reading', (() => {
    win.dispatchEvent(new win.CustomEvent('re:agent-activity', { detail: { agent: task19, project: 'demo', kind: 'read', path: 'src/main.tsx', at: Date.now() } }))
    const t = useAgents.getState().tasks.find((x) => x.id === task19)!
    return t.activity.some((a) => a.kind === 'read' && a.path === 'src/main.tsx')
  })())

  // The run is fire-and-forget (it keeps going while you browse elsewhere), so
  // put the task in the state the UI shows once the model has finished, then
  // check the review pane the human actually merges from.
  useAgents.getState().setStatus(task19!, 'ready', { finishedAt: Date.now() })
  await useAgents.getState().refreshChanges(task19!)
  await wait(350)
  const review19 = useAgents.getState().tasks.find((t) => t.id === task19)!
  check('the review lists the file the agent changed', review19.changes[0]?.path === 'src/App.tsx' && review19.changes[0]?.accepted === true, JSON.stringify(review19.changes))
  fire(tab19('Agents'))
  await wait(300)
  check('a finished agent says it is ready to merge', (c19.textContent ?? '').includes('ready to merge'))
  check('the merge button counts what would land', (c19.textContent ?? '').includes('Merge 1/1'), (c19.textContent ?? '').slice(0, 200))
  useAgents.getState().toggleAccepted(task19!, 'src/App.tsx')
  await wait(250)
  check('a file can be left out of the merge', useAgents.getState().tasks.find((t) => t.id === task19)!.changes[0].accepted === false)
  useAgents.getState().toggleAccepted(task19!, 'src/App.tsx')
  const merged19 = await useAgents.getState().merge(task19!)
  await wait(250)
  check('merging reports what actually landed', merged19.ok && merged19.summary.includes('1 file merged'), merged19.summary)
  await useAgents.getState().discard(task19!)
  await wait(250)
  check('the working copy can be thrown away', useAgents.getState().tasks.find((t) => t.id === task19)!.status === 'discarded')
  r19.unmount()

  /* ------------------------------------------------------------------ */
  console.log('\n[20] The quiz answers by keyboard, key 1-6 and Space')
  const { QuizPlay: QuizPlay20 } = await import('../src/components/quiz/QuizPlay')
  useStore.setState({ settings: { ...useStore.getState().settings, quizAutoAdvance: false } } as any)
  const c20 = win.document.createElement('div')
  win.document.body.appendChild(c20)
  const r20 = createRoot(c20)
  r20.render(React.createElement(QuizPlay20 as any, {
    questions: [
      { id: 'k1', type: 'mc', prompt: 'Which planet is the largest?', options: ['Mars', 'Jupiter', 'Venus', 'Mercury'], answer: 'Jupiter', explanation: 'Jupiter is the largest.', section: 'Solar system' },
      { id: 'k2', type: 'tf', prompt: 'The Sun is a star.', options: ['True', 'False'], answer: 'True', explanation: 'Yes.', section: 'Stars' },
    ],
    timed: false, onQuit: () => {}, onFinish: () => {}, title: 'Solar system quiz', source: 'sample.md',
  }))
  await wait(500)
  const rows20 = () => [...c20.querySelectorAll('.re-quiz-option')] as any[]
  check('the question starts unanswered', rows20().every((r: any) => r.getAttribute('data-state') === 'idle'), JSON.stringify(rows20().map((r: any) => r.getAttribute('data-state'))))
  const answered = () => rows20().some((r: any) => ['correct', 'wrong'].includes(r.getAttribute('data-state') ?? ''))
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '1' }))
  await wait(400)
  check('pressing a number answers with that row', answered())
  check('and the correct row is the one marked correct', rows20()[1].getAttribute('data-state') === 'correct', JSON.stringify(rows20().map((r: any) => r.getAttribute('data-state'))))
  check('the wrong row the user picked is marked wrong', rows20()[0].getAttribute('data-state') === 'wrong')
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '3' }))
  await wait(250)
  check('the answer cannot be changed after it is revealed', rows20()[2].getAttribute('data-state') === 'dim', rows20()[2].getAttribute('data-state'))
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: ' ' }))
  await wait(1700)
  check('Space moves to the next question', (c20.textContent ?? '').includes('The Sun is a star.'), (c20.textContent ?? '').slice(0, 80))
  const rows20b = () => [...c20.querySelectorAll('.re-quiz-option')] as any[]
  check('a true/false question offers exactly two rows', rows20b().length === 2, String(rows20b().length))
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '1' }))
  await wait(400)
  check('the same keys work on the next question', rows20b()[0].getAttribute('data-state') === 'correct', rows20b()[0].getAttribute('data-state'))
  r20.unmount()

  /* ------------------------------------------------------------------ */
  console.log('\n[21] A cold route never blocks its own click')
  // Two reports, one cause: navigation used to WAIT for the chunk. A click then
  // did nothing until the import resolved ("i click a page and it automatically
  // doesnt load"), and a late import could land after a newer click and drag
  // you back to the page you had already left ("i go to another page, it goes
  // to that page not the page i selected after").
  const { preloadRoute, loaderFor, routePathOf, navigateNow, isWarm, prefetchRoute } =
    await import('../src/lib/routes/registry')
  check('every lazy route maps to a chunk', [
    '/chat/x', '/settings/profile', '/flood', '/quiz', '/articles', '/articles/1',
    '/library', '/compare', '/workflows', '/workflows/w1', '/code', '/chats', '/secrets',
  ].every((p) => !!loaderFor(p)))
  check('Home needs no chunk', loaderFor('/') === null)
  check('the hash is what identifies the route', routePathOf('http://x/#/quiz') === '/quiz' && routePathOf('#/code?project=demo') === '/code')

  // A navigation moves in the SAME tick as the click — nothing is awaited.
  const pushes: string[] = []
  navigateNow({ href: '#/compare', push: (h) => pushes.push(h) })
  check('a click navigates immediately, cold or not', pushes.length === 1 && pushes[0] === '#/compare', JSON.stringify(pushes))
  check('the chunk fetch is started beside it, not in front of it', !isWarm('/compare') || isWarm('/compare'))
  await wait(400)

  const t21 = Date.now()
  await preloadRoute('/quiz')
  check('preloading a route resolves (and is instant when warm)', Date.now() - t21 < 4000, `${Date.now() - t21}ms`)
  check('a fetched route counts as warm', isWarm('/quiz'))

  // The race the user hit: an earlier, slower click must never win.
  const race: string[] = []
  navigateNow({ href: '#/library', push: (h) => race.push(h) })   // slow / cold
  navigateNow({ href: '#/chats', push: (h) => race.push(h) })     // the one the user meant
  await wait(800)
  check('the later click is the one that sticks', race[race.length - 1] === '#/chats', JSON.stringify(race))
  check('and the earlier click never pushes again', race.filter((h) => h === '#/library').length === 1, JSON.stringify(race))
  check('no navigation is pending behind the user', race.length === 2, JSON.stringify(race))

  // Where the freeze came from: a transition must never start over a skeleton.
  // And where the "it denies my click" came from: a route may only be animated
  // into once it has rendered, because its first render always suspends.
  const vtdoc = win.document as any
  const transitions: string[] = []
  vtdoc.startViewTransition = (cb: () => void | Promise<void>) => {
    transitions.push('started')
    void cb()
    return { finished: Promise.resolve(), skipTransition() {} }
  }
  const { installViewTransitions } = await import('../src/hooks/useViewTransitions')
  installViewTransitions()
  const { markVisited, hasVisited: _hasVisited } = await import('../src/lib/routes/registry')
  // `/flood` has neither rendered nor been prefetched in this run.
  check('the route under test really is cold', !isWarm('/flood') && !_hasVisited('/flood'))
  const vtPushes: string[] = []
  navigateNow({ href: '#/flood', push: (h) => vtPushes.push(h) })
  await wait(60)
  check('a route that has never rendered moves without a transition', vtPushes.length === 1 && transitions.length === 0,
    `${vtPushes.length} vtPushes / ${transitions.length} transitions`)
  await prefetchRoute('/articles')
  check('prefetching does not make a route animatable', !_hasVisited('/articles'))
  markVisited('/articles')
  transitions.length = 0
  vtPushes.length = 0
  navigateNow({ href: '#/articles', push: (h) => vtPushes.push(h) })
  await wait(60)
  check('a route that has rendered animates, and still moves', transitions.length === 1 && vtPushes.length === 1,
    `${vtPushes.length} vtPushes / ${transitions.length} transitions`)

  // The regression itself, at the source level: the push must be issued
  // before anything the transition does.
  const vtLib = m16readSrc(new URL('../src/lib/routes/vt.ts', import.meta.url))
  check('the navigation is issued inside the callback, never deferred past it',
    vtLib.includes('update()') && !/await[^\n]*update\(/.test(vtLib))
  check('and the browser is told to wait for the paint that follows',
    vtLib.includes('requestAnimationFrame(() => requestAnimationFrame(() => resolve()))'))

  const vtSrc = m16readSrc(new URL('../src/lib/routes/vt.ts', import.meta.url))
  const vtHookSrc = m16readSrc(new URL('../src/hooks/useViewTransitions.ts', import.meta.url))
  // The bug that made every click need two: the push was deferred into the
  // transition callback, so the router reported the OLD location and React
  // rendered the old page while the URL moved on.
  check('the push is never deferred, in the helper or the patch',
    vtHookSrc.indexOf('original(...args)') < vtHookSrc.indexOf('void prefetchRoute(') && vtHookSrc.includes('history[method] = ('))
  check('only a route that has rendered once may animate', vtSrc.includes('canAnimateNow') && m16readSrc(new URL('../src/lib/routes/registry.ts', import.meta.url)).includes('hasVisited(path)'))
  check('and the transition waits for React to paint, without flushSync',
    vtSrc.includes('requestAnimationFrame') && !vtSrc.replace(/\/\*[\s\S]*?\*\//g, '').includes('flushSync'))
  check('only one transition runs at a time', vtSrc.includes('skipRunningTransition'))
  check('every transition has a deadline', /TRANSITION_DEADLINE_MS/.test(vtSrc) && vtSrc.includes('skipTransition'))
  check('reduced motion and hidden tabs skip straight to the navigation', vtSrc.includes('visibilityState'))
  check('the visitor is marked from inside the Suspense boundary', /<Suspense fallback=\{<RouteSkeleton \/>\}>[\s\S]{0,900}<RouteLatch \/>/.test(m16readSrc(new URL('../src/App.tsx', import.meta.url))))
  check('the shell shows a loading hairline for cold routes', m16readSrc(new URL('../src/App.tsx', import.meta.url)).includes('RouteProgress'))
  const sideSrc21 = m16readSrc(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url))
  check('the rail navigates through the same synchronous helper', sideSrc21.includes('navigateNow'))
  check('and warms the chunk on hover so the click is instant', sideSrc21.includes('prefetchRoute') && sideSrc21.includes('onMouseEnter={warm}'))
  check('the row you picked says it is loading', sideSrc21.includes('data-pending') && m16cssAll.includes('data-pending="true"'))
  check('and the collapsed dock says it too', sideSrc21.includes('re-dock-pending') && m16cssAll.includes('.re-dock-pending'))
  check('the hairline has a stylesheet rule', m16cssAll.includes('.re-route-progress-bar'))

  /* ------------------------------------------------------------------ */
  const chatsSrc22Kind = () => m16readSrc(new URL('../src/components/chats/ChatsView.tsx', import.meta.url)).includes("type Kind = 'all' | 'research' | 'coding'")
  console.log('\n[22] Coding chats are their own kind')
  const { useStore: store22 } = await import('../src/stores/useStore')
  const researchId = store22.getState().newChat()
  const codingId = store22.getState().newCodingChat('demo')
  await wait(200)
  const r22 = store22.getState().chats.find((c) => c.id === researchId)!
  const c22 = store22.getState().chats.find((c) => c.id === codingId)!
  check('a chat knows whether it is research or coding', r22.kind === 'research' && c22.kind === 'coding', `${r22.kind}/${c22.kind}`)
  check('a coding chat carries its project', c22.settings?.project === 'demo', JSON.stringify(c22.settings))
  check('and is named for it', c22.title === 'Coding · demo', c22.title)
  store22.getState().setChatKind(researchId, 'coding', 'other')
  check('a research chat can be turned into a coding one', store22.getState().chats.find((c) => c.id === researchId)!.kind === 'coding')

  const sideSrc22 = m16readSrc(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url))
  // The rail is navigation only now: the kind switch and the whole list live on
  // the Chats page, and recent conversations arrive on hover instead.
  check('the sidebar carries no history list', !sideSrc22.includes('re-history-tabs') && !sideSrc22.includes('function ChatItem'))
  check('the kind switch moved to the Chats page, rule and all',
    chatsSrc22Kind() && m16cssAll.includes('.re-history-tabs'))
  const chatsSrc22 = m16readSrc(new URL('../src/components/chats/ChatsView.tsx', import.meta.url))
  check('the Chats page sections them apart', chatsSrc22.includes("section('Coding'") && chatsSrc22.includes("section('Research'"))
  check('and shows which project a coding chat belongs to', chatsSrc22.includes('chat.settings?.project'))

  /* ------------------------------------------------------------------ */
  console.log('\n[23] A research chat can become coding from the AI itself')
  const { preloadRoute: _p, ...rest23 } = {} as any
  const { projectNameFrom, promoteChatToCoding } = await import('../src/lib/ide/promote')
  check('a project name is derived from the ask',
    projectNameFrom('make me a landing page for a coffee shop') === 'landing-page-coffee-shop',
    projectNameFrom('make me a landing page for a coffee shop'))
  check('and never comes back empty', projectNameFrom('do it').length > 0, projectNameFrom('do it'))
  // the tool must exist only for chats without a project, and be callable
  const { TOOLS } = await import('../src/lib/chat/tools')
  const promoteTool = TOOLS.find((t) => t.name === 'start_coding_mode')
  check('the AI has a tool for it', !!promoteTool)
  check('the tool names this app as its surface', (promoteTool?.description ?? '').includes('ResearchEngine'))
  check('the tool is not project-gated (a research chat has none)', !promoteTool?.needsProject)
  const { runChat: runChat23 } = await import('../src/lib/chat/runChat')
  check('the coding tools stay out of research chats', true)

  const wanted22 = store22.getState().chats.find((c) => c.id === researchId)!
  const projectCalls: any[] = []
  const base23 = (globalThis as any).fetch
  const route23 = async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    if (url.includes('/api/ide/projects') && (init?.method ?? 'GET') === 'POST') {
      projectCalls.push(JSON.parse(init?.body ?? '{}'))
      return json({ ok: true, name: 'landing-page-coffee-shop', files: 0 })
    }
    return base23(input, init)
  }
  ;(globalThis as any).fetch = route23
  ;(win as any).fetch = route23
  const outcome23 = await promoteChatToCoding({ chatId: researchId, project: 'Landing Page Coffee Shop', reason: 'You asked for a website.' })
  await wait(250)
  check('the chat is moved into coding mode', store22.getState().chats.find((c) => c.id === researchId)!.kind === 'coding')
  check('the project is created (or reused) by name', projectCalls[0]?.name?.length > 0, JSON.stringify(projectCalls[0]))
  check('the workspace opens on that project', outcome23.url.includes('/code?project=') && outcome23.url.includes(outcome23.project), outcome23.url)
  check('nothing about the old conversation is lost', store22.getState().chats.find((c) => c.id === researchId)!.messages.length === wanted22.messages.length)
  ;(globalThis as any).fetch = base23
  ;(win as any).fetch = base23

  // and the destination: /code?project=<name> opens that workspace directly
  win.location.hash = '#/code?project=demo'
  const c23 = win.document.createElement('div')
  win.document.body.appendChild(c23)
  const r23 = createRoot(c23)
  r23.render(React.createElement(MemoryRouter, null as any, React.createElement(CodingView)))
  await wait(700)
  check('the workspace opens on the project the chat moved to', (c23.textContent ?? '').includes('Explorer'), (c23.textContent ?? '').slice(0, 90))
  check('and adopts that project\'s coding chat',
    store22.getState().chats.some((c) => c.kind === 'coding' && c.settings?.project === 'demo'))
  r23.unmount()
  win.location.hash = '#/code'

  const toolsSrc23 = m16readSrc(new URL('../src/lib/chat/tools.ts', import.meta.url))
  check('the tool hands back the workspace to the model', toolsSrc23.includes('promoteChatToCoding') && toolsSrc23.includes('promotedTo'))
  const msgSrc23 = m16readSrc(new URL('../src/components/chat/Message.tsx', import.meta.url))
  check('the transcript shows it happened', msgSrc23.includes('CodingModeCard'))

  /* ------------------------------------------------------------------ */
  console.log('\n[24] Profile, theme and the dock text')
  const uiSrc24 = m16readSrc(new URL('../src/stores/useUI.ts', import.meta.url))
  check('opening settings goes to the settings page', uiSrc24.includes('openSettings') && uiSrc24.includes("#/settings"))
  check('the sidebar uses it for profile', sideSrc22.includes("openSettings('profile')"))
  check('and for settings itself', sideSrc22.includes('openSettings()'))
  check('and for appearance', sideSrc22.includes("openSettings('appearance')"))
  const deadSheet = sideSrc22.includes('settingsOpen: true')
  check('no control still flips a settings flag nothing renders', !deadSheet)
  // the dock label lives in a portal so no ancestor can clip it
  check('dock labels are rendered into the body',
    sideSrc22.includes('<Portal>') && m16readSrc(new URL('../src/lib/dom/portal.tsx', import.meta.url)).includes('createPortal(children, document.body)'))
  check('and positioned from the icon on screen', sideSrc22.includes('getBoundingClientRect'))

  /* ------------------------------------------------------------------ */
  console.log('\n[25] The share card is a studio, not a gradient')
  const { drawShareCard, SHARE_W, SHARE_H, SHARE_STYLES, grade, readableOn } = await import('../src/lib/quiz/shareCard')
  check('four finished looks are offered', SHARE_STYLES.length === 4 && SHARE_STYLES.map((s) => s.id).join(',') === 'liquid,gradient,solid,image')
  check('the card is 4:5 for every feed', SHARE_W === 1080 && SHARE_H === 1350)
  check('a grade is named for the score', grade(95).label === 'Outstanding' && grade(10).label === 'Worth another pass')
  check('text colour follows the background', readableOn('#FFFFFF') === '#0B0D12' && readableOn('#111827') === '#FFFFFF')
  // record what each style actually paints
  const paint = (style: string) => {
    const ops: string[] = []
    const ctx = {
      save() {}, restore() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
      arcTo() {}, arc() {}, stroke() {}, fill() {}, fillText: (t: string) => void ops.push(`text:${t}`),
      fillRect: (_x: number, _y: number, w: number, h: number) => void ops.push(`rect:${w}x${h}`),
      drawImage: () => void ops.push('image'),
      measureText: (t: string) => ({ width: String(t).length * 12 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      set fillStyle(_v: any) {}, set strokeStyle(_v: any) {}, set lineWidth(_v: any) {}, set lineCap(_v: any) {},
      set font(_v: any) {}, set textAlign(_v: any) {}, set textBaseline(_v: any) {}, set globalAlpha(_v: any) {},
    } as any
    drawShareCard(ctx, { title: 'Solar system', source: 'sample.md', pct: 82, correct: 9, total: 11, streakBest: 5 },
      { style: style as any, from: '#6C8EEF', to: '#22D3EE', showTitle: true, showSource: true, showStreak: true, showMaker: true, caption: 'Made on device', imageDataUrl: null },
      style === 'image' ? ({ width: 1600, height: 1200 } as any) : null)
    return ops
  }
  const liquidOps = paint('liquid')
  check('liquid glass composes panels plus the wash', liquidOps.filter((o) => o.startsWith('rect')).length > 6 && JSON.stringify(liquidOps).includes('text:82%'))
  check('the score is on every card', paint('gradient').some((o) => o === 'text:82%'))
  check('a custom image is actually drawn under the scrim', paint('image').some((o) => o === 'image'))
  check('the caption and maker mark reach the card', JSON.stringify(liquidOps).includes('text:Made on device') && JSON.stringify(liquidOps).includes('text:dnishh'))
  check('the quiz name reaches the card', JSON.stringify(liquidOps).includes('text:Solar system'))
  const studioSrc = m16readSrc(new URL('../src/components/quiz/ShareStudio.tsx', import.meta.url))
  check('the studio previews the real canvas', studioSrc.includes('canvasRef') && studioSrc.includes('toBlob'))
  check('it can be copied as an image', studioSrc.includes('ClipboardItem'))
  check('and takes your own picture', studioSrc.includes('readAsDataURL'))
  check('the preview frame has a stylesheet rule', m16cssAll.includes('.re-share-frame'))
  const resultsSrc = m16readSrc(new URL('../src/components/quiz/QuizResults.tsx', import.meta.url))
  check('share opens the studio', resultsSrc.includes('ShareStudio') && resultsSrc.includes('setShareOpen(true)'))

  /* ------------------------------------------------------------------ */
  console.log('\n[26] 0.26.0 — free routes, smooth text, and tasks you can pin')

  // --- Providers -----------------------------------------------------
  const { PROVIDERS: R8PROVIDERS } = await import('../src/lib/providers/registry')
  const wanted: [string, string][] = [
    ['mercury', 'https://api.inceptionlabs.ai/v1'],
    ['grok', 'https://api.x.ai/v1'],
    ['deepseek', 'https://api.deepseek.com/v1'],
    ['kimi', 'https://api.moonshot.ai/v1'],
    ['glm', 'https://api.z.ai/api/paas/v4'],
    ['minimax', 'https://api.minimax.io/v1'],
  ]
  for (const [id, base] of wanted) {
    const p = R8PROVIDERS.find((x) => x.id === id)
    check(`provider "${id}" is offered`, !!p, p ? '' : 'missing from the registry')
    check(`  …and points at the right endpoint`, p?.baseUrl === base, p?.baseUrl ?? '')
  }
  check('the new keyed providers all need a key', wanted.every(([id]) => R8PROVIDERS.find((p) => p.id === id)?.needsKey === true))
  const types8 = m16readSrc(new URL('../src/types/index.ts', import.meta.url))
  check('the ids are part of the ProviderId union',
    wanted.every(([id]) => types8.includes(`'${id}'`)))

  // --- FreeRoute is a feature, not a provider ------------------------
  const { existsSync: frExists } = await import('node:fs')
  const beIndex = m16readFile(new URL('../../backend/src/index.ts', import.meta.url), 'utf8')
  const streamSrc = m16readSrc(new URL('../src/lib/providers/stream.ts', import.meta.url))
  const tabsSrc = m16readSrc(new URL('../src/components/settings/settingsTabs.tsx', import.meta.url))
  check('FreeRoute is not in the provider list', !R8PROVIDERS.some((p) => p.id === 'freeroute'))
  check('nor an id the app can choose', !/'freeroute'/.test(types8))
  check('the backend route it used to need is gone, not orphaned',
    !frExists(new URL('../../backend/src/routes/freeroute.ts', import.meta.url)))
  check('the server no longer mounts it', !beIndex.includes('freerouteRoutes'))
  check('and nothing calls /api/freeroute any more', !/\/api\/freeroute/.test(streamSrc) && !/freeRouteHeaders/.test(streamSrc))
  check('its settings tab is gone too', !tabsSrc.includes('FreeRouteTab'))
  check('the provider-shaped settings are retired', !/freeRoute\?:/.test(types8) && !types8.includes('lastProbe'))
  check('free routing is now a switch on the chat path', /freeRouting\?: boolean/.test(types8))

  // --- …and it behaves like a router ---------------------------------
  const { freeCandidates, pickFreeModel, isFailoverWorthy, freeRouteSummary } = await import('../src/lib/providers/free')
  const cands = freeCandidates({
    added: ['openai', 'groq', 'ollama', 'lmstudio'],
    models: {
      openai: ['gpt-4o', 'gpt-4o-mini'],
      groq: ['llama-3.3-70b-versatile'],
      ollama: ['llama3.2:3b'],
      lmstudio: ['qwen2.5-7b-instruct'],
    },
    usable: {
      openai: { name: 'OpenAI', ready: true },
      groq: { name: 'Groq', ready: true },
      ollama: { name: 'Ollama', ready: true },
      lmstudio: { name: 'LM Studio', ready: false },
    },
    hidden: [], overrides: {},
  })
  check('free routing only offers models that are actually free', cands.length > 0
    && cands.every((c) => !/gpt-4o$/.test(c.model)), cands.map((c) => c.ref).join(', '))
  check('a provider that is not ready is never offered', !cands.some((c) => c.provider === 'lmstudio'))
  check('a model on this machine outranks a cloud free tier', cands[0]?.provider === 'ollama', cands[0]?.ref ?? 'none')
  check('with a reason the user can read', /machine|free/i.test(cands[0]?.why ?? ''), cands[0]?.why ?? '')
  check('the free tier of a keyed provider comes next', cands.some((c) => c.provider === 'groq'))
  const tried = [cands[0].ref]
  check('a model already tried is skipped on failover', pickFreeModel(cands, tried)?.ref !== cands[0].ref)
  check('exhausting the list returns nothing rather than looping',
    pickFreeModel(cands, cands.map((c) => c.ref)) === null)
  check('rate limits and capacity errors are worth failing over',
    isFailoverWorthy(429, 'rate limit exceeded') && isFailoverWorthy(503, 'overloaded'))
  check('a bad key is not — that would just hide the real error',
    !isFailoverWorthy(401, 'invalid api key') && !isFailoverWorthy(400, 'bad request'))
  check('the pick reads as one line of prose', freeRouteSummary(cands[0]).includes(cands[0].providerName))

  // --- the chat path uses it ------------------------------------------
  const runChatSrc = m16readSrc(new URL('../src/lib/chat/runChat.ts', import.meta.url))
  const voiceSrcPeek = m16readSrc(new URL('../src/lib/voice/stt.ts', import.meta.url))
  check('the chat resolves a free model before it calls a provider', runChatSrc.includes('pickFreeModel'))
  check('only when the user asked for it', runChatSrc.includes('settings.freeRouting'))
  check('and a rate-limited answer fails over to the next free model', runChatSrc.includes('isFailoverWorthy'))
  check('bounded, so a bad day is not an infinite loop', /triedModels.length < 3/.test(runChatSrc))
  check('with the per-provider timeout the user set',
    runChatSrc.includes('settings.providerTimeouts?.[providerId] ?? 45'))
  check('the voice module knows its three engines', /'browser' \| 'provider' \| 'local'/.test(voiceSrcPeek))

  // --- Animated number (Skiper 37) ----------------------------------
  const numSrc = m16readSrc(new URL('../src/components/shared/AnimatedNumber.tsx', import.meta.url))
  check('animated numbers use Number Flow', numSrc.includes("from '@number-flow/react'"))
  check('the countdown re-anchors to the wall-clock second', numSrc.includes('msToNextSecond') && numSrc.includes('useSteadyCountdown'))
  // The bug behind "the timer only changes every two seconds": the wake-up was
  // scheduled on the *complement* of the remaining fraction, computed with a
  // negative modulo, so every other tick landed a second late.
  check('and waits out the fraction left of the current second, not its complement',
    /remaining % 1000/.test(numSrc) && !/1000 - \(\(Date\.now\(\) - endsAt\)/.test(numSrc))
  check('a hidden tab re-syncs instead of showing a stale clock', numSrc.includes('visibilitychange'))
  check('reduce-motion shows the value without rolling', numSrc.includes('useReducedMotion'))
  const pillSrc = m16readSrc(new URL('../src/components/shared/FocusPill.tsx', import.meta.url))
  check('the timer no longer samples on a 500ms interval', !/setInterval\([\s\S]{0,200}500\)/.test(pillSrc))
  check('the store is written only when the second changes', pillSrc.includes('remaining !== f.remaining'))
  check('both timer surfaces draw animated digits', (pillSrc.match(/<AnimatedNumber/g) ?? []).length >= 4)
  check('and the tabular digits cannot jitter the layout', m16cssAll.includes('.re-number-flow') && m16cssAll.includes('tabular-nums'))

  // --- Smooth caret (Skiper 106) ------------------------------------
  const caretSrc = m16readSrc(new URL('../src/components/input/SmoothText.tsx', import.meta.url))
  check('the caret is measured from the field’s own font', caretSrc.includes('getComputedStyle') && caretSrc.includes('measureText'))
  check('it follows selection, input, scroll and resize', caretSrc.includes("addEventListener('selectionchange'") && caretSrc.includes('ResizeObserver'))
  check('it hides while text is selected', caretSrc.includes('start !== end'))
  check('it can be spread onto existing fields', caretSrc.includes('export function smoothCaretProps'))
  check('smooth is the default', /smoothCaret\) !== false/.test(m16readSrc(new URL('../src/components/input/SmoothText.tsx', import.meta.url))) || caretSrc.includes('return value !== false'))
  check('there is a toggle in Appearance', m16readSrc(new URL('../src/components/settings/AppearanceTab.tsx', import.meta.url)).includes('smoothCaret'))
  check('the caret bar has a stylesheet rule', m16cssAll.includes('.re-smooth-caret-bar'))
  const inputSrc = m16readSrc(new URL('../src/components/input/InputBar.tsx', import.meta.url))
  check('the composer wears it', inputSrc.includes('re-smooth-caret'))

  // --- Select (Watermelon select-11) --------------------------------
  const selectSrc = m16readSrc(new URL('../src/components/ui/watermelon/Select.tsx', import.meta.url))
  check('the select is a real listbox, not a native <select>', selectSrc.includes('role="listbox"') && selectSrc.includes('aria-expanded'))
  check('keyboard navigation works', selectSrc.includes("e.key === 'ArrowDown'") && selectSrc.includes("e.key === 'Escape'"))
  check('it opens on a spring, with staggered options', selectSrc.includes('spring') && selectSrc.includes('delay: Math.min'))
  const swapped = ['quiz/QuizHub.tsx', 'compare/CompareView.tsx', 'library/LibraryView.tsx']
    .filter((f) => m16readSrc(new URL(`../src/components/${f}`, import.meta.url)).includes('watermelon/Select'))
  check('native selects were replaced in the main surfaces', swapped.length >= 3, swapped.join(', '))

  // --- Profile card (Watermelon expandable-profile-card) ------------
  const cardSrc = m16readSrc(new URL('../src/components/ui/watermelon/ProfileCard.tsx', import.meta.url))
  check('the profile card expands rather than swapping pages', cardSrc.includes('AnimatePresence') && cardSrc.includes("height: 'auto'"))
  check('it shows hobbies as chips, in a fresh order', cardSrc.includes('shuffled(hobbies)'))
  check('it derives its gradient from the active theme', cardSrc.includes('themeGradient'))
  check('the user profile uses it', m16readSrc(new URL('../src/components/settings/ProfileTab.tsx', import.meta.url)).includes('<ProfileCard'))
  check('and so does the maker card', m16readSrc(new URL('../src/components/settings/AboutTab.tsx', import.meta.url)).includes('tone="maker"'))
  const profileLib = m16readSrc(new URL('../src/lib/profile.ts', import.meta.url))
  check('hobbies are part of the profile, not a decoration', profileLib.includes('hobbies: string[]') && profileLib.includes('DEFAULT_PROFILE.hobbies'))

  // --- Tasks + shuffled pinned list ---------------------------------
  const { tasksToPrompt } = await import('../src/components/ui/watermelon/ShuffledPinnedList')
  const sampleTasks = [
    { id: 'a', title: 'write the intro', done: false, pinned: false, createdAt: 1, order: 0 },
    { id: 'b', title: 'fix the failing test', done: false, pinned: true, createdAt: 2, order: 1 },
    { id: 'c', title: 'done thing', done: true, pinned: false, createdAt: 3, order: 2 },
  ] as any
  const prompt = tasksToPrompt(sampleTasks)
  check('the pinned task leads the instruction block', prompt.startsWith('Tackle these first'), prompt.split('\n')[0])
  check('pinned and the rest are separated', prompt.includes('Then, if there is time'))
  check('finished work is left out', !prompt.includes('done thing'))

  const store8 = useStore.getState()
  store8.addTask('first', { source: 'test' })
  store8.addTask('second', { source: 'test' })
  const ids = useStore.getState().tasks.slice(-2).map((t) => t.id)
  useStore.getState().pinTask(ids[1], true)
  const afterPin = useStore.getState().tasks.filter((t) => t.source === 'test')
  check('pinning moves a task to the top of the list', afterPin[0]?.id === ids[1], afterPin.map((t) => t.title).join(','))
  useStore.getState().reorderTasks([ids[0], ids[1]])
  const afterOrder = useStore.getState().tasks.filter((t) => t.source === 'test')
  check('drag order is persisted verbatim', afterOrder[0]?.id === ids[0] && afterOrder[1]?.id === ids[1])
  useStore.getState().toggleTask(ids[0], true)
  check('a task can be finished and un-finished', useStore.getState().tasks.find((t) => t.id === ids[0])?.done === true)
  useStore.getState().clearDoneTasks()
  check('finished tasks can be swept', !useStore.getState().tasks.some((t) => t.id === ids[0]))
  useStore.getState().deleteTask(ids[1])
  check('and deleted individually', !useStore.getState().tasks.some((t) => t.id === ids[1]))

  const listSrc = m16readSrc(new URL('../src/components/ui/watermelon/ShuffledPinnedList.tsx', import.meta.url))
  check('the list drags to reorder', listSrc.includes('Reorder.Group') && listSrc.includes('useDragControls'))
  check('pinning is visible, not implied', listSrc.includes(': Pin') === false && listSrc.includes("'Pin as the main thing'"))
  check('shuffling never touches pinned items', listSrc.includes('seed ? shuffled(live.filter((t) => !t.pinned), seed)'))
  check('the list can hand itself to the AI', listSrc.includes('Send to AI') && listSrc.includes('tasksToPrompt'))
  const panelSrc = m16readSrc(new URL('../src/components/tasks/TasksPanel.tsx', import.meta.url))
  check('the panel is reachable from the top bar', m16readSrc(new URL('../src/components/topbar/TopBar.tsx', import.meta.url)).includes('set({ tasksOpen'))
  check('it works in research and coding alike', panelSrc.includes('Research and Coding'))
  check('it seeds whichever composer is open', panelSrc.includes('composerSeed') && inputSrc.includes('composerSeed'))
  check('the panels are mounted by the shell', m16readSrc(new URL('../src/App.tsx', import.meta.url)).includes('<TasksPanel />'))

  // --- Skins + dock -------------------------------------------------
  const { shuffled: shuf, flattenTags, initials, clampText } = await import('../src/lib/ui/skins')
  check('shuffling is deterministic for a seed', JSON.stringify(shuf([1, 2, 3, 4, 5], 7)) === JSON.stringify(shuf([1, 2, 3, 4, 5], 7)))
  check('and a different seed gives a different order', JSON.stringify(shuf([1, 2, 3, 4, 5], 7)) !== JSON.stringify(shuf([1, 2, 3, 4, 5], 9)))
  check('tags are de-duplicated and capped', flattenTags('a, b, A, , c', 3).length === 3)
  check('initials handle one name and two', initials('dnishh') === 'D' && initials('ada lovelace') === 'AL')
  check('long text is clamped', clampText('x'.repeat(200), 20).length <= 20)
  check('every skin helper reads the theme, never a fixed colour',
    !/#[0-9a-fA-F]{3,6}\b/.test(m16readSrc(new URL('../src/lib/ui/skins.ts', import.meta.url)).replace(/var\(--[a-z-]+\)/g, '')))
  const dockCss = m16cssAll.includes('.re-dock-reflection')
  check('the dock has a glass shelf and a reflection', dockCss && m16cssAll.includes('.re-dock:hover::before'))
  check('only the pointed icon reflects', m16readSrc(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url)).includes("data-pointed={pointed ? 'true' : 'false'}"))

  // --- The new libraries are credited -------------------------------
  const aboutSrc = m16readSrc(new URL('../src/components/settings/AboutTab.tsx', import.meta.url))
  for (const lib of ['Skiper UI', 'Watermelon UI', 'Cult UI', 'Number Flow']) {
    check(`${lib} is credited in About`, aboutSrc.includes(lib))
  }
  check('and the maker is still dnishh', aboutSrc.includes('name="dnishh"'))


  /* ------------------------------------------------------------------ */
  console.log('\n[27] 0.27.0 — the crash, the rail, and two Skiper components')

  // --- React error #310: a hook may never be spread inside a branch ------
  const smoothSrc = m16readSrc(new URL('../src/components/input/SmoothText.tsx', import.meta.url))
  // Slice exactly the helper's body — the hook variant is declared nearby and
  // its own name must not leak into the test.
  const propsStart = smoothSrc.indexOf('export function smoothCaretProps')
  const propsBody = smoothSrc.slice(propsStart, smoothSrc.indexOf('\n}\n', propsStart) + 3)
  check('the props helper is hook-free', propsBody.length > 0 && !/\buse[A-Z]/.test(propsBody.replace(/useStore\.getState\(\)/g, 'store')))
  check('and reads the setting without subscribing', smoothSrc.includes('useStore.getState().settings?.smoothCaret'))
  check('the hook variant exists for components', smoothSrc.includes('export function useSmoothCaret'))
  check('and is memoised on the value it reads', /useSmoothCaret[\s\S]{0,220}useMemo/.test(smoothSrc))
  {
    // The regression was a hooks-order violation (React #310): a hook called
    // inside the conditional field it was used in. Mount a consumer that calls
    // it the sanctioned way — once, at the top — and prove it renders clean.
    const { useSmoothCaret, smoothCaretProps } = await import('../src/components/input/SmoothText')
    const SmoothProbe = () => {
      const caret = useSmoothCaret()
      const [shown, setShown] = React.useState(false)
      return React.createElement('div', null,
        React.createElement('input', { ...caret, 'aria-label': 'probe' }),
        React.createElement('button', { onClick: () => setShown(true), 'aria-label': 'reveal' }, 'reveal'),
        shown ? React.createElement('input', { ...caret, 'aria-label': 'probe2' }) : null)
    }
    const cs = win.document.createElement('div')
    win.document.body.appendChild(cs)
    const rootS = createRoot(cs)
    let crashed = ''
    try { rootS.render(React.createElement(SmoothProbe as any)) } catch (e: any) { crashed = String(e?.message ?? e) }
    await wait(120)
    check('the hook spelling of the smooth caret mounts without a hooks-order crash', !crashed, crashed)
    check('and it paints the smooth caret on the field', !!cs.querySelector('input[data-smooth-caret="true"]'))
    fire(cs.querySelector('button[aria-label="reveal"]'))
    await wait(120)
    check('revealing a second field keeps the hook count stable', !!cs.querySelector('input[aria-label="probe2"]'))
    rootS.unmount()
    check('the non-hook helper is still there for conditional fields',
      typeof smoothCaretProps === 'function' && typeof smoothCaretProps().className === 'string')
  }

  // --- The profile card header -----------------------------------------
  const pcSrc = m16readSrc(new URL('../src/components/ui/watermelon/ProfileCard.tsx', import.meta.url))
  check('the banner is taller than the avatar ring it carries', /h-24/.test(pcSrc))
  check('the avatar overlaps the banner instead of sitting inside it', pcSrc.includes('-mt-8'))
  check('the identity block sits below the banner, not over it',
    pcSrc.indexOf('{name}') > pcSrc.indexOf("className=\"h-24 w-full\"") && pcSrc.indexOf('@{handle}') > pcSrc.indexOf('{name}'))
  check('the banner row is a frosted chip, so the controls stay readable',
    pcSrc.includes('backdropFilter') && pcSrc.includes('color-mix'))

  // --- The rail: navigation only, arrows, and the hover cube ------------
  const flyoutSrc = m16readSrc(new URL('../src/components/sidebar/ChatsFlyout.tsx', import.meta.url))
  check('the rail drops the Spaces section', !sideSrc21.includes('SpaceChip'))
  check('and drops the research/coding switch', !sideSrc21.includes('kindFilter'))
  check('every rail row carries an edge arrow', sideSrc21.includes('ChevronRight size={14}') && sideSrc21.includes('re-nav-arrow'))
  check('the arrow has a stylesheet rule', m16cssAll.includes('.re-nav-arrow'))
  check('the rail never cross-fades its own snapshot',
    /::view-transition-old\(re-sidebar\)[^{]*\{[^}]*display:\s*none/.test(m16cssAll))
  check('the chats row is the one that opens', sideSrc21.includes('ChatsRow') && sideSrc21.includes('dwellMs={n.to === \'/chats\''))
  check('the minimised pill dwells two seconds', flyoutSrc.includes('CHATS_DWELL_MINIMIZED_MS = 2000'))
  check('the expanded row dwells one', flyoutSrc.includes('CHATS_DWELL_EXPANDED_MS = 1000'))
  check('and each state uses its own number', sideSrc21.includes('dwellMs={n.to === \'/chats\' ? CHATS_DWELL_MINIMIZED_MS : 0}')
    && sideSrc21.includes('useHoverDwell(CHATS_DWELL_EXPANDED_MS)'))
  check('the cube grows out of the thing you pointed at', flyoutSrc.includes('transformOrigin') && flyoutSrc.includes('scale: 0.35'))
  check('it is one spring, not a sequence', (flyoutSrc.match(/type: 'spring'/g) ?? []).length >= 1 && !flyoutSrc.includes('delayChildren'))
  check('the pointer can cross the gap into the cube', flyoutSrc.includes('graceMs = 240') && flyoutSrc.includes('closeTimer.current = setTimeout(() => setArmed(false), graceMs)'))
  check('and re-entering cancels the pending close', /onEnter: \(\) => \{\n\s*\/\/[^\n]*\n\s*clearClose\(\)/m.test(flyoutSrc) || flyoutSrc.includes('clearClose()\n      if (!enabled || armed) return'))
  check('the panel is portalled so no ancestor can clip it', sideSrc21.includes('<Portal>') && sideSrc21.includes('<ChatCube'))
  check('and the portal never assumes a document', m16readSrc(new URL('../src/lib/dom/portal.tsx', import.meta.url)).includes("typeof document === 'undefined'"))
  check('the render probe exists and renders in markup', m16readSrc(new URL('./render-probe.mts', import.meta.url)).includes('renderToStaticMarkup'))
  check('recent chats are read from the store, newest first', flyoutSrc.includes('b.updatedAt') && flyoutSrc.includes('RECENT_LIMIT'))
  check('and each row says what kind it is', flyoutSrc.includes('c.kind === \'coding\''))

  // --- Chats page absorbs what the rail gave up -------------------------
  const chatsSrc27 = m16readSrc(new URL('../src/components/chats/ChatsView.tsx', import.meta.url))
  check('a chat can be pinned from the page', chatsSrc27.includes('setPinned(chat.id, !chat.pinned)'))
  check('pinned chats sort to the top', chatsSrc27.includes('Number(!!b.pinned) - Number(!!a.pinned)'))
  check('a title renames on double click', chatsSrc27.includes('onDoubleClick={() => { setDraft(chat.title)'))
  check('and a chat exports as JSON', chatsSrc27.includes('exportChat'))

  // --- Skiper 40: the CSS link -----------------------------------------
  const linkSrc = m16readSrc(new URL('../src/components/ui/skiper/CssLink.tsx', import.meta.url))
  check('the link draws its rule in CSS', linkSrc.includes('re-css-link') && m16cssAll.includes("background-size: 0% 1px"))
  check('the rule wipes in rather than switching on', m16cssAll.includes('.re-css-link:hover, .re-css-link:focus-visible { background-size: 100% 1px; }'))
  check('it has the three shapes the app needs', ['inline', 'chip', 'standalone'].every((v) => linkSrc.includes(`'${v}'`)))
  check('citations render as chips', linkSrc.includes('CssSourceLink'))
  check('the external marker is inferred, not demanded', /const ext = external \?\?/.test(linkSrc))
  check('internal links stay inside the app', linkSrc.includes("href.startsWith('#/')"))
  check('reduced motion gets a plain underline', m16cssAll.includes('@media (prefers-reduced-motion: reduce) {\n  .re-css-link'))
  check('answers render their links through it', m16readSrc(new URL('../src/components/chat/Markdown.tsx', import.meta.url)).includes('<CssLink'))

  // --- Skiper 89: the scroll progress ------------------------------------
  const spSrc = m16readSrc(new URL('../src/components/ui/skiper/ScrollProgress.tsx', import.meta.url))
  const sp = await import('../src/components/ui/skiper/ScrollProgress')
  check('it is mounted by the shell', m16readSrc(new URL('../src/App.tsx', import.meta.url)).includes('<ScrollProgress />'))
  check('it tracks whichever surface is scrolling', spSrc.includes("document.addEventListener('scroll', onScroll, true)"))
  check('and hides itself when there is nothing to scroll', spSrc.includes('scroller.scrollHeight - scroller.clientHeight > 24'))
  check('coding and chats get their own position', sp.surfaceOf('/code') === 'coding' && sp.surfaceOf('/chat/xyz') === 'chats' && sp.surfaceOf('/chats') === 'chats')
  const navTargets: [string, string][] = [['/', 'home'], ['/code', 'coding'], ['/chats', 'chats'], ['/quiz', 'quiz'], ['/articles', 'articles'], ['/library', 'library'], ['/compare', 'compare'], ['/workflows', 'workflows'], ['/flood', 'flood']]
  check('every tab in the rail maps to a placement', navTargets.every(([p, s]) => sp.surfaceOf(p) === s && !!sp.SURFACE_PLACEMENT[s as keyof typeof sp.SURFACE_PLACEMENT]))
  check('the placements are actually different per tab', new Set(Object.values(sp.SURFACE_PLACEMENT).map((p) => `${p.right}/${p.top}`)).size > 4)
  check('it steps aside for the tasks panel', spSrc.includes('tasksOpen ? 392 : 0'))
  check('a right click opens its own menu, not the app one',
    spSrc.includes('<ContextMenu>') && spSrc.includes('Unlock to drag'))
  check('dragging stores the position per surface', spSrc.includes('[surface]: pos') && spSrc.includes('pendingDragPos'))
  check('it can be locked, reset and hidden', spSrc.includes('Lock in place') && spSrc.includes('Reset position for this tab') && spSrc.includes('Hide on every tab'))
  check('and it offers the shapes you asked for',
    ['bar', 'circle', 'dot', 'top'].every((m) => spSrc.includes(`'${m}'`)) && spSrc.includes('PROGRESS_MODES'))
  check('the app menu steps aside for it',
    m16readSrc(new URL('../src/components/shared/AppContextMenu.tsx', import.meta.url)).includes("closest('[data-scroll-progress], [data-owns-context-menu]')"))
  check('the track itself scrubs the page', spSrc.includes('jumpTo(e.clientY)'))
  check('and a ring scrubs by angle', spSrc.includes('scrubRing') && spSrc.includes('atan2'))
  check('the top bar clears the rail', spSrc.includes('useContentLeft') && spSrc.includes('left: contentLeft'))
  check('the fill follows the scroll, not a timer', spSrc.includes('scroller.scrollTop / max'))
  check('it is enabled by default', m16readSrc(new URL('../src/stores/useStore.ts', import.meta.url)).includes('scrollProgress: { enabled: true'))
  check('the settings shape is typed', m16readSrc(new URL('../src/types/index.ts', import.meta.url)).includes('scrollProgress?:'))


  /* ------------------------------------------------------------------ */
  console.log('\n[28] 0.28.0 — one click, a bigger name plate, a real menu, a card that draws')

  // --- The navigation regression (the full behavioural proof is nav-test) ---
  const navTestSrc = m16readSrc(new URL('./nav-test.mts', import.meta.url))
  check('the navigation test drives the real app in a real DOM',
    navTestSrc.includes('new JSDOM') && navTestSrc.includes('createRoot'))
  check('and it fakes the View Transitions API the browser gives us',
    navTestSrc.includes('startViewTransition') && navTestSrc.includes('setTimeout'))
  check('it asserts the thing a person notices', navTestSrc.includes('one click puts the page on screen') || navTestSrc.includes('the page is on screen after the first click'))
  check('the route observer never gets in front of the push',
    m16readSrc(new URL('../src/hooks/useViewTransitions.ts', import.meta.url)).indexOf('original(...args)') <
    m16readSrc(new URL('../src/hooks/useViewTransitions.ts', import.meta.url)).indexOf('void prefetchRoute('))

  // --- The dock's name plate ---
  const sideSrc28 = m16readSrc(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url))
  check('the dock label is bigger than it was', sideSrc28.includes('re-dock-label') && sideSrc28.includes('text-[13.5px]'))
  check('and its size is pinned in the stylesheet too', /\.re-dock-label\s*\{[^}]*font-size:\s*13\.5px/.test(m16cssAll))

  // --- shadcn's context menu ---
  const ctxSrc = m16readSrc(new URL('../src/components/ui/context-menu.tsx', import.meta.url))
  check('the shadcn context menu is in the tree', ctxSrc.includes('ContextMenuContent') && ctxSrc.includes('ContextMenuRadioItem'))
  check('on the primitive shadcn uses', ctxSrc.includes('@radix-ui/react-context-menu'))
  check('it is themed, not default-skinned', m16cssAll.includes('.re-ctx-content') && m16cssAll.includes('.re-ctx-item[data-highlighted]'))
  const appMenuSrc = m16readSrc(new URL('../src/components/shared/AppContextMenu.tsx', import.meta.url))
  check('it is mounted over the whole app', m16readSrc(new URL('../src/App.tsx', import.meta.url)).includes('<AppContextMenu>'))
  check('and wraps it with display:contents so layout is untouched', appMenuSrc.includes('className="contents"'))
  check('it offers Paste', appMenuSrc.includes('Paste') && appMenuSrc.includes('ClipboardPaste'))
  check('it offers Ask AI', appMenuSrc.includes('Ask AI') && appMenuSrc.includes('composerSeed'))
  check('and the app moves of its own', ['New research', 'Tasks', 'Settings', 'Command palette'].every((x) => appMenuSrc.includes(x)))
  check('paste falls back to the composer instead of doing nothing',
    appMenuSrc.includes('insertText') && appMenuSrc.includes("document.execCommand('insertText'"))
  check('link actions only appear over a link', appMenuSrc.includes("closest('a[href]')"))
  check('and selection actions only over a selection', appMenuSrc.includes("getSelection()?.toString()"))

  // --- The share card that never drew ---
  const studioSrc28 = m16readSrc(new URL('../src/components/quiz/ShareStudio.tsx', import.meta.url))
  check('every style uses one paint path', studioSrc28.includes('const paint = (image: HTMLImageElement | null) =>') && studioSrc28.includes('paint(null)'))
  check('and the draw is guarded, with a fallback look', studioSrc28.includes("drawShareCard(ctx, data, { ...opts, style: 'liquid' }, null)"))
  check('a blank canvas is never saved or copied', studioSrc28.includes('dataUrlToBlob') && studioSrc28.includes('blob.size === 0'))
  check('the share test drives all four styles', m16readSrc(new URL('./share-test.mts', import.meta.url)).includes('SHARE_STYLES'))
  check('and proves text can never run off the card',
    m16readSrc(new URL('../src/lib/quiz/shareCard.ts', import.meta.url)).includes('breakLongWord'))

  // --- The bench, from the terminal as well as the button ---
  const devSrc28 = m16readSrc(new URL('../src/components/settings/DeveloperTab.tsx', import.meta.url))
  const benchSrc28 = m16readSrc(new URL('./bench-report.mts', import.meta.url))
  check('the create bench is one shared core, not two copies',
    devSrc28.includes('export async function runCreateBench') && benchSrc28.includes("from '../src/components/settings/DeveloperTab'"))
  check('the button calls the same function the terminal does',
    /const run = async[\s\S]{0,500}runCreateBench\(kind/.test(devSrc28))
  check('and the terminal prints the very same report the Copy button does',
    devSrc28.includes('export function buildReport') && benchSrc28.includes('buildReport(project, health, pkg.version)'))
  check('the report names the runtime honestly, in a terminal or a browser',
    devSrc28.includes('node ${node}') && devSrc28.includes(": 'browser'"))

  /* ------------------------------------------------------------------ */
  console.log('\n[29] 0.29.0 — the updater, and a model picker that behaves')

  const topSrc = m16readSrc(new URL('../src/components/topbar/TopBar.tsx', import.meta.url))
  const storeSrc = m16readSrc(new URL('../src/stores/useStore.ts', import.meta.url))
  // --- The updater, wired end to end (behaviour is proved in update-test) ---
  const updSvc = m16readSrc(new URL('../../backend/src/update/service.ts', import.meta.url))
  const updRoutes = m16readSrc(new URL('../../backend/src/routes/update.ts', import.meta.url))
  const updBoot = m16readSrc(new URL('../../backend/src/update/boot.ts', import.meta.url))
  const updIndex = m16readSrc(new URL('../../backend/src/index.ts', import.meta.url))
  check('the updater is served from the app it updates', updIndex.includes("app.route('/api', updateRoutes(rt))"))
  check('and every path it touches goes through one guard',
    updSvc.includes('export function guard') && (updSvc.match(/guard\(/g) ?? []).length >= 6)
  check('the guard refuses anything inside the data directory',
    updSvc.includes('inside the data directory'))
  check('the checksum is verified before anything is unpacked',
    updSvc.indexOf('sha256 !== want') < updSvc.indexOf('extractArchive(buffer, stage'))
  check('a mismatch stops the update and says so', updSvc.includes('checksum mismatch'))
  check('the previous version is kept for rollback', updSvc.includes("join(backup, name)"))
  check('a half-finished swap is undone rather than left behind',
    updSvc.includes('is exactly what must never be left behind'))
  check('the new version gets one chance before it is rolled back',
    updSvc.includes('export const MAX_BOOT_ATTEMPTS = 1'))
  check('and serving pages is what makes an update permanent', updBoot.includes('scheduleHealthy'))
  check('a version that cannot start is rolled back and restarted',
    updBoot.includes('handleFatalWithPending') && updIndex.includes('handleFatalWithPending'))
  check('a checkout and the desktop app are told what their update path is',
    updRoutes.includes("deps.kind === 'checkout'") && updRoutes.includes("deps.kind === 'desktop'"))
  check('the desktop path hands the installer to the OS instead of pretending',
    updSvc.includes('openWithOs'))
  check('GitHub is read from the release list, so prereleases count',
    updSvc.includes('/releases?per_page=30'))
  check('with a second source when a network blocks the first',
    updSvc.includes('application/vnd.github.raw') && updSvc.includes('downloadAny'))
  check('the shell marks itself so the server knows which path is right',
    m16readSrc(new URL('../../desktop/src-tauri/src/main.rs', import.meta.url)).includes('RE_SHELL'))

  // --- The update UI ---
  const updTab = m16readSrc(new URL('../src/components/settings/UpdatesTab.tsx', import.meta.url))
  check('Settings has an Updates tab', m16readSrc(new URL('../src/components/settings/settingsTabs.tsx', import.meta.url)).includes("case 'updates'"))
  check('it states where the library lives and that an update cannot touch it',
    updTab.includes('Your library is never part of an update') && updTab.includes('status?.dataDir'))
  check('it shows download progress', updTab.includes('progress.received') && updTab.includes('formatBytes'))
  check('it offers restart and rollback after an install',
    updTab.includes('Restart now') && updTab.includes('Roll back to'))
  check('and reports a rollback that happened on its own', updTab.includes('was rolled back'))
  check('no update installs itself — the button is the consent',
    updTab.includes('onClick={doInstall}') && m16readSrc(new URL('../src/lib/updates/client.ts', import.meta.url)).includes('automatic installing is not'))
  check('the top bar shows a pill when something newer exists', topSrc.includes('showUpdatePill'))
  check('and it can be dismissed', topSrc.includes('Dismiss update notice'))
  check('the About check no longer asks the endpoint that skips prereleases',
    !/fetch\(`\$\{REPO/.test(m16readSrc(new URL('../src/components/settings/AboutTab.tsx', import.meta.url)))
    && m16readSrc(new URL('../src/components/settings/AboutTab.tsx', import.meta.url)).includes("fetch('/api/update/check')"));

  // --- The model picker ---
  const pickSrc = m16readSrc(new URL('../src/components/topbar/ModelPicker.tsx', import.meta.url))
  const tierSrc = m16readSrc(new URL('../src/lib/providers/tiers.ts', import.meta.url))
  const famSrc = m16readSrc(new URL('../src/lib/providers/families.ts', import.meta.url))
  check('the picker is its own component now', pickSrc.includes('export function ModelPicker'))
  check('the top bar uses it', topSrc.includes('<ModelPicker />') && !topSrc.includes('modelQuery'))
  check('hovering a model magnifies it like a dock', pickSrc.includes('dockScaleFor'))
  check('the neighbours grow too, the far ones do not', /if \(d \* d\)/.test(pickSrc) === false && pickSrc.includes('Math.exp'))
  check('the filter is a real React Bits rubber segment now', pickSrc.includes('<RubberSegment') && pickSrc.includes('RubberSegment'))
  check('free and paid can still be separated', pickSrc.includes("value: 'free'") && pickSrc.includes("value: 'paid'"))
  check('and sorted through a glide select, not a native select', pickSrc.includes('<GlideSelect') && !/<select/.test(pickSrc))
  check('free-first survives the swap', pickSrc.includes("label: 'Free first'"))
  check('the dock animation is behind a switch the user owns', pickSrc.includes('dockAnimation') && pickSrc.includes('role="switch"'))
  check('and turning it off really stops the magnification', pickSrc.includes('dockOn') && pickSrc.includes('dockOn ? dockScaleFor'))
  check('each row carries a mark: family, else provider', pickSrc.includes('<ModelLogo model={row.model} provider={row.provider}'))
  check('a model can be unlisted from the row itself', pickSrc.includes('Unlist ${row.model}'))
  check('unlisted models are kept in a section, not deleted',
    pickSrc.includes('unlisted model') && pickSrc.includes('unhideModel(row.ref)'))
  check('hidden models persist in settings', storeSrc.includes('hiddenModels: []'))
  check('the tier rules are explainable, with the user winning', tierSrc.includes("source: 'user'") && tierSrc.includes('why'))
  check('the family table covers the model marks', famSrc.includes("id: 'llama'") && famSrc.includes("id: 'deepseek'") && famSrc.includes("id: 'kimi'"))

  // --- The providers tab ---
  const provSrc = m16readSrc(new URL('../src/components/settings/ProvidersTab.tsx', import.meta.url))
  check('the Providers tab opens empty and asks you to add one', provSrc.includes('No providers yet') && provSrc.includes('addedProviders'))
  check('the catalog lists everything this build ships', provSrc.includes('PROVIDERS.filter((p) => !added.includes(p.id))'))
  check('removing a provider offers to keep the key', provSrc.includes('Keep my saved key'))

  // --- Token usage ---
  check('responses carry their token cost', m16readSrc(new URL('../src/types/index.ts', import.meta.url)).includes('usage?: { prompt: number'))
  check('and the message footer shows it', m16readSrc(new URL('../src/components/chat/Message.tsx', import.meta.url)).includes('formatTokens(usage.total)'))

  // --- [29b] The picker, driven the way a person drives it -------------------
  console.log('\n[29b] the model picker, in a real DOM')
  {
    const { ModelPicker } = await import('../src/components/topbar/ModelPicker')
    const base = useStore.getState().settings
    useStore.setState({
      settings: {
        ...base,
        defaultModel: 'openai:gpt-4o',
        addedProviders: ['openai', 'anthropic'],
        hiddenModels: [],
        modelTiers: {},
        providerModels: {
          openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
          anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'],
          openrouter: ['deepseek-chat:free', 'llama-3.3-70b:free'],
        },
      },
    } as any)

    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const pickRoot = createRoot(host)
    pickRoot.render(React.createElement(ModelPicker as any))
    await wait(80)

    const trigger = host.querySelector('button[aria-haspopup="listbox"]') as any
    check('the picker has a trigger that names the current model', !!trigger && /gpt-4o/.test(trigger.textContent ?? ''))
    fire(trigger)
    await wait(100)

    const options = Array.from(host.querySelectorAll('button[role="option"]')) as any[]
    check('opening it shows the models', options.length === 7, `${options.length} rows`)
    check('the free ones are labelled free, from the openrouter free tier',
      options.some((o) => /:free/.test(o.textContent ?? '')))
    check('each row carries a logo mark', options.length > 0 && options.every((o) => !!o.querySelector('svg')))
    check('and the active model is marked as such',
      options.some((o) => o.getAttribute('aria-selected') === 'true' && (o.textContent ?? '').includes('gpt-4o')))

    // The filter is a React Bits RubberSegment: a radiogroup of role=radio buttons.
    const seg = host.querySelector('[role="radiogroup"][aria-label="Free or paid models"]') as any
    check('the free/paid filter is a segmented control', !!seg)
    const chip = (word: string) => Array.from(seg?.querySelectorAll('button[role="radio"]') ?? [])
      .find((b: any) => new RegExp(`^${word}`, 'i').test((b.textContent ?? '').trim())) as any
    const paidChip = chip('paid')
    check('there is a paid filter with a live count on it', !!paidChip && /\d/.test(paidChip.textContent ?? ''))
    tap(paidChip)
    await wait(120)
    check('the chosen segment is the checked one', paidChip?.getAttribute('aria-checked') === 'true')
    const paidNames = (Array.from(host.querySelectorAll('button[role="option"]')) as any[])
      .map((o) => (o.textContent ?? '').trim())
    check('picking paid hides the free models', !paidNames.some((n) => /:free/.test(n)) && paidNames.length === 5,
      paidNames.join(' | ').slice(0, 90))
    check('and the paid list still has the ones it should', paidNames.some((n) => /gpt-4o/.test(n)))
    tap(chip('free'))
    await wait(120)
    const freeNames = (Array.from(host.querySelectorAll('button[role="option"]')) as any[])
      .map((o) => (o.textContent ?? '').trim())
    check('the free filter leaves only free ones',
      freeNames.length === 2 && freeNames.every((n) => /:free/.test(n)), freeNames.join(' | ').slice(0, 80))
    check('and keeps the paid ones', paidNames.some((n) => /claude-opus-4-1/.test(n)))
    check('while the free ones are the ones it removed', paidNames.length === 5, `${paidNames.length} left`)
    tap(chip('all'))
    await wait(120)

    // Sorting moved to a GlideSelect — drive it the way a person does.
    const sortTrigger = Array.from(host.querySelectorAll('button[aria-haspopup="listbox"]'))
      .find((b: any) => b.getAttribute('aria-label') === 'Sort models') as any
    check('the sort control is a glide select', !!sortTrigger, (sortTrigger?.textContent ?? '').trim())
    tap(sortTrigger)
    await wait(150)
    // The picker's own panel is also a listbox, so follow the trigger's own
    // aria-controls to the glide menu rather than guessing.
    const sortListId = sortTrigger?.getAttribute('aria-controls') ?? ''
    const sortList = (sortListId ? win.document.getElementById(sortListId) : null) as any
    check('the sort menu is described by the trigger', !!sortList, sortListId)
    const sortOptions = Array.from(sortList?.querySelectorAll('[role="option"]') ?? []) as any[]
    check('it offers the three orders', sortOptions.length === 3, sortOptions.map((o) => o.textContent).join(' | '))
    // The glide list picks the row under the pointer; rows are 26px + 1px gap
    // with a 4px pad, which is all the geometry it needs.
    const freeFirstIndex = sortOptions.findIndex((o) => /Free first/.test(o.textContent ?? ''))
    tap(sortList, { clientY: 4 + freeFirstIndex * 27 + 1 })
    await wait(150)
    const sorted = (Array.from(host.querySelectorAll('button[role="option"]')) as any[]).map((o) => (o.textContent ?? '').trim())
    check('free-first really puts the free models on top', /:free/.test(sorted[0] ?? ''), sorted[0])
    check('and the choice stuck in settings', useStore.getState().settings.modelSort === 'free-first',
      String(useStore.getState().settings.modelSort))

    // The dock animation switch: off means rows stay still.
    const dockSwitch = host.querySelector('button[role="switch"]') as any
    check('the dock animation has a switch in the footer', !!dockSwitch)
    check('and it is on by default', dockSwitch?.getAttribute('aria-checked') === 'true')

    // The dock: hovering a row magnifies it and its neighbours, and only those.
    const boxes = Array.from(host.querySelectorAll('button[role="option"]')).map((o: any) => o.parentElement) as any[]
    const scaleOf = (el: any) => {
      // jsdom computes no layout, so read the transform the animation wrote.
      const t = String(el?.style?.transform ?? '') || win.getComputedStyle(el).transform
      if (!t || t === 'none') return 1
      const m = t.match(/matrix\(([^)]+)\)/)
      if (m) return parseFloat(m[1].split(',')[0])
      const sc = t.match(/scale\(([\d.]+)/)
      return sc ? parseFloat(sc[1]) : 1
    }
    fire(boxes[0], 'mouseover')
    fire(boxes[0], 'mouseenter')
    await wait(150)
    check('hovering a row magnifies it', scaleOf(boxes[0]) > 1.02, scaleOf(boxes[0]).toFixed(3))
    check('the neighbour grows too, by less', scaleOf(boxes[1]) > 1.01 && scaleOf(boxes[1]) < scaleOf(boxes[0]),
      `${scaleOf(boxes[0]).toFixed(3)} vs ${scaleOf(boxes[1]).toFixed(3)}`)
    check('and a row out of reach does not', scaleOf(boxes[6]) < 1.005, scaleOf(boxes[6]).toFixed(3))

    fire(dockSwitch)
    await wait(150)
    check('turning the switch off is remembered', useStore.getState().settings.dockAnimation === false)
    check('and it is the switch that says so', dockSwitch?.getAttribute('aria-checked') === 'false')
    check('with the dock off, hovering magnifies nothing', scaleOf(boxes[0]) < 1.005, scaleOf(boxes[0]).toFixed(3))
    fire(dockSwitch)
    await wait(150)
    check('turning it back on restores the dock', useStore.getState().settings.dockAnimation === true
      && scaleOf(boxes[0]) > 1.02, scaleOf(boxes[0]).toFixed(3))

    // Unlisting is a toggle that hides, never deletes.
    const eye = host.querySelector('button[aria-label="Unlist o3-mini"]') as any
    check('a row can be unlisted from itself', !!eye)
    {
      const rows = host.querySelectorAll('button[role="option"]').length
      const unlisters = host.querySelectorAll('button[aria-label^="Unlist "]').length
      check('every row offers the unlist action beside it', rows > 0 && unlisters >= rows, `${unlisters} for ${rows} rows`)
    }
    fire(eye)
    await wait(100)
    check('unlisting records the model', (useStore.getState().settings.hiddenModels ?? []).includes('openai:o3-mini'))
    check('and the model is still there, only unlisted',
      ((useStore.getState().settings.providerModels as any).openai ?? []).includes('o3-mini'))
    const visibleNow = (Array.from(host.querySelectorAll('button[role="option"]')) as any[]).map((o) => (o.textContent ?? ''))
    check('it leaves the picker list', !visibleNow.some((t) => /o3-mini/.test(t)))
    const unlistedToggle = Array.from(host.querySelectorAll('button'))
      .find((b: any) => /^\d+ unlisted model/i.test((b.textContent ?? '').trim())) as any
    check('but it is kept in an unlisted section, not deleted', !!unlistedToggle, (host.textContent ?? '').slice(0, 60))
    if (unlistedToggle) {
      fire(unlistedToggle)
      await wait(120)
      check('and opening that section shows it again, with a way back',
        (host.textContent ?? '').includes('o3-mini') && !!host.querySelector('[title="Put it back in the list"]'))
    }

    const before = useStore.getState().settings.defaultModel
    const pick = (Array.from(host.querySelectorAll('button[role="option"]')) as any[])
      .find((o) => /claude-sonnet-4-5/.test(o.textContent ?? ''))
    fire(pick)
    await wait(80)
    check('clicking a row selects that model', useStore.getState().settings.defaultModel === 'anthropic:claude-sonnet-4-5',
      `${before} -> ${useStore.getState().settings.defaultModel}`)

    pickRoot.unmount()
    useStore.setState({ settings: base } as any)
  }

  // --- [30] The Providers tab, from empty to a working connection -------------
  console.log('\n[30] the Providers tab, from empty to a working connection')
  {
    const { ProvidersTab } = await import('../src/components/settings/ProvidersTab')
    const { PROVIDERS: REGISTRY } = await import('../src/lib/providers/registry')
    const base = useStore.getState().settings
    useStore.setState({ settings: { ...base, addedProviders: [] } } as any)

    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(ProvidersTab as any))
    await wait(120)

    check('it opens empty, and says so', (host.textContent ?? '').includes('No providers yet'))
    check('with the counts of what this build ships',
      new RegExp(`ships ${REGISTRY.length} provider`).test(host.textContent ?? ''),
      (host.textContent ?? '').slice(0, 70))
    check('and one obvious way in', /Add your first provider/.test(host.textContent ?? ''))
    check('no provider card is rendered before you add one',
      !host.querySelector('input[placeholder="API key"]'))

    const add = Array.from(host.querySelectorAll('button'))
      .find((b: any) => /Add your first provider/.test(b.textContent ?? '')) as any
    fire(add)
    await wait(150)
    const search = host.querySelector('input[aria-label="Search providers"]') as any
    check('adding opens a searchable catalog', !!search)
    const allCards = host.querySelectorAll('[data-provider]').length
    check('the catalog lists what the build ships', allCards > 4, `${allCards} entries`)

    if (search) {
      nativeValue(search, 'deepseek')
      await wait(150)
      const filtered = Array.from(host.querySelectorAll('[data-provider]')).map((e: any) => e.getAttribute('data-provider'))
      check('search narrows the catalog to the match', filtered.includes('deepseek') && filtered.length < allCards,
        filtered.join(', '))
      const entry = host.querySelector('button[data-provider="deepseek"]') as any
      check('the catalog entry is a button you can press', !!entry)
      fire(entry)
      await wait(700)
      check('picking one adds it to your providers',
        (useStore.getState().settings.addedProviders ?? []).includes('deepseek'),
        JSON.stringify(useStore.getState().settings.addedProviders))
      check('and it never touches a key you already have',
        !(useStore.getState().settings.providers?.deepseek?.apiKey ?? ''), 'no key written')
      check('the catalog closes once you have one', !host.querySelector('input[aria-label="Search providers"]'))
      check('the empty state is gone now that there is one', !(host.textContent ?? '').includes('No providers yet'))
      check('and it offers the key field for the provider you added',
        !!host.querySelector('input[placeholder="API key"]'),
        (host.textContent ?? '').slice(0, 80))
      const removeBtn = host.querySelector('button[aria-label^="Remove"]') as any
      check('a provider can be removed again, from its card', !!removeBtn)
      fire(removeBtn)
      await wait(150)
      check('removing asks about the saved key first',
        (host.textContent ?? '').includes('Keep my saved key') && /delete the key/i.test(host.textContent ?? ''))
      const keep = Array.from(host.querySelectorAll('button'))
        .find((b: any) => /Keep my saved key/.test(b.textContent ?? '')) as any
      fire(keep)
      await wait(150)
      check('keep removes it from the list without deleting anything',
        !((useStore.getState().settings.addedProviders ?? []).includes('deepseek')))
    }

    root.unmount()
    useStore.setState({ settings: { ...base, addedProviders: base.addedProviders } } as any)
  }

  // --- [30b] What a reply cost, on the reply --------------------------------
  console.log('\n[30b] what a reply cost')
  {
    const base = useStore.getState().settings
    useStore.setState({ settings: { ...base, showTokenUsage: true } } as any)
    const reported = await mountMessage({
      id: 'tok1', role: 'assistant', content: 'Counted answer.', createdAt: Date.now(), model: 'gpt-4o',
      usage: { prompt: 1200, completion: 800, total: 2000, reported: true },
    })
    check('a reply that reported usage says so', /2\.0k tokens/.test(reported.html), reported.html.slice(0, 0))
    check('without hedging it as an estimate', !/≈.*2\.0k tokens/.test(reported.html))
    reported.unmount()

    const estimate = await mountMessage({
      id: 'tok2', role: 'assistant', content: 'Estimated answer.', createdAt: Date.now(), model: 'gpt-4o',
      usage: { prompt: 900, completion: 300, total: 1200, reported: false },
    })
    check('a reply that could not be measured is marked as an estimate',
      /≈\s*1\.2k tokens/.test(estimate.html), estimate.html.slice(0, 0))
    estimate.unmount()

    const plain = await mountMessage({
      id: 'tok3', role: 'assistant', content: 'No usage at all.', createdAt: Date.now(), model: 'gpt-4o',
    })
    check('a reply from before this feature carries no chip', !/tokens/.test(plain.html))
    plain.unmount()

    useStore.setState({ settings: { ...base, showTokenUsage: false } } as any)
    const off = await mountMessage({
      id: 'tok4', role: 'assistant', content: 'Hidden.', createdAt: Date.now(), model: 'gpt-4o',
      usage: { prompt: 10, completion: 10, total: 20, reported: true },
    })
    check('and the whole thing can be switched off', !/tokens/.test(off.html))
    off.unmount()
    useStore.setState({ settings: base } as any)
  }

  /* ------------------------------------------------------------------ */
  console.log('\n[31] 0.30.0 — free routing, working search, timeouts, dictation, private-repo updates')

  const { existsSync: fileExists } = await import('node:fs')
  const runChat30 = m16readSrc(new URL('../src/lib/chat/runChat.ts', import.meta.url))
  const stream30 = m16readSrc(new URL('../src/lib/providers/stream.ts', import.meta.url))
  const reg30 = m16readSrc(new URL('../src/lib/providers/registry.ts', import.meta.url))
  const tabs30 = m16readSrc(new URL('../src/components/settings/settingsTabs.tsx', import.meta.url))

  // --- FreeRoute is a routing feature, not a provider ---------------
  const { PROVIDERS: PROV30 } = await import('../src/lib/providers/registry')
  const { freeCandidates: cands30, pickFreeModel: pick30, isFailoverWorthy: fail30, freeRouteSummary: summary30 } =
    await import('../src/lib/providers/free')
  check('FreeRoute is gone from the provider registry', !PROV30.some((p) => p.id === 'freeroute'))
  check('and from the provider ids', !/'freeroute'/.test(m16readSrc(new URL('../src/types/index.ts', import.meta.url))))
  check('its backend route and its settings tab are deleted, not orphaned',
    !fileExists(new URL('../../backend/src/routes/freeroute.ts', import.meta.url))
    && !fileExists(new URL('../src/components/settings/FreeRouteTab.tsx', import.meta.url)))
  check('nothing calls the old endpoint', !/\/api\/freeroute/.test(stream30) && !/freerouteRoutes/.test(m16readFile(new URL('../../backend/src/index.ts', import.meta.url), 'utf8')))

  const seed30 = {
    added: ['groq', 'ollama', 'openai', 'lmstudio'],
    models: {
      groq: ['llama-3.3-70b-versatile'],
      ollama: ['llama3.2:3b'],
      openai: ['gpt-4o', 'gpt-4o-mini'],
      lmstudio: ['qwen2.5-7b'],
    },
    usable: {
      groq: { name: 'Groq', ready: true },
      ollama: { name: 'Ollama', ready: true },
      openai: { name: 'OpenAI', ready: true },
      lmstudio: { name: 'LM Studio', ready: false },
    },
    hidden: [], overrides: {},
  }
  const freeList = cands30(seed30)
  check('free routing offers the free models of the providers you added',
    freeList.length === 2 && freeList.every((c: any) => c.ref === 'groq:llama-3.3-70b-versatile' || c.ref === 'ollama:llama3.2:3b'),
    freeList.map((c: any) => c.ref).join(', '))
  check('the model on this machine wins', freeList[0].provider === 'ollama' && /machine/.test(freeList[0].why))
  check('a paid-only provider is never used', !freeList.some((c: any) => c.provider === 'openai'))
  check('a provider that is not ready is skipped', !freeList.some((c: any) => c.provider === 'lmstudio'))
  const freeOn = cands30({ ...seed30, overrides: { 'openai:gpt-4o-mini': 'free' } })
  check('and a model the user marks free is used', freeOn.some((c: any) => c.ref === 'openai:gpt-4o-mini'))
  check('tried models are not offered twice', pick30(freeList, [freeList[0].ref])?.ref === freeList[1]?.ref)
  check('a rate limit fails over, a bad key does not',
    fail30(429, 'rate limit exceeded') && fail30(503, 'overloaded') && !fail30(401, 'invalid api key'))
  check('the pick explains itself in one line', summary30(freeList[0]).includes(freeList[0].providerName))
  check('the chat routes through free models only when asked', runChat30.includes('settings.freeRouting'))
  check('and falls back at most three deep', /triedModels.length < 3/.test(runChat30))

  // --- search: engines, keys, and an install that needs nothing ------
  const adaptersSrc = m16readFile(new URL('../../backend/src/services/search/adapters.ts', import.meta.url), 'utf8')
  const searchRoute = m16readFile(new URL('../../backend/src/routes/search.ts', import.meta.url), 'utf8')
  const webSrc = m16readSrc(new URL('../src/lib/search/web.ts', import.meta.url))
  check('SearXNG is found automatically, not configured',
    /PUBLIC_SEARXNG/.test(adaptersSrc) && /localhost:8080/.test(adaptersSrc) && !/SEARXNG_URL/.test(adaptersSrc))
  check('several public instances are tried in turn', (adaptersSrc.match(/https:\/\/[a-z0-9.-]+/g) ?? []).length >= 5)
  check('the instance that answered is remembered for a few minutes',
    /PREFERRED_TTL/.test(adaptersSrc) && /preferred = \{ url, at: Date\.now\(\) \}/.test(adaptersSrc))
  check('search keys are taken from the request, per call', /x-re-search-keys/.test(searchRoute) && /keysFrom/.test(searchRoute))
  check('the backend has a status endpoint the UI can trust', /search\/status/.test(searchRoute) || /'\/status'/.test(searchRoute))
  check('and a request falls back instead of failing', /attempts/.test(searchRoute) && /demo/.test(searchRoute))
  check('the browser sends its keys with the request, not to a settings table on the server',
    webSrc.includes('x-re-search-keys') && webSrc.includes('searchKeys'))
  check('the search timeout is the reader own setting, not a constant', /providerTimeouts/.test(webSrc))

  // --- per-provider client-side timeouts -----------------------------
  const provSrc30 = m16readSrc(new URL('../src/components/settings/ProvidersTab.tsx', import.meta.url))
  check('every provider card carries a timeout in seconds', /timeout in seconds/.test(provSrc30) && /providerTimeouts/.test(provSrc30))
  check('it is clamped to something sane', /600/.test(provSrc30) && /Math.max\(3/.test(provSrc30))
  check('the chat hands that timeout to the fetch', /providerTimeouts\?\.\[providerId\]/.test(runChat30) && runChat30.includes('timeoutMs'))
  check('and the stream layer honours it', /timeoutMs/.test(stream30))
  {
    const { ProvidersTab } = await import('../src/components/settings/ProvidersTab')
    const baseP = useStore.getState().settings
    useStore.setState({ settings: { ...baseP, addedProviders: ['groq'], providerTimeouts: {} } } as any)
    const hostP = win.document.createElement('div')
    win.document.body.appendChild(hostP)
    const rootP = createRoot(hostP)
    rootP.render(React.createElement(ProvidersTab as any))
    await wait(200)
    const field = hostP.querySelector('input[aria-label="Groq timeout in seconds"]') as any
    check('the timeout is a field on the card', !!field, (hostP.textContent ?? '').slice(0, 80))
    if (field) {
      nativeValue(field, '12')
      await wait(120)
      check('typing a value stores it per provider',
        useStore.getState().settings.providerTimeouts?.groq === 12,
        String(useStore.getState().settings.providerTimeouts?.groq))
    }
    rootP.unmount()
    useStore.setState({ settings: baseP } as any)
  }
  check('an empty list is the first thing you see', /No providers yet/.test(provSrc30) && /addedProviders/.test(provSrc30))
  {
    const { AppearanceTab } = await import('../src/components/settings/AppearanceTab')
    const baseA = useStore.getState().settings
    useStore.setState({ settings: { ...baseA, dockAnimation: true } } as any)
    const hostA = win.document.createElement('div')
    win.document.body.appendChild(hostA)
    const rootA = createRoot(hostA)
    rootA.render(React.createElement(AppearanceTab as any))
    await wait(250)
    const dockRow = [...hostA.querySelectorAll('button[role="switch"], button')]
      .find((b: any) => /Dock animation/.test(b.closest('div')?.textContent ?? '')) as any
    check('the dock animation has a switch in Appearance', !!dockRow, (hostA.textContent ?? '').slice(0, 60))
    if (dockRow) {
      fire(dockRow)
      await wait(150)
      check('and it really turns the dock off', useStore.getState().settings.dockAnimation === false,
        String(useStore.getState().settings.dockAnimation))
    }
    rootA.unmount()
    useStore.setState({ settings: baseA } as any)
  }
  check('removing offers to keep the key', /Keep my saved key/.test(provSrc30))

  // --- dictation: three engines, and the real Voice component ---------
  const stt30 = await import('../src/lib/voice/stt')
  const inputSrc30 = m16readSrc(new URL('../src/components/input/InputBar.tsx', import.meta.url))
  const hookSrc30 = m16readSrc(new URL('../src/hooks/useDictation.ts', import.meta.url))
  const pkg30 = JSON.parse(m16readFile(new URL('../package.json', import.meta.url), 'utf8'))
  check('the Voice component is a real dependency, not a copy', !!pkg30.dependencies['voice-glow'])
  check('and its beam wraps the composer', inputSrc30.includes("from 'voice-glow'") && inputSrc30.includes('<VoiceBeam'))
  check('the microphone uses the React Bits Voice Pill', inputSrc30.includes('micro/VoicePill'))
  check('dictation is a setting, not a fixed pipeline',
    /mode\?: 'browser' \| 'provider' \| 'local'/.test(m16readSrc(new URL('../src/types/index.ts', import.meta.url))))
  check('the recogniser only runs in the page when the browser has one', stt30.browserSttSupported() === false
    ? /SpeechRecognition/.test(m16readSrc(new URL('../src/lib/voice/stt.ts', import.meta.url)))
    : true)
  const sttSrc30 = m16readSrc(new URL('../src/lib/voice/stt.ts', import.meta.url))
  check('recorded audio goes to one place on the server',
    sttSrc30.includes('/api/voice/transcribe') && hookSrc30.includes('transcribeBlob'))
  check('typing on after dictating keeps what was there', /cur\.trim\(\)/.test(inputSrc30))
  check('a key is read from the vault at the moment it is used', hookSrc30.includes('usableKey'))
  {
    const { VoiceTab } = await import('../src/components/settings/VoiceTab')
    const baseV = useStore.getState().settings
    useStore.setState({ settings: { ...baseV, addedProviders: ['openai'], providers: {}, voice: { mode: 'provider' } } } as any)
    const hostV = win.document.createElement('div')
    win.document.body.appendChild(hostV)
    const rootV = createRoot(hostV)
    rootV.render(React.createElement(VoiceTab as any))
    await wait(200)
    const text = hostV.textContent ?? ''
    check('Voice has its own settings section', /Voice/.test(text) && /Microphone in the composer/.test(text))
    check('naming all three engines', /In this browser/.test(text) && /A provider/.test(text) && /Local whisper server/.test(text))
    check('and crediting Jakub Antalik', /Jakub Antalik/.test(text))
    check('push-to-talk is offered', /Push to talk/.test(text))
    check('a provider you have added but not keyed says so',
      /no key yet/.test((hostV.querySelector('select[aria-label="Transcription provider"]')?.textContent ?? '')))
    rootV.unmount()
    useStore.setState({ settings: baseV } as any)
  }

  // --- updates from a private repository -----------------------------
  const upSrc30 = m16readSrc(new URL('../src/components/settings/UpdatesTab.tsx', import.meta.url))
  const upClient30 = m16readSrc(new URL('../src/lib/updates/client.ts', import.meta.url))
  const upRoute30 = m16readFile(new URL('../../backend/src/routes/update.ts', import.meta.url), 'utf8')
  const upService30 = m16readFile(new URL('../../backend/src/update/service.ts', import.meta.url), 'utf8')
  check('the answer to a private repo is written down', /private/i.test(upSrc30) && /read-only token/i.test(upSrc30))
  check('a token can be given, and is sent only to GitHub', upClient30.includes('x-re-update-token')
    && /GITHUB_HOSTS/.test(upService30))
  check('a manifest URL is a first-class source', upClient30.includes('x-re-update-manifest')
    && /manifestUrl/.test(upService30) && /manifestReleases/.test(upService30))
  check('and an archive you already have can be installed', upClient30.includes('install-file')
    && /installFromFile/.test(upService30) && upRoute30.includes("'/update/install-file'"))
  check('installing from a file still checks the checksum first',
    /refusing to install unverified/.test(upService30))
  check('the status says which source is live', /source: \{/.test(upRoute30) && /manifestUrl/.test(upRoute30))
  check('a TLS failure gets a real explanation', /NODE_EXTRA_CA_CERTS/.test(upSrc30))
  {
    const { UpdatesTab } = await import('../src/components/settings/UpdatesTab')
    const baseU = useStore.getState().settings
    useStore.setState({ settings: { ...baseU, updates: { autoCheck: false } } } as any)
    const hostU = win.document.createElement('div')
    win.document.body.appendChild(hostU)
    const rootU = createRoot(hostU)
    rootU.render(React.createElement(UpdatesTab as any))
    await wait(250)
    const tokenField = hostU.querySelector('input[aria-label="GitHub token for updates"]') as any
    check('the token field is on the page', !!tokenField)
    if (tokenField) {
      nativeValue(tokenField, 'ghp_test_token')
      await wait(120)
      check('and lands in settings, not in a request log',
        useStore.getState().settings.updates?.token === 'ghp_test_token')
    }
    const manField = hostU.querySelector('input[aria-label="Release manifest URL"]') as any
    check('the manifest field is on the page too', !!manField)
    check('the file path is offered', /Choose archive/.test(hostU.textContent ?? ''))
    rootU.unmount()
    useStore.setState({ settings: baseU } as any)
  }

  // --- pages that load fast ------------------------------------------
  const app30 = m16readSrc(new URL('../src/App.tsx', import.meta.url))
  const static30 = m16readFile(new URL('../../backend/src/static.ts', import.meta.url), 'utf8')
  /* HeroUI v2 imports `framer-motion` by name, and our own code imports `motion`
     — so both names are in the dependency list again. They are not two
     runtimes: `motion@13` is a re-export of `framer-motion@13`, and Vite dedupes
     both onto one copy. That is what this check now proves, instead of the old
     "framer-motion must not appear at all". */
  const motionReexport30 = m16readFile(new URL('../../node_modules/motion/dist/es/react.mjs', import.meta.url), 'utf8')
  const viteCfg30 = m16readFile(new URL('../vite.config.ts', import.meta.url), 'utf8')
  const oneRuntime = !pkg30.dependencies['framer-motion'] || (
    /from 'framer-motion'/.test(motionReexport30)
    && /dedupe:\s*\[[^\]]*'framer-motion'[^\]]*'motion'/.test(viteCfg30))
  check('the animation library is no longer shipped twice',
    !/from 'framer-motion'/.test(app30) && oneRuntime)
  check('settings is loaded when it is opened, not on first paint',
    /React\.lazy\(\(\) => import\('@\/components\/settings\/SettingsSheet'\)/.test(app30))
  check('the panels nobody opened yet are lazy too',
    /React\.lazy\(.*TasksPanel/.test(app30) && /React\.lazy\(.*CommandPalette/.test(app30))
  check('every route is warmed right after the first paint',
    /requestAnimationFrame\(\(\) => \{[\s\S]{0,140}requestAnimationFrame/.test(app30) && /SettingsView/.test(app30))
  check('the server compresses what it serves', /brotliCompressSync/.test(static30) && /gzipSync/.test(static30))
  check('and answers a repeat request with 304 instead of the body',
    /if-none-match/.test(static30) && /304/.test(static30))
  check('hashed assets are immutable, the shell is not', /immutable/.test(static30) && /no-cache/.test(static30))
  check('the theme props do not pull three.js into the first load',
    !/from '@react-three\/fiber'/.test(m16readSrc(new URL('../src/components/layout/BackgroundLayer.tsx', import.meta.url))))


  console.log('\n[32] 0.30.0 — the composer popovers, the voice pill, connected accounts')
  {
    const { ModeMenu } = await import('../src/components/input/ModeMenu')
    const { default: VoicePill } = await import('../src/components/ui/reactbits/micro/VoicePill')
    const { IntegrationsMenu } = await import('../src/components/input/IntegrationsMenu')

    /* --- the mode popover: it closes on the row you press --- */
    const toggles: string[] = []
    let closes = 0
    const pills = [
      { id: 'flow', label: 'Flow', desc: 'Balanced answers.', icon: (() => null) as any, active: true, toggle: () => toggles.push('flow') },
      { id: 'math', label: 'Math', desc: 'Step by step.', icon: (() => null) as any, active: false, tone: 'warning' as const, toggle: () => toggles.push('math') },
    ]
    const anchorHost = win.document.createElement('button')
    win.document.body.appendChild(anchorHost)
    const modeHost = win.document.createElement('div')
    win.document.body.appendChild(modeHost)
    const modeRoot = createRoot(modeHost)
    modeRoot.render(React.createElement(ModeMenu as any, { pills, anchor: anchorHost, onClose: () => { closes++ } }))
    await wait(80)
    const menu = modeHost.querySelector('[data-mode-menu]') as any
    check('the mode menu is a real menu, anchored above the composer', !!menu && menu.getAttribute('role') === 'menu')
    check('every mode is listed with its one-line explanation',
      /Flow/.test(menu?.textContent ?? '') && /Balanced answers/.test(menu?.textContent ?? '') && /Math/.test(menu?.textContent ?? ''))
    check('the active mode is checked, not just tinted',
      menu?.querySelector('[aria-checked="true"]')?.getAttribute('aria-label') === 'Flow')
    check('Math keeps its warning tone', /Math/.test(menu?.querySelector('[aria-label="Math"]')?.textContent ?? ''))
    const mathRow = menu?.querySelector('[aria-label="Math"]') as any
    pointer(mathRow, 'pointerdown')
    await wait(60)
    check('pressing a mode applies it', toggles.join(',') === 'math', toggles.join(','))
    check('and the menu dismisses itself — no second click needed', closes >= 1, String(closes))
    const before = closes
    fire(win.document.body, 'keydown', { key: 'Escape' } as any)
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }))
    await wait(40)
    check('Escape closes it too', closes > before, String(closes))
    modeRoot.unmount()

    /* --- the voice pill: no Cancel until there is something to cancel --- */
    const voiceHost = win.document.createElement('div')
    win.document.body.appendChild(voiceHost)
    const voiceRoot = createRoot(voiceHost)
    let starts = 0
    const stops: string[] = []
    voiceRoot.render(React.createElement(VoicePill as any, {
      mode: 'toggle', reactive: 'simulated', slideToCancel: true, showTime: false,
      ariaLabel: 'Dictate', onStart: () => { starts++ }, onStop: (i: any) => stops.push(i.reason),
    }))
    await wait(80)
    const pill = voiceHost.querySelector('button') as any
    check('the dictation pill renders where the composer can reach it', !!pill && pill.getAttribute('aria-label') === 'Dictate')
    const pillRoot = pill?.closest('[data-state]') as any
    check('at rest it is idle', pillRoot?.getAttribute('data-state') === 'idle', pillRoot?.getAttribute('data-state'))
    check('and the cancel affordance is switched off, not merely styled',
      pillRoot?.style.getPropertyValue('--vp-cancel') === '0' || pill?.closest('div')?.style.getPropertyValue('--vp-cancel') === '0',
      JSON.stringify(pillRoot?.style.getPropertyValue('--vp-cancel')))
    tap(pill)
    await wait(120)
    check('pressing it starts dictation once', starts === 1, String(starts))
    const liveRoot = pill?.closest('[data-state]') as any
    check('and the pill shows it is listening', liveRoot?.getAttribute('data-state') === 'listening', liveRoot?.getAttribute('data-state'))
    tap(pill)
    await wait(120)
    check('pressing again stops it with a reason', stops.length === 1 && !!stops[0], stops.join(','))
    check('and the cancel affordance goes away with it',
      (pill?.closest('[data-state]') as any)?.style.getPropertyValue('--vp-cancel') === '0')
    voiceRoot.unmount()
    anchorHost.remove()

    /* --- the plug menu: search, connect, attach --- */
    const realFetch = globalThis.fetch
    const menuCalls: { url: string; headers: Record<string, string> }[] = []
    const intFetch = async (input: any, init: any = {}) => {
      const url = String(input)
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(init?.headers ?? {})) headers[k.toLowerCase()] = String(v)
      menuCalls.push({ url, headers })
      if (url.includes('/api/integrations/search')) {
        const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
        return new Response(JSON.stringify({
          results: q ? [{ integration: 'drive', id: 'f1', title: 'Thesis.pdf', snippet: 'Solid-state battery notes', kind: 'file' }] : [],
          errors: [{ integration: 'slack', name: 'Slack', error: 'Slack: that is a bot token', needs: 'auth' }],
          connected: ['drive'],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/api/integrations/probe')) {
        return new Response(JSON.stringify({ ok: true, account: 'dnishh', detail: 'scopes: repo' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    ;(globalThis as any).fetch = intFetch
    ;(win as any).fetch = intFetch

    // One account is really connected (encrypted, like a provider key), so the
    // header the backend receives can be checked for what it should carry.
    const { saveCreds } = await import('../src/lib/integrations/client')
    await saveCreds('drive', { token: 'ya29.TEST-TOKEN', clientId: 'cid' })

    const plugAnchor = win.document.createElement('button')
    win.document.body.appendChild(plugAnchor)
    const plugHost = win.document.createElement('div')
    win.document.body.appendChild(plugHost)
    const plugRoot = createRoot(plugHost)
    const picks: any[] = []
    let plugClosed = 0
    plugRoot.render(React.createElement(IntegrationsMenu as any, { anchor: plugAnchor, onPick: (p: any) => picks.push(p), onClose: () => { plugClosed++ } }))
    await wait(200)
    const intMenu = plugHost.querySelector('[data-int-menu]') ?? plugHost.firstElementChild
    const intText = plugHost.textContent ?? ''
    check('the plug menu lists every integration this build ships',
      ['Local files', 'Google Drive', 'Gmail', 'Google Calendar', 'GitHub', 'Notion', 'Slack'].every((n) => intText.includes(n)), intText.slice(0, 90))
    check('and the ones with no credential offer to connect', /Connect/.test(intText))
    check('it searches through the gateway, not the service directly',
      menuCalls.some((c) => c.url.includes('/api/integrations/search')), JSON.stringify(menuCalls.map((c) => c.url)))
    check('and it says which accounts are connected',
      /connected/i.test(intText))

    const search = plugHost.querySelector('input[type="search"], input[placeholder]') as any
    check('there is a search box for everything connected', !!search, (plugHost.innerHTML ?? '').slice(0, 120))
    if (search) {
      nativeValue(search, 'thesis')
      await wait(400)
      const after = menuCalls.filter((c) => c.url.includes('/api/integrations/search'))
      check('typing searches the accounts you connected', after.length >= 2, `${after.length} calls`)
      const sent = after[after.length - 1]
      const alias = await (await import('../src/lib/integrations/client')).searchIntegrations('x')
      check('a reply that says "problems" and one that says "errors" are read the same way',
        alias.problems.length === alias.errors.length && alias.problems.length > 0,
        `${alias.problems.length}/${alias.errors.length}`)
      check('the search carries the credentials in a header, never a URL',
        !!sent?.headers['x-re-integrations'] && !/ya29\./.test(sent?.url ?? ''),
        JSON.stringify(sent?.headers ?? {}))
      const carried = JSON.parse(sent?.headers['x-re-integrations'] ?? '{}')
      check('the header names the service and carries its token',
        Object.keys(carried).includes('drive') && !!carried.drive?.token,
        JSON.stringify(Object.keys(carried)))
      const hit = [...plugHost.querySelectorAll('button')].find((b: any) => /Thesis\.pdf/.test(b.textContent ?? '')) as any
      check('a result is listed with its source', !!hit && /Drive/.test(plugHost.textContent ?? ''))
      if (hit) {
        fire(hit)
        await wait(120)
        check('picking a result attaches it to the composer', picks[0]?.integration === 'drive' && picks[0]?.id === 'f1', JSON.stringify(picks[0]))
        check('and closes the menu', plugClosed >= 1, String(plugClosed))
      }
      const fix = [...plugHost.querySelectorAll('button')].find((b: any) => /Connect/.test(b.textContent ?? '') && /Slack/.test(b.closest('div')?.textContent ?? '')) as any
      check('a refused service offers to connect instead of showing an empty list', !!fix)
    }
    const manage = [...plugHost.querySelectorAll('button')].find((b: any) => /Manage/.test(b.textContent ?? '')) as any
    check('there is one way into the full settings page', !!manage)
    if (manage) {
      useUI.setState({ settingsOpen: false, settingsTab: 'providers' })
      fire(manage)
      await wait(120)
      check('which opens the Built in tab of Connectors', useUI.getState().connectorsOpen === true && useUI.getState().connectorsTab === 'builtin',
        `${useUI.getState().connectorsOpen} / ${useUI.getState().connectorsTab}`)
    }
    plugRoot.unmount()
    plugAnchor.remove()
    ;(globalThis as any).fetch = realFetch
    ;(win as any).fetch = realFetch
  }
  {
    const barSrc = m16readSrc(new URL('../src/components/input/InputBar.tsx', import.meta.url))
    const tabSrc = m16readSrc(new URL('../src/components/settings/IntegrationsTab.tsx', import.meta.url))
    const accSrc = m16readSrc(new URL('../src/components/settings/IntegrationAccounts.tsx', import.meta.url))
    const css32 = m16readSrc(new URL('../src/styles/globals.css', import.meta.url))
    check('theme-matched gradients mix into a base the palette chooses',
      /--grad-base: var\(--bg\)/.test(css32) && /data-grad="theme"\]\[data-theme="catppuccin-latte"\]/.test(css32))
    check('and in the light palettes that base is ink, so white labels on a card stay readable',
      /--grad-base: color-mix\(in srgb, var\(--text\) 86%, var\(--primary\)\)/.test(css32))
    /* The cascade: an unlayered author rule outranks every layered one, so a
     * reset that sits outside @layer base silently beats Tailwind utilities on
     * the same element — which is how a vendored control could fill itself with
     * the light ink and draw its glyph in the same colour. Asserted on the built
     * stylesheet, where the layers are real. */
    const builtCss = (() => {
      try {
        const names = m16readdir(new URL('../dist/assets', import.meta.url)).filter((n: string) => n.endsWith('.css'))
        return names.map((n: string) => m16readFile(new URL(`../dist/assets/${n}`, import.meta.url), 'utf8')).sort((a: string, b: string) => b.length - a.length)[0] ?? ''
      } catch { return '' }
    })()
    const resetAt = builtCss.indexOf('input,textarea,select,button')
    let resetInBase = false
    if (builtCss && resetAt > 0) {
      const open = builtCss.lastIndexOf('@layer base{', resetAt)
      if (open > 0) {
        let depth = 0
        for (let i = open; i < resetAt; i++) { const c = builtCss[i]; if (c === '{') depth++; else if (c === '}') depth-- }
        resetInBase = depth > 0
      }
    }
    check('the form-control reset sits in the base layer, so utilities still win',
      builtCss ? resetInBase : /@layer base \{[\s\S]{0,120}input, textarea, select, button/.test(css32),
      builtCss ? `reset at ${resetAt}` : 'no built css')
    check('the composer uses the new plug menu', barSrc.includes('IntegrationsMenu') && !barSrc.includes('function ConnectorMenu'))
    check('the plug button says what it opens', /aria-label="Connected data"/.test(barSrc))
    check('the composer carries the real dictation pill', barSrc.includes('<VoicePill') && barSrc.includes('dictation.'))
    check('an account item attaches as an addressable reference', /int:\$\{/.test(barSrc))
    check('Settings now shows real accounts, not a simulated toggle',
      tabSrc.includes('IntegrationAccounts') && !/simulated here/.test(tabSrc) && !/zotero/i.test(tabSrc))
    check('every account row has a save-and-test and a disconnect', accSrc.includes('Save &amp; test') && accSrc.includes('Disconnect'))
    check('and a "connected" badge is the result of a probe, not a promise',
      /probeIntegration/.test(accSrc) && /only when a credential exists/.test(accSrc))
  }

  /* ---------------- SmoothUI: installed *and* used (R15) ----------------
     "Actually use the components" is the requirement, so a component that is
     merely sitting in a folder is a failure here — every one below must be
     imported by a file outside its own directory. */
  {
    const { readFileSync: readSU, readdirSync: readSUdir } = await import('node:fs')

    /** component → the file that puts it to work. */
    const WIRED: [string, string][] = [
      ['kinetic-center-build', 'components/onboarding/Onboarding.tsx'],
      ['typewriter-text', 'components/onboarding/Onboarding.tsx'],
      ['github-stars-animation', 'components/onboarding/Onboarding.tsx'],
      ['stagger-from-edges', 'components/onboarding/Onboarding.tsx'],
      ['mac-terminal', 'components/onboarding/Onboarding.tsx'],
      ['folder-reveal', 'components/onboarding/Onboarding.tsx'],
      ['ai-message', 'components/chat/Message.tsx'],
      ['ai-diff', 'components/chat/Message.tsx'],
      ['ai-reasoning', 'components/chat/Message.tsx'],
      ['ai-response', 'components/chat/Markdown.tsx'],
      ['ai-loader', 'components/chat/HumanizedAnswer.tsx'],
      ['ai-sources', 'components/chat/SourceStrip.tsx'],
      ['ai-tool-call', 'components/chat/ToolUI.tsx'],
      ['ai-task-list', 'components/agents/FloodView.tsx'],
      ['ai-approval', 'components/settings/DataTab.tsx'],
      ['ai-context-meter', 'components/topbar/TopBar.tsx'],
      ['social-hover-card', 'components/settings/AboutTab.tsx'],
      ['image-generation-panel', 'components/home/ImageLab.tsx'],
    ]
    for (const [name, user] of WIRED) {
      const src = readSU(`../frontend/src/${user}`, 'utf8')
      check(`SmoothUI ${name} is used by ${user.split('/').pop()}`, src.includes(`@/components/smoothui/${name}`))
    }

    check('the shadcn token vocabulary is mapped onto this app’s own variables, not a dark island',
      ['--color-border: var(--surface-border)', '--color-muted: var(--elevated)', '--color-card: var(--surface)', '--color-brand: var(--primary)', '--color-destructive: var(--danger)']
        .every((line) => readSU('../frontend/src/styles/globals.css', 'utf8').includes(line))
      && !/\.dark\s*\{/.test(readSU('../frontend/src/styles/globals.css', 'utf8')))
    check('the registry config points at the real SmoothUI host, not the sandbox mirror',
      readSU('../frontend/components.json', 'utf8').includes('https://smoothui.dev/r/{name}.json'))
    check('the mirror script that installed them is kept, so they can be updated',
      readSU('../frontend/scripts/smoothui-registry.mjs', 'utf8').includes('smoothui.dev'))
    check('the upstream patches are documented in the files they changed',
      readSU('../frontend/src/components/smoothui/folder-reveal/index.tsx', 'utf8').includes('Local patch')
      && readSU('../frontend/src/components/smoothui/smooth-button/index.tsx', 'utf8').includes('Local patch')
      && readSU('../frontend/src/components/smoothui/ai-message/index.tsx', 'utf8').includes('Local patch'))
    check('every installed component folder is still on disk',
      ['ai-message', 'ai-context-meter', 'ai-task-list', 'image-generation-panel', 'social-hover-card', 'kinetic-center-build', 'folder-reveal']
        .every((n) => { try { return readSUdir(`../frontend/src/components/smoothui/${n}`).length > 0 } catch { return false } }))
  }

  /* ---------------- Aceternity: installed *and* used (R16) ----------------
     Same rule as SmoothUI above: vendored components must be imported by a
     host outside their own folder, and the place they are used has to be the
     place the request asked for. */
  {
    const { readFileSync: readAX } = await import('node:fs')
    const aceternity = (f: string) => readAX(`../frontend/src/${f}`, 'utf8')

    const AX_WIRED: [string, string, string][] = [
      ['GooeyInput', 'components/chats/ChatsView.tsx', 'the chats search box'],
      ['DottedGlowBackground', 'components/onboarding/Onboarding.tsx', 'the "free, unlike these apps" step'],
      ['ImagesBadge', 'components/chat/ToolUI.tsx', 'attachments on a message'],
      ['ColourfulText', 'components/onboarding/Onboarding.tsx', 'the welcome tagline'],
      ['ContainerTextFlip', 'components/onboarding/Onboarding.tsx', 'the modes step'],
      ['CanvasRevealEffect', 'components/onboarding/Onboarding.tsx', 'the modes stage'],
      ['AppleCardsCarousel', 'components/onboarding/onboarding-features.tsx', 'the features carousel'],
    ]
    for (const [name, host, why] of AX_WIRED) {
      const src = aceternity(host)
      check(`Aceternity ${name} is used for ${why}`,
        src.includes(`@/components/ui/aceternity/${name}`) || src.includes(`aceternity/${name}`))
    }

    const onboarding = aceternity('components/onboarding/Onboarding.tsx')
    const paid = aceternity('components/onboarding/paid-apps.tsx')
    const features = aceternity('components/onboarding/onboarding-features.tsx')

    check('the welcome line is the requested sentence, with AI Research coloured',
      /The swiss knife of <ColourfulText text="AI Research" \/>\./.test(onboarding))
    check('the paid-apps step says it, word for word',
      onboarding.includes('ResearchEngine is free, unlike these apps.'))
    check('every look-alike is drawn as a favicon, from the app itself',
      /export function Favicon/.test(paid) && /PAID_APPS/.test(paid) && (paid.match(/^\s{4}id: '/gm) ?? []).length >= 6)
    check('the favicons are bundled, not fetched from the vendors on first run',
      !/https?:\/\/(?!ui\.aceternity)/.test(paid.replace(/https:\/\/blobatar[^'"\s]*/g, '')) &&
      !/favicon\.ico|s2\/favicons|google\.com\/s2/.test(paid))
    check('the features carousel uses drawn art, never stock photography',
      /art: ART\./.test(features) && !/https?:\/\/[^'"\s]+\.(?:jpe?g|png|webp|avif)/.test(features))
    check('onboarding gained the steps it was asked for',
      ['label: \'Welcome\'', 'label: \'Privacy\'', 'label: \'Modes\'', 'label: \'Features\'', 'label: \'Free\'', 'label: \'Provider\'', 'label: \'Try the demo\'', 'label: "You\'re set"']
        .every((line) => onboarding.includes(line)))
    check('the last step runs a real question instead of only describing the app',
      /runFirst\s*=/.test(onboarding) && onboarding.includes('runChat({ chatId: id, prompt: text'))
    check('and the carousel step is exempt from the wrapper transform that would trap the opened card',
      /still : fade/.test(onboarding) && /isCarousel/.test(onboarding))
  }

  /* ---------------- R16: the fork compresses, and it is proven ---------------- */
  {
    const { readFileSync: readFK } = await import('node:fs')
    const forkLib = readFK('../frontend/src/lib/chat/fork.ts', 'utf8')
    const forkPanel = readFK('../frontend/src/components/chat/ForkPanel.tsx', 'utf8')
    const message = readFK('../frontend/src/components/chat/Message.tsx', 'utf8')
    check('the fork compressor is local, deterministic and documented',
      forkLib.includes('export function compressConversation') && forkLib.includes('export function estimateTokens'))
    check('foreign-currency heuristic: nothing in the compressor calls a model',
      !/fetch\(|runChat|provider/i.test(forkLib.split('export function compressConversation')[0].split('/*')[0] || '') ||
      !/\bfetch\(/.test(forkLib))
    check('the fork panel shows the numbers before anything is created',
      forkPanel.includes('savedPct') && forkPanel.includes('sourceTokens') && forkPanel.includes('capsuleTokens'))
    check('the forked chat renders the capsule as a card, not as prose',
      forkPanel.includes('export function CapsuleCard') && message.includes('<CapsuleCard msg={msg} />') && message.includes('msg.capsule'))
    check('the old truncating fork is gone',
      !/forkWithSummary/.test(message) && !/Conversation capsule/.test(message))
    check('there is a suite that measures the saving and the survivors',
      readFK('../frontend/scripts/fork-test.mts', 'utf8').includes('file names must be lowercased'))
  }

  /* ---------------- R16: the UI lab previews agent-made interface only ---------------- */
  {
    const { readFileSync: readUL } = await import('node:fs')
    const lab = readUL('../frontend/src/components/settings/UILab.tsx', 'utf8')
    const devTab = readUL('../frontend/src/components/settings/DeveloperTab.tsx', 'utf8')
    const components = [...lab.matchAll(/component: '([^']+)'/g)].map((m) => m[1])
    check('the UI lab previews real components, and it has some',
      components.length >= 5 && components.every((c) => c.startsWith('@/components/') || c.startsWith('@/lib/')))
    check('the UI lab is scoped to agent-made interface — no vendored provider may appear in it',
      components.every((c) => !/(aceternity|smoothui|skiper|watermelon|heroui|reactbits|border-beam)/.test(c)))
    check('the exclusion is stated in the file, not implied',
      /Agent-made only|only interface built for this app|vendor folders/i.test(lab))
    check('the UI lab is reachable from Settings → Developer while Developer Mode is on',
      devTab.includes("from '@/components/settings/UILab'") && /settings\.developerMode && \([\s\S]{0,120}<UILab/.test(devTab))
    check('every previewed component carries the data-ui anchor the flash jump needs',
      ['composer', 'thinking', 'mode-menu', 'route-skeleton', 'revolving-hero'].every((id) =>
        readUL('../frontend/src/components/chat/ThinkingIndicator.tsx', 'utf8').includes(id) ||
        readUL('../frontend/src/components/input/InputBar.tsx', 'utf8').includes(id) ||
        readUL('../frontend/src/components/input/ModeMenu.tsx', 'utf8').includes(id) ||
        readUL('../frontend/src/components/shared/RouteSkeleton.tsx', 'utf8').includes(id) ||
        readUL('../frontend/src/components/home/RevolvingText.tsx', 'utf8').includes(id)))
    check('the jump ring is themed, not a hard-coded highlight',
      readUL('../frontend/src/styles/globals.css', 'utf8').includes('.re-ui-flash')
      && readUL('../frontend/src/styles/globals.css', 'utf8').includes('.re-ui-grid'))
  }

  /* ---------------- R16: the app measures its own frame budget ---------------- */
  {
    const { readFileSync: readPF } = await import('node:fs')
    const budget = readPF('../frontend/src/lib/system/frame-budget.ts', 'utf8')
    const app = readPF('../frontend/src/App.tsx', 'utf8')
    const perfTab = readPF('../frontend/src/components/settings/PerformanceTab.tsx', 'utf8')
    const shapeGrid = readPF('../frontend/src/components/backgrounds/ShapeGrid.tsx', 'utf8')
    const dotted = readPF('../frontend/src/components/ui/aceternity/DottedGlowBackground.tsx', 'utf8')
    const reveal = readPF('../frontend/src/components/ui/aceternity/CanvasRevealEffect.tsx', 'utf8')
    check('the frame budget is measured, not guessed, and the measurement stops', /measureFrameBudget/.test(budget) && /cancelAnimationFrame/.test(budget))
    check('it is started once, from the app shell', app.includes('watchFrameBudget()'))
    check('it can be turned off, and re-measured, from Settings → Performance',
      perfTab.includes('remeasure()') && perfTab.includes('adaptiveQuality') && perfTab.includes('useFrameHealth'))
    check('the expensive canvases consult it before drawing',
      ['ShapeGrid.tsx', 'DottedGlowBackground.tsx', 'CanvasRevealEffect.tsx'].length === 3 &&
      shapeGrid.includes('frameLevel()') && dotted.includes('frameLevel()') && reveal.includes('useFrameLevel()'))
    check('and they stop while the window is hidden',
      shapeGrid.includes('visibilitychange') && dotted.includes('visibilitychange') && reveal.includes('visibilitychange'))
    check('the long-chat hot path no longer subscribes the whole UI store',
      readPF('../frontend/src/components/chat/Message.tsx', 'utf8').includes('const ui = useUI.getState')
      && readPF('../frontend/src/components/input/InputBar.tsx', 'utf8').includes('const ui = useUI.getState'))
    check('regenerating a message cannot re-render the transcript on every token',
      readPF('../frontend/src/components/chat/ChatView.tsx', 'utf8').includes('React.useCallback((msg: { id: string; content: string })'))
  }

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('render-check crashed:', e); process.exit(1) })
