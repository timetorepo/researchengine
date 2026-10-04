/**
 * R27 — the round after "did you actually revamp it": six asks, one suite.
 *
 *   • the Library reader can no longer take the app down: the viewer
 *     normalizes every answer and a matrix of hostile responses (error body,
 *     empty body, missing fields, non-JSON) ends in a failure card, never a
 *     blank page;
 *   • the Browser tab has an answer for "refused to connect": a Direct /
 *     Proxied switch, hostile hosts start proxied, and the proxied view points
 *     at the new /api/proxy route;
 *   • the proxy rewrite itself: base/CSP/frame-busters dropped, subresources
 *     absolute, anchors looped back through the proxy — and the frontend and
 *     backend hostile lists are the same list;
 *   • the composer's three-lines button unfolds the modes sideways with a
 *     tooltip per pill, instead of opening a menu;
 *   • fullscreen is a real toggle driven by the Fullscreen API;
 *   • the integrations tutorial walks every service, and the component hub
 *     previews vendored components live.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/r27-test.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/library',
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
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'localStorage'] as const) {
  try { Object.defineProperty(globalThis, k, { configurable: true, value: win[k] }) } catch { /* keep */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  /* --------------------- [1] the proxy rewrite, offline ------------------- */

  console.log('\n[1] The embedding proxy rewrites a page for the frame')
  const proxy = await import('../../backend/src/services/reader/proxy')
  const base = new URL('https://site.test/p/')
  const page = `<html><head><base href="/x/"><meta http-equiv="content-security-policy" content="frame-ancestors 'none'">` +
    `<meta http-equiv="X-Frame-Options" content="deny"><link rel="stylesheet" href="/a.css"></head>` +
    `<body><img src="/i.png" srcset="/i1.png 1x, /i2.png 2x"><a href="/next">n</a><a href="https://other.test/x">o</a>` +
    `<a href="#frag">f</a><script>if (top !== self) top.location = self.location</script></body></html>`
  const out = proxy.rewriteHtml(page, base, proxy.proxyPath)
  check('base and CSP metas are gone', !/<base\b/i.test(out) && !/content-security-policy/i.test(out) && !/x-frame-options/i.test(out))
  check('frame-busting script is gone', !out.includes('top.location'))
  check('subresources become absolute', out.includes('src="https://site.test/i.png"') && out.includes('href="https://site.test/a.css"'))
  check('srcset entries become absolute', out.includes('https://site.test/i1.png 1x') && out.includes('https://site.test/i2.png 2x'))
  check('same-site links loop through the proxy', out.includes(proxy.proxyPath('https://site.test/next')))
  check('cross-site links loop through the proxy too', out.includes(proxy.proxyPath('https://other.test/x')))
  check('fragments stay put', out.includes('href="#frag"'))
  check('the hostile list reads policy-hostile sites', proxy.isHostileToEmbedding('https://www.awwwards.com/websites/') && proxy.isHostileToEmbedding('https://dribbble.com/shots/popular') && !proxy.isHostileToEmbedding('https://example.com/'))
  check('SSRF: loopback is refused', !(await proxy.fetchForProxy('http://127.0.0.1:3847/api/health')).ok)

  const beList = (readFileSync(new URL('../../backend/src/services/reader/proxy.ts', import.meta.url), 'utf8').match(/EMBED_HOSTILE = \[([\s\S]*?)\]/) ?? [])[1]
  const feList = (readFileSync(new URL('../src/lib/library/embed.ts', import.meta.url), 'utf8').match(/EMBED_HOSTILE = \[([\s\S]*?)\]/) ?? [])[1]
  const norm = (x: string) => x.match(/'([^']+)'/g)?.join(',') ?? ''
  check('frontend and backend share one hostile list', norm(beList) === norm(feList) && norm(beList).length > 10)

  /* ----------------- [2] the reader can no longer crash ------------------- */

  console.log('\n[2] The source viewer survives every shape of answer')
  const { SourceViewer } = await import('../src/components/library/SourceViewer')

  const goodDoc = {
    ok: true, url: 'https://en.wikipedia.org/wiki/Design', via: 'wikipedia-api', title: 'Design',
    wordCount: 1200, minutes: 6,
    blocks: [{ type: 'paragraph', text: 'Design is the deliberate making of things.' }],
    outline: [{ id: 'a', text: 'One', level: 1 }, { id: 'b', text: 'Two', level: 1 }, { id: 'c', text: 'Three', level: 1 }],
    images: [{ src: 'https://upload.wikimedia.org/x.png' }],
    fetchedAt: Date.now(),
  }

  const cases: { name: string; body: any; status?: number; jsonThrows?: boolean }[] = [
    { name: 'a full wiki article renders', body: goodDoc },
    { name: 'an error body shows a card, not a blank page', body: { error: 'A url is required.' }, status: 400 },
    { name: 'an empty object shows a card', body: {} },
    { name: 'missing outline/images/wordCount still renders', body: { ok: true, blocks: [{ type: 'paragraph', text: 'Only a paragraph, nothing else.' }] } },
    { name: 'non-JSON shows the failure card', body: null, jsonThrows: true },
  ]

  for (const c of cases) {
    ;(globalThis as any).fetch = (async () => ({
      ok: (c.status ?? 200) < 400, status: c.status ?? 200,
      json: async () => { if (c.jsonThrows) throw new Error('not json'); return c.body },
    })) as any
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    let crashed = false
    try {
      root.render(React.createElement(SourceViewer as any, {
        source: { url: 'https://en.wikipedia.org/wiki/Design', title: 'Design' },
        onClose: () => {},
      }))
      await wait(60)
    } catch { crashed = true }
    const alive = !crashed && host.querySelector('[data-ui="source-viewer"]') !== null
    check(`${c.name}`, alive && host.textContent!.length > 40, crashed ? 'render threw' : '')
    root.unmount()
    host.remove()
  }

  // The wiki label follows the via the server actually sends.
  ;(globalThis as any).fetch = (async () => ({ ok: true, status: 200, json: async () => goodDoc })) as any
  {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(SourceViewer as any, { source: { url: goodDoc.url }, onClose: () => {} }))
    await wait(60)
    check('wikipedia-api is labelled as the Wikipedia API', host.textContent!.includes('Wikipedia article text'))
    root.unmount(); host.remove()
  }

  /* ------------- [3] refused-to-connect has an answer: proxied ------------ */

  console.log('\n[3] The browser tab answers "refused to connect"')
  {
    ;(globalThis as any).fetch = (async () => ({ ok: true, status: 200, json: async () => ({ ...goodDoc, ok: false, blocks: [] }) })) as any
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(SourceViewer as any, {
      source: { url: 'https://www.awwwards.com/websites/' }, onClose: () => {},
    }))
    await wait(40)
    // hostile host: click the Browser tab and expect the proxy in the frame
    const browserTab = [...host.querySelectorAll('button')].find((b: any) => b.textContent?.trim() === 'Browser')
    browserTab?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(30)
    const frame = host.querySelector('iframe') as HTMLIFrameElement | null
    check('a hostile host starts on the proxied view', !!frame && frame.src.includes('/api/proxy?url='))
    check('the header says why', host.textContent!.includes('refuses to be embedded'))
    const direct = [...host.querySelectorAll('button')].find((b: any) => b.textContent?.trim() === 'Direct')
    direct?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(30)
    const frame2 = host.querySelector('iframe') as HTMLIFrameElement | null
    check('the Direct/Proxied switch really switches', !!frame2 && frame2.src.includes('awwwards.com') && !frame2.src.includes('/api/proxy'))
    root.unmount(); host.remove()
  }
  {
    ;(globalThis as any).fetch = (async () => ({ ok: true, status: 200, json: async () => ({ ...goodDoc, ok: false, blocks: [] }) })) as any
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(SourceViewer as any, { source: { url: 'https://example.com/' }, onClose: () => {} }))
    await wait(40)
    const browserTab = [...host.querySelectorAll('button')].find((b: any) => b.textContent?.trim() === 'Browser')
    browserTab?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(30)
    const frame = host.querySelector('iframe') as HTMLIFrameElement | null
    check('a tame host still loads direct', !!frame && frame.src.includes('example.com') && !frame.src.includes('/api/proxy'))
    root.unmount(); host.remove()
  }

  /* ---------------- [4] the modes unfold sideways, tooltips --------------- */

  console.log('\n[4] The composer modes expand horizontally')
  const { ModeStrip } = await import('../src/components/input/ModeStrip')
  {
    const inputBar = readFileSync(new URL('../src/components/input/InputBar.tsx', import.meta.url), 'utf8')
    check('the composer no longer opens the old menu', !/<ModeMenu\b/.test(inputBar) && inputBar.includes('<ModeStrip pills={pills} />'))
    const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')
    check('the strip and its tooltip have their own motion', /\.mode-strip \{/.test(css) && /\.mode-pill:hover \.mode-tip/.test(css) && /prefers-reduced-motion[\s\S]*?\.mode-tip \{ transition: none/.test(css))

    const toggles: string[] = []
    const pills = [
      { id: 'flow', label: 'Flow', desc: 'Keeps context tight.', active: true, icon: (p: any) => React.createElement('i', p), toggle: () => toggles.push('flow') },
      { id: 'search', label: 'Search', desc: 'Live results.', active: false, icon: (p: any) => React.createElement('i', p), toggle: () => toggles.push('search') },
    ]
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(ModeStrip as any, { pills }))
    await wait(60)
    check('the pills sit in one horizontal strip', !!host.querySelector('[data-ui="mode-strip"]') && host.querySelectorAll('.mode-pill').length === 2)
    check('every pill carries a hover tooltip', host.querySelectorAll('.mode-tip').length === 2 && (host.textContent ?? '').includes('Keeps context tight.'))
    const first = host.querySelector('[data-mode="flow"]') as HTMLElement
    first?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(10)
    check('a press toggles the mode and the strip stays open', toggles.join(',') === 'flow' && host.querySelectorAll('.mode-pill').length === 2)
    root.unmount(); host.remove()
  }

  /* ------------------------- [5] fullscreen toggle ------------------------ */

  console.log('\n[5] Fullscreen is the real API')
  {
    const fs = await import('../src/lib/dom/fullscreen')
    let entered = 0, exited = 0
    ;(win.document.documentElement as any).requestFullscreen = async () => { entered++ }
    ;(win.document as any).exitFullscreen = async () => { exited++ }
    Object.defineProperty(win.document, 'fullscreenElement', { configurable: true, get: () => (entered > exited ? win.document.documentElement : null) })
    check('supported once the shell has the API', fs.fullscreenSupported())
    check('starts out of fullscreen', !fs.isFullscreen())
    await fs.toggleFullscreen()
    check('one press enters', entered === 1 && fs.isFullscreen())
    let changes = 0
    const off = fs.onFullscreenChange(() => { changes++ })
    win.document.dispatchEvent(new win.Event('fullscreenchange'))
    check('state changes are observed', changes === 1)
    await fs.toggleFullscreen()
    check('the next press leaves', exited === 1 && !fs.isFullscreen())
    off()
  }

  /* -------------------- [6] tutorial + live previews ---------------------- */

  console.log('\n[6] The tutorial walks every service; the hub previews live')
  {
    const { INTEGRATIONS } = await import('../src/lib/integrations/registry')
    const { INTEGRATION_GUIDES } = await import('../src/lib/integrations/guides')
    check('every service has a guide', INTEGRATIONS.every((i) => !!INTEGRATION_GUIDES[i.id]))
    check('token services get a real walk (≥4 steps)', INTEGRATIONS.filter((i) => i.auth === 'token').every((i) => (INTEGRATION_GUIDES[i.id].steps?.length ?? 0) >= 4))
    check('the local files service needs no walk', INTEGRATION_GUIDES.files.steps.length >= 1 && INTEGRATION_GUIDES.files.steps.length < 4)
    check('guides name the shape and the classic miss', INTEGRATION_GUIDES.github.shape?.includes('github_pat_') && !!INTEGRATION_GUIDES.slack.gotcha)

    const { IntegrationTutorial } = await import('../src/components/settings/IntegrationTutorial')
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(IntegrationTutorial as any, { open: true, onClose: () => {} }))
    await wait(60)
    check('the wizard opens on the pick step', !!host.querySelector('[data-ui="integration-tutorial"]')
      && (host.textContent ?? '').includes('Connect a service, step by step')
      && [...host.querySelectorAll('button')].some((b: any) => (b.textContent ?? '').includes('GitHub')))
    const gh = [...host.querySelectorAll('button')].find((b: any) => (b.textContent ?? '').includes('GitHub'))
    gh?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(40)
    const next = [...host.querySelectorAll('button')].find((b: any) => (b.textContent ?? '').trim().startsWith('Next'))
    next?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(40)
    check('the create step is the console walk, numbered', (host.textContent ?? '').includes('Fine-grained') && host.querySelectorAll('ol li').length >= 5)
    const next2 = [...host.querySelectorAll('button')].find((b: any) => (b.textContent ?? '').trim().startsWith('Next'))
    next2?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(40)
    check('the paste step shows the real credential fields', (host.textContent ?? '').includes('Access token') && (host.textContent ?? '').includes('Base URL'))
    check('six dots for a token service', host.querySelectorAll('.tut-dots span').length === 6)
    root.unmount(); host.remove()
  }
  {
    const demos = await import('../src/lib/design/liveDemos')
    const keys = demos.liveDemoKeys()
    check('the demo registry covers the vendored set', keys.length >= 25 && keys.filter((k) => k.startsWith('smoothui:')).length >= 15 && keys.filter((k) => k.startsWith('aceternity:')).length >= 8)
    check('every demo resolves against the catalog naming', keys.every((k) => typeof demos.liveDemoFor(...(k.split(':') as [string, string]))?.load === 'function'))

    const hub = readFileSync(new URL('../src/components/design/ComponentHub.tsx', import.meta.url), 'utf8')
    const previewSrc = readFileSync(new URL('../src/components/design/ComponentPreview.tsx', import.meta.url), 'utf8')
    check('the hub rows gained a preview affordance', hub.includes('Preview it here') && hub.includes('<ComponentPreview item={preview}'))
    check('the stage is honest about non-vendored registries', previewSrc.includes('No live demo is vendored'))
    check('the stage judges on light and dark', previewSrc.includes('Judge it on light'))

    const search = readFileSync(new URL('../src/components/library/LibrarySearch.tsx', import.meta.url), 'utf8')
    check('Library UI hits open the design hub, searching', search.includes('/code?hub='))
    const coding = readFileSync(new URL('../src/components/ide/CodingView.tsx', import.meta.url), 'utf8')
    const studio = readFileSync(new URL('../src/components/ide/DesignStudio.tsx', import.meta.url), 'utf8')
    check('the hub seed opens design mode on the hub', coding.includes("params.get('hub')") && studio.includes("useState<Tab>(hubSeed ? 'hub' : 'assistant')"))
  }
  {
    const topbar = readFileSync(new URL('../src/components/topbar/TopBar.tsx', import.meta.url), 'utf8')
    check('the top bar carries the fullscreen toggle', topbar.includes('FullscreenButton') && topbar.includes('data-ui="fullscreen-toggle"'))
    const menu = readFileSync(new URL('../src/components/input/IntegrationsMenu.tsx', import.meta.url), 'utf8')
    check('the composer plug menu offers the tutorial', menu.includes('integrationTutorial: true') && menu.includes('Tutorial'))
  }

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (failed) { console.log(fails.join('\n')); process.exit(1) }
}

void main()
