/**
 * R28 regression coverage for the Library reader, Design Saves, Coding MCP,
 * dependency inspection, language marks, and local screenshot/video references.
 *
 * Run from frontend/ with: npm run r28-test
 * Network calls are mocked; adding a marketplace listing must not start a process.
 */
import { JSDOM } from 'jsdom'
import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let passed = 0
let failed = 0
const failures: string[] = []
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; failures.push(name); console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms))

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/#/code', pretendToBeVisual: true })
const win: any = dom.window
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
win.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 600, width: 900, height: 600, toJSON() { return {} } })
Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (globalThis as any).__clipboard = text } } })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'SVGElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'localStorage', 'sessionStorage', 'DOMParser', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  try { Object.defineProperty(globalThis, key, { configurable: true, value: win[key] }) } catch { /* use the runtime value */ }
}

async function main() {
  /* ---------------------------- Wikipedia + feeds ------------------------- */
  console.log('\n[1] Library results keep their Wikipedia page id; feeds become article text')
  const wiki = await import('../../backend/src/services/reader/wikipedia')
  const target = wiki.wikipediaPageTarget(new URL('https://en.wikipedia.org/?curid=736'))
  check('curid is read as a page id, not the slash title', target?.parameter === 'pageids' && target.value === '736')
  check('canonical Wikipedia links keep the searched article and page id',
    wiki.wikipediaPageUrl('JavaScript', 736) === 'https://en.wikipedia.org/wiki/JavaScript?curid=736')
  check('a normal /wiki/ title still resolves when no curid is present',
    wiki.wikipediaPageTarget(new URL('https://en.wikipedia.org/wiki/JavaScript'))?.value === 'JavaScript')

  const feedModule = await import('../../backend/src/services/reader/feed')
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Field Notes</title>
    <item><title>Design &amp; systems</title><link>https://news.example.test/story/one</link>
    <pubDate>Tue, 06 Oct 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>A readable summary with enough detail for a person to understand the story.</p><script>bad()</script>]]></description></item>
    </channel></rss>`
  const parsedRss = feedModule.parseFeedXml(rss, 'https://news.example.test/feed.xml')
  const rssBlocks = parsedRss ? feedModule.feedToBlocks(parsedRss) : null
  check('RSS titles and article summaries are extracted as plain text',
    parsedRss?.title === 'Field Notes' && parsedRss.articles[0]?.title === 'Design & systems'
      && parsedRss.articles[0]?.summary?.includes('readable summary')
      && !parsedRss.articles[0]?.summary?.includes('<script>'))
  check('RSS entries become headings, readable paragraphs and a safe original link',
    rssBlocks?.outline[0]?.text === 'Design & systems'
      && rssBlocks.blocks.some((block) => block.type === 'link' && block.href === 'https://news.example.test/story/one')
      && rssBlocks.blocks.every((block) => block.type !== 'paragraph' || !block.text.includes('<p>')))
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Journal</title><entry>
    <title>Second story</title><link rel="alternate" href="https://atom.example.test/2" />
    <summary type="html">&lt;p&gt;An Atom summary that is readable.&lt;/p&gt;</summary><updated>2026-10-04T10:00:00Z</updated>
    </entry></feed>`
  const parsedAtom = feedModule.parseFeedXml(atom, 'https://atom.example.test/feed')
  check('Atom alternate links and escaped HTML summaries are parsed', parsedAtom?.format === 'atom'
    && parsedAtom.articles[0]?.link === 'https://atom.example.test/2'
    && parsedAtom.articles[0]?.summary === 'An Atom summary that is readable.')
  check('non-feed XML is not misclassified', feedModule.parseFeedXml('<root><item>not a feed</item></root>', 'https://x.test/') === null)

  const oldFetch = globalThis.fetch
  let wikiApiUrl = ''
  ;(globalThis as any).fetch = async (input: any) => {
    const url = String(input)
    if (url.includes('w/api.php')) {
      wikiApiUrl = url
      return { ok: true, json: async () => ({ query: { pages: { '736': { pageid: 736, title: 'JavaScript', extract: 'JavaScript is a programming language.\n\n== History ==\nIt first appeared in 1995.' } } } }) }
    }
    return { ok: true, headers: { get: () => 'application/rss+xml; charset=utf-8' }, text: async () => rss }
  }
  const reader = await import('../../backend/src/services/reader/extract')
  const article = await reader.readSource('https://en.wikipedia.org/?curid=736&test=r28')
  check('the Wikipedia read API asks for pageids=736 and returns JavaScript',
    new URL(wikiApiUrl).searchParams.get('pageids') === '736'
      && !new URL(wikiApiUrl).searchParams.has('titles') && article.title === 'JavaScript')
  const feedDoc = await reader.readSource('https://news.example.test/feed.xml?test=r28')
  check('readSource returns a readable feed document rather than raw XML',
    feedDoc.via === 'feed' && feedDoc.title === 'Field Notes'
      && feedDoc.blocks.some((block) => block.type === 'heading' && block.text === 'Design & systems'))
  globalThis.fetch = oldFetch

  /* -------------------- language marks + video sampling ------------------- */
  console.log('\n[2] File marks and video references are local and deterministic')
  const fileIcons = await import('../src/lib/ide/fileIcons')
  const languageCases: [string, string][] = [
    ['src/index.html', 'html'], ['src/app.js', 'javascript'], ['src/app.css', 'css'],
    ['src/App.tsx', 'react'], ['src/solver.cpp', 'cpp'], ['src/types.ts', 'typescript'],
    ['src/main.py', 'python'], ['src/main.rs', 'rust'],
  ]
  check('common languages resolve to their bundled marks', languageCases.every(([path, language]) => fileIcons.languageForPath(path) === language))
  const { createRoot } = await import('react-dom/client')
  const React = await import('react')
  {
    const host = win.document.createElement('div'); win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(fileIcons.FileGlyph, { path: 'src/App.tsx', size: 11 }))
    await wait()
    check('the React mark is accessible and carries its language id',
      host.querySelector('svg[data-language="react"]')?.getAttribute('aria-label') === 'React file')
    root.unmount(); host.remove()
  }
  const { videoFrameTimes, extractVideoFrames } = await import('../src/lib/ide/videoFrames')
  const times = videoFrameTimes(70, 6)
  check('video keyframes are sampled evenly and capped', times.length === 6 && times[0] > 0 && times[times.length - 1] < 70
    && times.every((time, i) => !i || time > times[i - 1]))
  check('invalid or empty videos produce no sample points', videoFrameTimes(0).length === 0 && videoFrameTimes(Number.NaN).length === 0)
  check('video upload rejects a non-video before reading it', await extractVideoFrames({ name: 'notes.txt', type: 'text/plain', size: 4 } as File).then(() => false, () => true))
  {
    const originalCreateElement = win.document.createElement.bind(win.document)
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const listeners = new Map<string, Set<(event: any) => void>>()
    let draws = 0
    let revoked = false
    const video: any = {
      duration: 17, videoWidth: 640, videoHeight: 360, readyState: 1, _currentTime: 0,
      addEventListener(type: string, fn: (event: any) => void) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(fn) },
      removeEventListener(type: string, fn: (event: any) => void) { listeners.get(type)?.delete(fn) },
      dispatch(type: string) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type }) },
      load() { this.dispatch('loadedmetadata') }, pause() {}, removeAttribute() {},
      set currentTime(value: number) { this._currentTime = value; this.readyState = 2; this.dispatch('seeked') },
      get currentTime() { return this._currentTime },
    }
    const canvas: any = {
      width: 0, height: 0,
      getContext: () => ({ drawImage: () => { draws++ } }),
      toDataURL: (_type: string, _quality: number) => `data:image/jpeg;base64,${'x'.repeat(128)}${draws}`,
    }
    win.document.createElement = ((tag: string) => tag === 'video' ? video : tag === 'canvas' ? canvas : originalCreateElement(tag)) as typeof win.document.createElement
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:r28-local-video' })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => { revoked = true } })
    try {
      const frames = await extractVideoFrames({ name: 'reference.mp4', type: 'video/mp4', size: 100 } as File)
      check('video bytes stay in local frame extraction and become image attachments',
        frames.length === 5 && frames.every((frame) => frame.type === 'image' && frame.dataUrl.startsWith('data:image/jpeg;base64,'))
          && draws === frames.length && revoked)
    } finally {
      win.document.createElement = originalCreateElement
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
    }
  }
  const { attachmentTray } = await import('../src/lib/ide/bridge')
  attachmentTray.clear()
  const trayResult = attachmentTray.addMany(Array.from({ length: 10 }, (_, index) => ({ type: 'image' as const, name: `frame-${index}.jpg`, dataUrl: `data:image/jpeg;base64,${index}` })))
  check('the tray accepts at most eight image frames and reports the overflow', trayResult.added === 8 && trayResult.omitted === 2 && attachmentTray.get().length === 8)
  attachmentTray.clear()
  const vision = await import('../src/lib/providers/vision')
  check('Ollama vision models can receive frames but text-only models are identified',
    vision.modelSupportsVision('ollama', 'llava:latest') && !vision.modelSupportsVision('ollama', 'llama3.1'))

  /* --------------------- installed dependency report ---------------------- */
  console.log('\n[3] Dependency inspection reports actual local installs and safe copy lines')
  const dependencyBackend = await import('../../backend/src/services/ide/dependencies')
  const dependencyFrontend = await import('../src/lib/ide/dependencies')
  const projectDir = await mkdtemp(join(tmpdir(), 're-r28-deps-'))
  try {
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ dependencies: { zod: '^4.0.0' }, devDependencies: { vitest: '^3.0.0' } }))
    await writeFile(join(projectDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    await mkdir(join(projectDir, 'node_modules', 'zod'), { recursive: true })
    await writeFile(join(projectDir, 'node_modules', 'zod', 'package.json'), JSON.stringify({ name: 'zod', version: '4.1.2' }))
    const report = await dependencyBackend.readProjectDependencies(projectDir)
    const zod = report.dependencies.find((dependency: any) => dependency.name === 'zod')
    const vitest = report.dependencies.find((dependency: any) => dependency.name === 'vitest')
    check('the backend detects pnpm and distinguishes installed from declared-only packages',
      report.manager === 'pnpm' && zod?.installed && zod.installedVersion === '4.1.2' && vitest?.installed === false)
  } finally { await rm(projectDir, { recursive: true, force: true }) }
  check('AI coding recommendations copy a package-manager-specific command without running it',
    dependencyFrontend.dependencyInstallCommand('pnpm', 'vitest', true) === 'pnpm add --save-dev vitest'
      && dependencyFrontend.dependencyInstallCommand('npm', 'zod') === 'npm install zod'
      && dependencyFrontend.dependencyInstallCommand('npm', 'zod; rm -rf /') === null)

  /* ----------------------------- Saves UI -------------------------------- */
  console.log('\n[4] Component previews can be saved and copied together')
  const design = await import('../src/stores/useDesign')
  const catalog = await import('../src/lib/design/catalog')
  const demos = await import('../src/lib/design/liveDemos')
  const providers = await import('../src/lib/design/providers')
  const candidate = demos.liveDemoKeys().map((key: string) => {
    const [provider, name] = key.split(':')
    return catalog.searchCatalog(name).find((item: any) => item.provider === provider && item.name === name)
  }).find((item: any) => item && providers.commandsFor(providers.uiProviderById(item.provider)!, item.name, 'npm').length > 0)
  design.useDesign.getState().clearBox()
  if (!candidate) throw new Error('No locally previewable catalog item has an install command.')
  {
    const { ComponentHub } = await import('../src/components/design/ComponentHub')
    const host = win.document.createElement('div'); win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(ComponentHub, { initialQuery: candidate.name }))
    await wait(80)
    const row = [...host.querySelectorAll('[data-catalog-item]')].find((node: any) => node.getAttribute('data-catalog-item') === candidate.id) as HTMLElement | undefined
    row?.querySelector('button[title="Preview it here"]')?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(160)
    check('the selected catalog component opens the live preview stage', !!host.querySelector('[data-ui="component-preview"]'))
    const save = row && [...row.querySelectorAll('button')].find((button: any) => button.textContent?.trim() === 'Save')
    save?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(50)
    check('Save persists the chosen component in the shared Design store', design.useDesign.getState().box.some((entry: any) => entry.item === candidate.name))
    const savesTab = [...host.querySelectorAll('[role="tab"]')].find((button: any) => button.textContent?.includes('Saves'))
    savesTab?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(50)
    check('the Saves view shows the complete install box and one copy-all action',
      !!host.querySelector('[data-component-saves]') && [...host.querySelectorAll('button')].some((button: any) => button.textContent?.includes('Copy all')))
    const copyAll = [...host.querySelectorAll('button')].find((button: any) => button.textContent?.includes('Copy all'))
    copyAll?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(30)
    check('Copy all writes a real package command block to the clipboard', String((globalThis as any).__clipboard ?? '').includes(candidate.name))
    root.unmount(); host.remove()
  }

  /* --------------------------- MCP marketplace --------------------------- */
  console.log('\n[5] MCP setup lives in Coding and adding a listing does not start it')
  const mcpStore = await import('../src/stores/useMcpStore')
  const { McpMarketplace } = await import('../src/components/ide/McpMarketplace')
  const { toolSpecs, mcpContextBlock } = await import('../src/lib/chat/tools')
  const mcpTools = await import('../../backend/src/routes/mcp')
  const serversStore = mcpStore.useMcpStore.getState()
  for (const server of serversStore.servers) mcpStore.useMcpStore.getState().removeServer(server.id)
  let mcpFetches = 0
  ;(globalThis as any).fetch = async () => { mcpFetches++; throw new Error('The add action must not connect.') }
  {
    const host = win.document.createElement('div'); win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(McpMarketplace, { project: 'r28-fixture' }))
    await wait(60)
    const listing = host.querySelector('[data-mcp-listing="filesystem"]')
    const add = listing && [...listing.querySelectorAll('button')].find((button: any) => button.textContent?.includes('Add to Coding'))
    add?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(50)
    const configured = mcpStore.useMcpStore.getState().servers.find((server: any) => server.catalogId === 'filesystem')
    check('one click stores a disabled project-scoped server without making a request',
      !!configured && configured.args.includes('{project}') && configured.enabled === false && configured.approved === false && mcpFetches === 0)
    check('MCP tools are project-only and stay out of assistant context until Connect succeeds',
      !toolSpecs({ chatId: 'r28', asstId: 'r28' } as any).some((tool: any) => tool.function.name === 'mcp_call')
        && toolSpecs({ chatId: 'r28', asstId: 'r28', project: 'r28-fixture' } as any).some((tool: any) => tool.function.name === 'mcp_call')
        && mcpContextBlock() === '' && !mcpContextBlock('r28-fixture').includes(configured?.id ?? 'missing'))
    ;(globalThis as any).fetch = async () => {
      mcpFetches++
      return { ok: true, json: async () => ({ servers: [{ ok: true, tools: [{ name: 'list_files' }] }] }) }
    }
    const connect = host.querySelector('[data-mcp-server] button[title="Start the server and list its tools"]') as HTMLButtonElement | null
    connect?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(60)
    const enabled = mcpStore.useMcpStore.getState().servers.find((server: any) => server.catalogId === 'filesystem')
    check('the explicit Connect action tests a server and enables its tools only after success',
      mcpFetches === 1 && enabled?.enabled === true && enabled.approved === true && mcpContextBlock('r28-fixture').includes(enabled?.id ?? 'missing'))
    root.unmount(); host.remove()
  }
  {
    const host = win.document.createElement('div'); win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(McpMarketplace))
    await wait(40)
    const connect = host.querySelector('[data-mcp-server] button[title="Open a project before connecting"]') as HTMLButtonElement | null
    check('the Coding-home Marketplace cannot connect until a project is open', !!connect && connect.disabled)
    root.unmount(); host.remove()
  }
  const mcpDataDir = await mkdtemp(join(tmpdir(), 're-r28-mcp-'))
  try {
    const projectsRoot = join(mcpDataDir, 'projects')
    const projectRoot = join(projectsRoot, 'demo')
    await mkdir(projectRoot, { recursive: true })
    const validatedRoot = await mcpTools.requireMcpProjectRoot(projectsRoot, 'demo')
    check('the backend resolves an existing project to its real directory before MCP setup', validatedRoot === projectRoot)
    check('the backend resolves {project} to one argument after validation',
      mcpTools.resolveMcpProjectArgs(['-y', 'server', '{project}'], validatedRoot)[2] === validatedRoot)
    await writeFile(join(projectsRoot, 'not-a-directory'), 'file')
    const rejectedRoot = async (name: string | undefined) => {
      try { await mcpTools.requireMcpProjectRoot(projectsRoot, name); return false } catch { return true }
    }
    check('missing and non-directory MCP project roots are rejected', await rejectedRoot(undefined) && await rejectedRoot('not-a-directory'))
    const outside = join(mcpDataDir, 'outside')
    await mkdir(outside)
    await symlink(outside, join(projectsRoot, 'outside-link'), 'dir')
    check('a symlink cannot make an MCP project escape the projects directory', await rejectedRoot('outside-link'))

    const { Hono } = await import('hono')
    const app = new Hono()
    app.route('/', mcpTools.mcpRoutes({ dataDir: mcpDataDir } as any))
    const sentinel = join(mcpDataDir, 'server-was-started')
    const server = { id: 'test', name: 'test', command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'started')`] }
    const post = (path: string, body: unknown) => app.request(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const missingProjectResponse = await post('/mcp/tools', { servers: [server] })
    const fileProjectResponse = await post('/mcp/tools', { servers: [server], project: 'not-a-directory' })
    const missingCallResponse = await post('/mcp/call', { server, name: 'noop' })
    let processStarted = true
    try { await access(sentinel) } catch { processStarted = false }
    check('both MCP endpoints reject missing or invalid projects before spawning any command',
      missingProjectResponse.status === 400 && fileProjectResponse.status === 400
        && missingCallResponse.status === 400 && !processStarted)
  } finally { await rm(mcpDataDir, { recursive: true, force: true }) }
  const settingsTabs = await import('../src/components/settings/settingsTabs')
  check('Settings no longer has an MCP tab', !settingsTabs.TABS.some((tab: any) => /mcp/i.test(tab.label)))
  for (const server of mcpStore.useMcpStore.getState().servers) mcpStore.useMcpStore.getState().removeServer(server.id)

  /* ----------------------- SourceViewer feed display ---------------------- */
  console.log('\n[6] The Library renders a parsed feed, not an XML wall')
  ;(globalThis as any).fetch = async () => ({ ok: true, status: 200, json: async () => feedDoc })
  {
    const { SourceViewer } = await import('../src/components/library/SourceViewer')
    const host = win.document.createElement('div'); win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(SourceViewer, { source: { url: feedDoc.url, title: feedDoc.title }, onClose: () => {} }))
    await wait(100)
    check('feed entries appear as article text with an original-story link',
      (host.textContent ?? '').includes('Feed article text')
        && (host.textContent ?? '').includes('Design & systems')
        && [...host.querySelectorAll('a')].some((link: any) => link.textContent?.includes('Read the original story')))
    root.unmount(); host.remove()
  }

  attachmentTray.clear()
  console.log(`\n${failed ? 'FAILURES' : 'ALL PASS'}: ${passed} passed, ${failed} failed`)
  if (failures.length) { console.log(failures.join('\n')); process.exitCode = 1 }
}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
