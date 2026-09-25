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
  check('pointing at an icon gives it a name', (sd.textContent ?? '').includes('Read & Quiz') || !!sd.querySelector('.re-dock-label'), sd.textContent?.slice(0, 80))
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

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('render-check crashed:', e); process.exit(1) })
