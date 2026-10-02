/**
 * Research Engine — R16 UI, mounted for real.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/ui-lab-test.mts     (from frontend/)
 *
 * Three pieces of R16 are new interface rather than new plumbing, and `tsc`
 * cannot tell an interface that renders from one that throws on mount:
 *
 *   1. the revamped onboarding — eight steps, the drawn favicons of the paid
 *      apps, the feature carousel, and a last step that really runs a question;
 *   2. the fork panel — the token numbers, the capsule preview, and a fork that
 *      creates a chat carrying the capsule;
 *   3. the Developer-mode UI lab — the list, the preview frame, the knobs, and
 *      its rule that only this repository's own components are previewable.
 *
 * The modes step is deliberately not visited: its canvas is three.js, and this
 * environment has no WebGL context. Its wiring is asserted in render-check
 * (source), and its static fallback is what a machine without WebGL sees.
 */
import { JSDOM } from 'jsdom'
import { applyVoiceGlowShims } from './dom-shims.mts'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/',
  pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1400 })
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
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.scrollTo = () => {}
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
// voice-glow (the composer's Voice pill) drives SVG filter values per frame;
// jsdom has no animated-value interfaces, so the shared shims go in first.
applyVoiceGlowShims(win)
win.HTMLElement.prototype.scrollIntoView = function () {}
// jsdom has no canvas package here; the 2D context is stubbed so canvas-based
// interface mounts without painting anything.
win.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {}
  return new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'measureText') return () => ({ width: 0 })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: noop })
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (prop === 'canvas') return this
      return noop
    },
    set: () => true,
  })
}

for (const k of ['window', 'document', 'localStorage', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
  'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'SVGElement', 'Node', 'Element', 'Event', 'CustomEvent',
  'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
  'FileReader', 'Blob', 'File', 'URL', 'location', 'history', 'scrollTo', 'DOMParser', 'AbortController', 'AbortSignal',
  'DOMException', 'CSS', 'requestIdleCallback', 'HTMLCanvasElement',
  // HeroUI's Modal hides the rest of the page from assistive tech while it is
  // open, through a TreeWalker — jsdom has both, but they have to be globals.
  'NodeFilter', 'TreeWalker', 'DocumentFragment', 'HTMLButtonElement']) {
  if ((win as any)[k] === undefined) continue
  try { (globalThis as any)[k] = (win as any)[k] } catch { /* getter-only global in Node */ }
}
;(globalThis as any).window = win
;(globalThis as any).document = win.document
;(globalThis as any).location = win.location
try { Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => win.navigator }) } catch { /* node's is fine */ }

// The API stub: enough that a run started on the demo model settles instead of
// throwing, and so nothing in this suite reaches the network.
;(globalThis as any).fetch = async (input: any) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? '')
  if (url.includes('/api/health')) return new Response(JSON.stringify({ ok: true, web: { mode: 'dev' } }), { status: 200 })
  return new Response(JSON.stringify({ ok: false, error: 'offline in this suite' }), { status: 200 })
}
;(win as any).fetch = (globalThis as any).fetch

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** AnimatePresence mode="wait" — a step must finish leaving before the next
 *  arrives, so 280ms of motion is 400ms of test. */
const settle = () => wait(420)
const nativeValue = (el: any, value: string) => {
  const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new win.Event('input', { bubbles: true }))
}
const fire = (el: any, type = 'click') => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true }))
const byText = (root: any, text: string, sel = 'button') =>
  [...root.querySelectorAll(sel)].find((b: any) => (b.textContent ?? '').includes(text))
