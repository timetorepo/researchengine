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

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const { CodingView } = await import('../src/components/ide/CodingView')
  const { Message } = await import('../src/components/chat/Message')
  const { useStore } = await import('../src/stores/useStore')
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

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('render-check crashed:', e); process.exit(1) })
