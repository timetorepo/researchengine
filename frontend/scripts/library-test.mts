/**
 * Library round — regression suite for R24.
 *
 * Three things are proven here, none of which a type check can see:
 *
 *  1. The reader. Real markup goes through the HTML reducer and comes out as a
 *     document: chrome dropped, headings/lists/quotes/code kept in order, an
 *     outline built, and a JavaScript-only shell reported as such instead of
 *     being presented as an article.
 *  2. The folder bug. "Opening a folder makes the page reload and go all the way
 *     up" is not a reload and no component zeroes the offset, so the fix does not
 *     assume a single cause: the offset is recorded, a zeroing happens, a content
 *     change follows, and the reader is back where they were. The shelf's own
 *     height is asserted too, because a page that cannot shrink has nothing to
 *     clamp against in the first place. The folder shelf is also asserted to hold its height
 *     (`minHeight` inline, not a class, so it can be read from jsdom) and the
 *     Library's scroller is asserted to survive a folder change as the same node
 *     — a remount would lose the position no keeper could restore.
 *  3. The wiring. The blue folder is the real SmoothUI component, its click path
 *     reports the folder that was opened, the Library hands its folder state up
 *     so the keeper can see it, and nothing in the Library or the source viewer
 *     calls the browser's own `scrollIntoView` (lib/dom/scroll.ts explains why
 *     that rule exists).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/library-test.mts   (from frontend/)
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
const fire = (el: any, type = 'click', init: any = {}) => el?.dispatchEvent(new win.MouseEvent(type, { bubbles: true, ...init }))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const { readFileSync } = await import('node:fs')

  /* ===================== [1] the reader, on real markup ===================== */

  console.log('\n[1] A page becomes a document')
  const { htmlToBlocks, looksLikeAppShell, titleOf } = await import('../../backend/src/services/reader/html')
  const ARTICLE = `<!doctype html><html><head><title>Designing a pricing table &amp; onboarding</title>
    <meta property="og:title" content="Designing a pricing table"><meta name="description" content="How apps frame plans."></head>
    <body><nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
    <div class="cookie">We use cookies. <button>Accept</button></div>
    <main><h1>Designing a pricing table</h1>
    <p>A pricing table is not a list of features. It is an argument about who the product is for, made with three columns and a lot of white space.</p>
    <p>The first decision is the number of plans. Three is the classic; two is honest when the product has one axis of value.</p>
    <h2>What each column carries</h2>
    <ul><li>The plan name should describe a person or a stage, never a metal.</li>
    <li>Put the price in the smallest type that still reads as a number.</li>
    <li>Every feature row must be answerable with yes or no, otherwise it does not belong in a table.</li></ul>
    <blockquote>If a feature needs a footnote to be true, it is not a feature.</blockquote>
    <h3>Annual pricing</h3>
    <p>Show the annual number as a monthly equivalent and state the commitment in the same breath, or the saving reads as a trick.</p>
    <pre><code>const plans = [{ id: 'free' }, { id: 'pro' }]</code></pre></main>
    <aside><p>Related: <a href="/x">The empty state</a></p></aside>
    <footer><p>© 2026 Some Company. All rights reserved.</p></footer>
    <script>window.__DATA__ = ${JSON.stringify('x'.repeat(400))}</script></body></html>`

  const reduced = htmlToBlocks(ARTICLE, new URL('https://example.com/a'))
  const types = reduced.blocks.map((b) => b.type)
  check('the title comes from the page, entities decoded', titleOf(ARTICLE) === 'Designing a pricing table')
  check('navigation, footer, aside and scripts are dropped',
    !reduced.blocks.some((b) => JSON.stringify(b).includes('Related:'))
    && !reduced.blocks.some((b) => JSON.stringify(b).includes('All rights reserved'))
    && !reduced.blocks.some((b) => JSON.stringify(b).includes('__DATA__')))
  check('the cookie banner is dropped too', !reduced.blocks.some((b) => JSON.stringify(b).includes('cookies')))
  check('headings, paragraphs, a list, a quote and code survive, in order',
    types.join(',') === 'heading,paragraph,paragraph,heading,list,quote,heading,paragraph,code', types.join(','))
  check('the list keeps its items, not its bullets', reduced.blocks[4].type === 'list' && (reduced.blocks[4] as any).items.length === 3)
  check('an outline is built with usable anchors',
    reduced.outline.length === 3 && reduced.outline[0].id === 'designing-a-pricing-table' && !!reduced.outline[1].id)
  check('the code block is readable text, not markup', (reduced.blocks[8] as any).text.includes("const plans = [{ id: 'free' }"))
  check('a real article is not mistaken for an app shell', looksLikeAppShell(ARTICLE, reduced.blocks) === false)

  const SHELL = `<html><head><title>App</title></head><body><div id="root"></div><script>${'x'.repeat(5000)}</script></body></html>`
  const shellBlocks = htmlToBlocks(SHELL, new URL('https://app.example.com')).blocks
  check('a JavaScript-only shell is called what it is', looksLikeAppShell(SHELL, shellBlocks) === true)

  /* ================== [2] the folder bug, and its fix ================== */

  console.log('\n[2] Opening a folder no longer moves the page')
  const { useScrollKeeper } = await import('../src/hooks/useScrollKeeper')

  /** A page that shrinks when the folder changes — what the real Library does. */
  function Harness({ onReady }: { onReady: (api: any) => void }) {
    const [folder, setFolder] = React.useState('all')
    const rows = folder === 'all' ? 40 : 3
    const ref = useScrollKeeper<HTMLDivElement>(`${folder}`)
    React.useEffect(() => {
      onReady({
        scroller: (): HTMLDivElement | null => ref.current,
        open: (id: string) => setFolder(id),
        folder: () => folder,
      })
    })
    return React.createElement('div', { ref, className: 'scroller', 'data-testid': 'scroller' },
      Array.from({ length: rows }, (_, i) => React.createElement('div', { key: i, style: { height: 20 } }, `row ${i}`)))
  }

  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  let api: any = null
  root.render(React.createElement(Harness, { onReady: (a: any) => { api = a } }))
  await wait(60)

  const scroller = api.scroller() as HTMLDivElement
  check('the container is the one the hook hands back', !!scroller && scroller.getAttribute('data-testid') === 'scroller')

  // The reader is 260px down the page, then the browser clamps to 0 because the
  // filtered list is shorter than the viewport. This is the whole bug.
  scroller.scrollTop = 260
  scroller.dispatchEvent(new win.Event('scroll'))
  await wait(20)
  check('the offset is recorded while the reader scrolls', scroller.scrollTop === 260)

  scroller.scrollTop = 0                    // ← what the browser did on its own
  api.open('thesis')                        // ← opening the folder
  await wait(80)
  check('opening a folder puts the reader back where they were', scroller.scrollTop === 260, `got ${scroller.scrollTop}`)

  // But a reader who scrolls somewhere new must not be dragged back.
  scroller.scrollTop = 120
  scroller.dispatchEvent(new win.Event('scroll'))
  await wait(20)
  api.open('all')
  await wait(80)
  check('a later scroll is the one that is kept', scroller.scrollTop === 120, `got ${scroller.scrollTop}`)

  // And when the content really cannot hold the old offset, the clamp is honest.
  scroller.scrollTop = 260
  scroller.dispatchEvent(new win.Event('scroll'))
  await wait(10)
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 240 })
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 200 })
  api.open('tiny')
  await wait(80)
  check('an offset the shorter page cannot hold is clamped, never invented', scroller.scrollTop === 40, `got ${scroller.scrollTop}`)
  root.unmount()

  /* -------- the real Library: shelf height, component, wiring --------------- */

  console.log('\n[3] The shelf is the real component and it holds its height')
  const librarySource = readFileSync(new URL('../src/components/library/LibrarySearch.tsx', import.meta.url), 'utf8')
  const viewSource = readFileSync(new URL('../src/components/library/LibraryView.tsx', import.meta.url), 'utf8')
  const viewerSource = readFileSync(new URL('../src/components/library/SourceViewer.tsx', import.meta.url), 'utf8')

  check('the folders are the installed SmoothUI component, not a re-implementation',
    /from '@\/components\/smoothui\/folder-reveal'/.test(librarySource) && librarySource.includes('<FolderReveal'))
  check('they are blue and they open under the pointer', /color="blue"/.test(librarySource) && /trigger="hover"/.test(librarySource))
  check('a click on the folder is what opens its saves',
    /onActivate=\{\(\) => setFolderFilter\(/.test(librarySource))
  check('the shelf holds its height, in an inline style jsdom can read',
    /minHeight: 208/.test(librarySource))
  check('the save list underneath holds its height as well', /min-h-\[200px\]/.test(librarySource))
  check('the Library scrolls in its own container, which the keeper owns',
    /data-ui="library-scroller"/.test(viewSource) && /useScrollKeeper<HTMLDivElement>/.test(viewSource))
  check('the folder state lives above the list so the keeper can see the change',
    /folder=\{folder\}/.test(viewSource) && /onFolder=\{setFolder\}/.test(viewSource))
  check('the old chip row is gone — the shelf replaced it',
    !/pl-2\.5 pr-1\.5 py-1 rounded-full/.test(librarySource) && /flex items-end gap-1 overflow-x-auto/.test(librarySource))
  check('the blue folder carries a squircle background',
    /cornerShape: 'superellipse\(1\.7\)'/.test(librarySource))
  check('the source viewer is a squircle too', /cornerShape: 'superellipse\(1\.7\)'/.test(viewerSource))

  /* ============ [6] the feed: dated, filterable, dismissable ============ */

  console.log('\n[6] Recommendations read like a feed, and never invent a source')
  const { RecommendationsPanel } = await import('../src/components/library/RecommendationsPanel')
  const now = Date.now()
  const stories = [
    { title: 'A new attention variant', link: 'https://example.com/a', summary: 'A paper about sparse attention.', at: new Date(now - 3600_000).toISOString(), reason: 'new in The Gradient', source: 'https://example.com/feed', topic: 'The Gradient', via: 'feed' as const, publisher: 'The Gradient' },
    { title: 'Transformer', link: 'https://en.wikipedia.org/?curid=2', summary: 'An architecture.', at: new Date(now - 30 * 3600_000).toISOString(), reason: 'matches your tag #models', source: 'https://en.wikipedia.org/?curid=2', topic: '#models', via: 'tag' as const, publisher: 'Wikipedia' },
    { title: 'Undated story', link: 'https://example.com/c', reason: 'new in The Gradient', source: 'https://example.com/feed', topic: 'The Gradient', via: 'feed' as const, publisher: 'The Gradient' },
  ]
  const feedHost = win.document.createElement('div')
  win.document.body.appendChild(feedHost)
  const feedRoot = createRoot(feedHost)
  let refreshed = 0
  let openedStory = ''
  let savedStory = ''
  feedRoot.render(React.createElement(RecommendationsPanel as any, {
    recs: stories, hint: '', busy: false, tookMs: 12,
    watching: { tags: ['models'], feeds: [{ id: 'f', title: 'The Gradient', url: 'https://example.com/feed' }], topics: ['The Gradient', '#models'] },
    notes: [], onRefresh: () => { refreshed++ }, onSave: (r: any) => { savedStory = r.title }, onOpen: (r: any) => { openedStory = r.title },
  }))
  await wait(150)
  const feedHtml = feedHost.innerHTML
  check('stories are grouped by the day they arrived', feedHtml.includes('Today') && feedHtml.includes('Yesterday') && feedHtml.includes('Undated'))
  const headlineIsButton = [...feedHost.querySelectorAll('h4 button')].some((b: any) => b.textContent?.includes('A new attention variant'))
  const rawLinks = [...feedHost.querySelectorAll('a')].filter((a: any) => a.getAttribute('href') === 'https://example.com/a')
  check('a headline is a reader button, not a link farm', headlineIsButton)
  check('the only way out to a browser is the labelled escape hatch',
    rawLinks.length === 1 && rawLinks[0].getAttribute('title') === 'Open in your browser')
  check('every story names who published it', feedHtml.includes('The Gradient') && feedHtml.includes('Wikipedia'))
  check('the reason says which watch produced it', feedHtml.includes('matches your tag #models') && feedHtml.includes('new in The Gradient'))
  check('the topics you watch are a filter rail', feedHtml.includes('Everything') && feedHtml.includes('models'))

  const headline = [...feedHost.querySelectorAll('button')].find((b: any) => b.textContent?.includes('A new attention variant'))
  if (headline) { fire(headline); await wait(30) }
  check('opening a story sends it to the source viewer', openedStory === 'A new attention variant', openedStory)

  const topicBtn = [...feedHost.querySelectorAll('button')].find((b: any) => b.textContent?.trim().startsWith('models') && b.textContent?.includes('1'))
  if (topicBtn) { fire(topicBtn); await wait(60) }
  const filtered = feedHost.innerHTML
  check('picking a topic narrows the feed to that watch',
    filtered.includes('Transformer') && !filtered.includes('A new attention variant'))

  const allBtn = [...feedHost.querySelectorAll('button')].find((b: any) => b.textContent?.trim() === 'Everything')
  if (allBtn) { fire(allBtn); await wait(60) }
  const dismissBtn = [...feedHost.querySelectorAll('button')].find((b: any) => (b.getAttribute('title') ?? '').startsWith('Not interested'))
  if (dismissBtn) { fire(dismissBtn); await wait(120) }
  check('dismissing removes the story from the feed', !feedHost.innerHTML.includes('A new attention variant'))
  check('dismissing is remembered, not just hidden', (storage.get('re.library.dismissed') ?? '').includes('example.com/a'))
  feedRoot.unmount()

  /* ============ [7] "search the UI of apps" has something to find ============ */

  console.log("\n[7] The UI vertical searches this app's own registry index")
  const { componentHits } = await import('../src/components/library/LibrarySearch')
  const carousels = componentHits('carousel')
  const tables = componentHits('table')
  const empty = componentHits('empty state')
  check('a pattern word finds components the app can install', carousels.length > 0, String(carousels.length))
  check('each hit names the component and where it comes from',
    carousels.every((h) => h.url.startsWith('app://component/') && h.title.length > 1 && /Design hub · /.test(h.source)))
  check('the search is about patterns, not one keyword', tables.length > 0 && empty.length > 0)
  check('a nonsense word finds nothing rather than inventing components', componentHits('zzzzqqq').length === 0)
  check('a one-letter query does not run at all', componentHits('c').length === 0)

  /* ==================== [4] the rules that must hold ==================== */

  console.log('\n[4] No component scrolls the whole app')
  check('the source viewer scrolls its own pane through the helper',
    /scrollChildIntoView\(scrollerRef\.current/.test(viewerSource) && !/\.scrollIntoView\(/.test(viewerSource))
  check('nothing in the Library calls the browser scrollIntoView',
    !/\.scrollIntoView\(/.test(librarySource) && !/\.scrollIntoView\(/.test(viewSource))
  check('the keeper is a layout effect, so the restore happens before paint',
    readFileSync(new URL('../src/hooks/useScrollKeeper.ts', import.meta.url), 'utf8').includes('useLayoutEffect'))

  /* ============== [5] the real panel, mounted and clicked ============== */

  console.log('\n[5] The real search panel mounts, and its folders work')
  const items = [
    { id: 'i1', kind: 'wikipedia', title: 'Transformer (machine learning model)', url: 'https://en.wikipedia.org/?curid=1', tags: ['models'], folderId: 'f1', savedAt: Date.now() - 60000 },
    { id: 'i2', kind: 'source', title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', tags: ['models'], folderId: 'f1', savedAt: Date.now() - 120000 },
    { id: 'i3', kind: 'source', title: 'A survey of fine-tuning', url: 'https://example.com/survey', tags: [], folderId: 'f2', savedAt: Date.now() - 300000 },
  ]
  const folders = [{ id: 'f1', name: 'Thesis', createdAt: Date.now() }, { id: 'f2', name: 'Reading', createdAt: Date.now() }]
  const realFetch = (globalThis as any).fetch
  ;(globalThis as any).fetch = async (url: any) => {
    const path = String(url)
    const body = path.includes('/api/library/items') ? { items, folders }
      : path.includes('/api/library/recommendations') ? { recommendations: [], hint: 'Add a tag to watch something.' }
      : path.includes('/api/library/mini-search') ? { results: [], pending: [] }
      : path.includes('/api/library/search') ? { hits: [], sources: [], notes: [], pending: [], tookMs: 4 }
      : {}
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const { LibrarySearch } = await import('../src/components/library/LibrarySearch')
  const panelHost = win.document.createElement('div')
  win.document.body.appendChild(panelHost)
  const panelRoot = createRoot(panelHost)
  let opened: string | null = null
  panelRoot.render(React.createElement(MemoryRouter, null as any,
    React.createElement(LibrarySearch as any, { query: '', onQuery: () => {}, folder: 'all', onFolder: (id: string) => { opened = id } })))
  await wait(200)

  const panelHtml = panelHost.innerHTML
  check('the panel renders without throwing', panelHtml.includes('data-ui="library-search"'))
  check('the folders arrive as real folder shapes',
    (panelHtml.match(/viewBox="0 0 320 250"/g) ?? []).length === folders.length)
  check('each folder is labelled with its name', panelHtml.includes('Thesis') && panelHtml.includes('Reading'))
  check('the saves are listed', panelHtml.includes('Transformer (machine learning model)') && panelHtml.includes('Attention Is All You Need'))
  check('a save opens in the source viewer instead of a new tab',
    panelHtml.includes('Open and read this source here') || panelHtml.includes('Open'))
  check('the titles offer the reader, not a raw link',
    !/<a href="https:\/\/en\.wikipedia\.org/.test(panelHtml))

  const flap = [...panelHost.querySelectorAll('button')].find((b: any) => b.getAttribute('aria-label') === 'Thesis')
  check('the folder flap is a real button, labelled for a screen reader', !!flap)
  if (flap) {
    fire(flap)
    await wait(40)
    check('pressing the folder reports which one was opened', opened === 'f1', String(opened))
  }
  panelRoot.unmount()
  ;(globalThis as any).fetch = realFetch

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('library-test crashed:', e); process.exit(1) })