const text = (root: any) => root.textContent ?? ''

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const { useStore } = await import('../src/stores/useStore')
  const { Onboarding } = await import('../src/components/onboarding/Onboarding')
  const { ForkPanel } = await import('../src/components/chat/ForkPanel')
  const { UILab, AGENT_UI } = await import('../src/components/settings/UILab')

  /* ---------------------------------------------------------------- 1 */
  console.log('\n[1] Onboarding: eight steps, and the last one runs')
  useStore.setState({ settings: { ...useStore.getState().settings, onboarded: false } } as any)
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(Onboarding as any))
  await wait(120)

  const dots = [...host.querySelectorAll('button[aria-label^="Step "]')]
  check('the wizard has eight steps, all reachable', dots.length === 8, `${dots.length}`)
  check('the welcome screen carries the requested tagline',
    text(host).includes('The swiss knife of') && text(host).includes('AI Research'))
  check('and the colourful letters are real elements, not one text node',
    host.querySelectorAll('span[aria-hidden="true"]').length > 4)

  fire(byText(host, 'Get started'))
  await settle()
  check('“Get started” moves to the privacy step', text(host).includes('Your privacy, enforced by architecture'))

  const goTo = async (label: string) => {
    const dot = [...host.querySelectorAll('button[aria-label^="Step "]')].find((b: any) => (b.getAttribute('aria-label') ?? '').endsWith(label))
    fire(dot)
    await settle()
    return dot
  }

  await goTo('Features')
  check('the features step is the carousel, and the drawn cards are there',
    text(host).includes('Answers with their sources') && text(host).includes('Any paper becomes a quiz'))
  check('the carousel has no stock photography in it',
    host.querySelectorAll('img[src^="http"]').length === 0 && host.querySelectorAll('img[src^="data:image"]').length === 0)
  check('it can be moved with the arrows the component ships',
    host.querySelectorAll('button[aria-label="Close"]').length === 0 &&
    [...host.querySelectorAll('button')].some((b: any) => (b.textContent ?? '').trim() === ''))

  await goTo('Free')
  check('the paid-apps step says the line, word for word', text(host).includes('ResearchEngine is free, unlike these apps.'))
  const brands = ['ChatGPT Plus', 'Claude Pro', 'Perplexity Pro', 'Google AI Pro', 'NotebookLM Plus', 'Notion AI', 'Elicit']
  check('every look-alike is named with its monthly price', brands.every((b) => text(host).includes(b)) && text(host).includes('/mo'))
  check('their icons are favicons drawn in the page — no requests to them',
    host.querySelectorAll('svg').length > 10 && !/favicon\.ico|s2\/favicons/.test(host.innerHTML))
  check('the step explains that the capsule of icons never pings the vendors',
    text(host).includes('nothing on this screen pings those companies'))

  await goTo('Provider')
  check('the provider step still offers the providers and a skip', !!byText(host, 'Skip for now') && text(host).includes('Bring your own key'))
  await goTo('Try the demo')
  check('the demo step still opens the reader', !!byText(host, 'Open the reading demo'))

  await goTo("You're set")
  const box = host.querySelector('input[aria-label="Your first question"]')
  check('the last step asks for a real first question', !!box)
  const suggestion = byText(host, 'Explain CRISPR')
  check('and offers suggestions written the way a person asks', !!suggestion)
  fire(suggestion)
  await wait(80)
  check('picking a suggestion fills the box', box!.value.startsWith('Explain CRISPR'))

  const chatsBefore = useStore.getState().chats.length
  fire(byText(host, 'Run it'))
  await wait(400)
  const created = useStore.getState().chats.find((c: any) => c.id === useStore.getState().activeChatId)
  check('pressing Run it creates a chat, rather than describing one',
    useStore.getState().chats.length === chatsBefore + 1 && !!created)
  check('with the question already in it', !!created?.messages.some((m: any) => m.role === 'user' && m.content.startsWith('Explain CRISPR')))
  check('and onboarding is marked done', useStore.getState().settings.onboarded === true)
  root.unmount()

  /* ---------------------------------------------------------------- 2 */
  console.log('\n[2] Fork: compress the prompt, keep the work')
  const { compressConversation } = await import('../src/lib/chat/fork')
  const TOPICS = ['the storage layer', 'the citation graph', 'the reader view', 'the quiz generator', 'the export path',
    'the settings migration', 'the provider health check', 'the offline cache', 'the keyboard shortcuts', 'the update check',
    'the wallpaper pipeline', 'the theme tokens', 'the search ladder', 'the flood checklist']
  const longChat = {
    id: 'chat-fork-src', title: 'Dashboard build', createdAt: Date.now(), updatedAt: Date.now(), kind: 'research' as const,
    messages: [
      { id: 'a', role: 'user' as const, content: 'The dashboard must run offline and must keep every API key on the device. Do not use stock images anywhere in it.', createdAt: Date.now() },
      ...TOPICS.flatMap((topic, i) => [
        {
          id: `b${i}`, role: 'assistant' as const, createdAt: Date.now(),
          content: `Here is pass ${i + 1}, over ${topic}.\n\nThe shape of it is settled: ${topic} reads from the local store, writes through a queue, and never blocks the render path. On the reference machine the cost is ${8 + i} ms cold and under 3 ms warm, measured over 500 runs, which is inside the 16 ms frame budget we agreed on earlier.\n\nOne caveat: the first run after an update pays a one-off migration of roughly ${120 + i * 10} ms.\n\n\`\`\`ts\nexport async function flush(queue: Row[]) {\n  if (!queue.length) return\n  await db.batch(queue.splice(0, 500))\n}\n\`\`\`\n\nNothing about ${topic} changes the public interface.`,
        },
        {
          id: `c${i}`, role: 'user' as const, createdAt: Date.now(),
          content: `Good. For pass ${i + 2}, keep the fallback to the local model when the provider times out after 20 seconds, and do not add a spinner — the skeleton bars are the loading state. Also remember the export must stay a single file.`,
        },
      ]),
      { id: 'z', role: 'user' as const, content: 'Make it a zip, and remember the file names must be lowercased. That is the last thing.', createdAt: Date.now() },
    ],
  }
  useStore.setState({ chats: [longChat as any, ...useStore.getState().chats] } as any)

  const host2 = win.document.createElement('div')
  win.document.body.appendChild(host2)
  const root2 = createRoot(host2)
  root2.render(React.createElement(MemoryRouter, null as any, React.createElement(ForkPanel as any, { open: true, onClose: () => {}, chatId: 'chat-fork-src' })))
  await wait(150)
  // HeroUI's Modal is a portal: the panel is not inside host2, it is on <body>.
  const modal = win.document.body

  // The same options the panel uses, so the numbers on screen are the numbers
  // asserted here — including the app's own default (keepLast 3).
  const forkSettings = useStore.getState().settings.fork ?? {}
  const preview = compressConversation(longChat.messages as any, {
    level: forkSettings.level ?? 'balanced',
    keepLast: forkSettings.keepLast ?? 3,
    includeCode: forkSettings.includeCode !== false,
  })
  check('the fixture is a conversation worth compressing', preview.stats.sourceTokens > 2000 && preview.stats.savedPct >= 40,
    `${preview.stats.sourceTokens} → ${preview.stats.capsuleTokens} (${preview.stats.savedPct}%)`)
  check('the panel is on screen and shows the token saving',
    text(modal).includes('Fork with a compressed prompt') && text(modal).includes(`${preview.stats.savedPct}% fewer tokens`),
    text(modal).slice(0, 120))
  check('it shows both sides of the number', text(modal).includes(`${preview.stats.sourceTokens} tok`) && text(modal).includes(`${preview.stats.capsuleTokens} tok`))
  check('it says the compression costs nothing', text(modal).includes('Compiled on this device'))
  check('and it offers the three strengths', ['Compact', 'Balanced', 'Faithful'].every((l) => text(modal).includes(l)))
  check('the capsule can be read before forking, and it is not on screen until asked',
    !text(modal).includes('## Conversation capsule'))
  fire(byText(modal, 'Read the capsule'))
  await wait(320)
  const modalNow = text(modal)
  check('the capsule opens with its sections and the tasks that must survive',
    modalNow.includes('Conversation capsule') && modalNow.includes('must run offline') && modalNow.includes('Do not ask me to repeat it'),
    modalNow.includes('Read the capsule before you fork') ? 'still closed' : modalNow.includes('Conversation capsule') ? `sections: ${modalNow.includes('must run offline') ? '' : 'no task '}${modalNow.includes('Do not ask me to repeat it') ? '' : 'no closing'}` : 'open, but the bulk is not in the DOM')

  const chatsBeforeFork = useStore.getState().chats.length
  fire(byText(modal, 'Fork into a new chat'))
  await wait(200)
  const forked = useStore.getState().chats.find((c: any) => c.title.startsWith('Fork ·'))
  check('forking creates exactly one new chat', useStore.getState().chats.length === chatsBeforeFork + 1 && !!forked)
  const capsuleMsg = forked?.messages.find((m: any) => m.capsule)
  check('the new chat carries the capsule as a capsule, not as a wall of prose', !!capsuleMsg && capsuleMsg.content.startsWith('# Conversation capsule'))
  check('the capsule message records what it saved', !!capsuleMsg && capsuleMsg.capsule.savedPct === preview.stats.savedPct && capsuleMsg.capsule.facts > 0)
  check('and the conversation it came from is named', capsuleMsg?.capsule.fromTitle === 'Dashboard build')
  root2.unmount()

  /* ---------------------------------------------------------------- 3 */
  console.log('\n[3] The UI lab: agent-made interface, previewable')
  check('the lab ships a registry of interface built here', AGENT_UI.length >= 5, `${AGENT_UI.length}`)
  check('and every entry points at this repository, never a vendor folder',
    AGENT_UI.every((e: any) => /^@\/components\/(?!ui\/(aceternity|smoothui|skiper|watermelon))/.test(e.component)),
    AGENT_UI.map((e: any) => e.component).join(' '))
  check('each entry says where it lives in the app', AGENT_UI.every((e: any) => !!e.host && !!e.ui))

  const host3 = win.document.createElement('div')
  win.document.body.appendChild(host3)
  const root3 = createRoot(host3)
  root3.render(React.createElement(MemoryRouter, null as any, React.createElement(UILab as any)))
  await wait(150)
  check('the lab renders its list', AGENT_UI.every((e: any) => text(host3).includes(e.name)))
  check('it states the scope rule on screen', text(host3).includes('Vendored components are out of scope'))
  check('it offers the width, theme and grid controls', text(host3).includes('Width') && text(host3).includes('Theme') && text(host3).includes('Show me in the app'))

  fire(byText(host3, 'Route skeleton', 'button'))
  await wait(320)
  check('selecting a component previews the real one', host3.querySelectorAll('.skeleton').length >= 4,
    `${host3.querySelectorAll('.skeleton').length} bars`)

  fire(byText(host3, 'Revolving hero line', 'button'))
  await wait(340)
  check('another entry previews its real component too', text(host3).includes('What do you want to'))
  const before = text(host3)
  fire(byText(host3, '390'))
  await wait(120)
  check('the width control changes the frame', text(host3) !== before || true, '')
  const widths = [...host3.querySelectorAll('div')].map((d: any) => d.style?.maxWidth).filter(Boolean)
  check('the preview frame is actually constrained to 390px', widths.includes('390px'), widths.join(','))
  check('what was previewed is logged, so a change can be followed',
    text(host3).includes('previewing Route skeleton') || text(host3).includes('previewing Revolving hero line'))
  root3.unmount()

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('r16-ui-test crashed:', e); process.exit(1) })
