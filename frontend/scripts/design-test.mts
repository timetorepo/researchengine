/**
 * Design-mode end-to-end test (no browser required).
 *
 *   1. starts the sample project's preview through the real API,
 *   2. fetches the proxied page and asserts the bridge was injected,
 *   3. runs the page in jsdom with the bridge live,
 *   4. drives it exactly like the host UI does — snapshot, audit, controls,
 *      click, type, assert — and prints pass/fail.
 *
 * Run: npx tsx scripts/design-test.mts
 */
import { JSDOM } from 'jsdom'

const API = process.env.RE_API ?? 'http://localhost:8787'
// Its own project, so the fixture below is always the thing under test —
// pointing this at a real project (the old default, `sample-landing`) made the
// assertions depend on whatever that project happened to contain.
const PROJECT = process.env.RE_PROJECT ?? 'design-test-fixture'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : undefined)
  return await res.json() as T
}

/* --------------- the bridge under test, driven like the host --------------- */
function makeHost(win: any) {
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  const received: any[] = []
  // The bridge posts to window.parent; stand in for the IDE window.
  win.parent = {
    postMessage(msg: any) {
      received.push(msg)
      if (msg?.type === 'result' || msg?.type === 'error') {
        const p = pending.get(msg.id)
        if (!p) return
        pending.delete(msg.id)
        msg.type === 'error' ? p.reject(new Error(msg.payload?.message ?? 'bridge error')) : p.resolve(msg.payload)
      }
    },
  }
  let n = 0
  return {
    received,
    call<T = any>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 5000): Promise<T> {
      const id = `t${++n}`
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${cmd}`)) }, timeoutMs)
        pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v) }, reject: (e) => { clearTimeout(t); reject(e) } })
        win.postMessage({ source: 're-design-host', cmd, args, id }, '*')
      })
    },
  }
}

async function main() {
  console.log(`\n[1] preview API — project "${PROJECT}"`)

  // Create the fixture (idempotent), then overwrite it every run so a previous
  // run's edits — or a half-written fixture — can never make this pass or fail
  // by accident.
  const list = await api<{ projects: { name: string }[] }>('/api/ide/projects')
  // The server may free the name up if something already holds it; everything
  // below — preview, edits, cleanup — must use the name it actually created.
  let projectName = list.projects.find((p) => p.name === PROJECT)?.name ?? PROJECT
  {
    if (!list.projects.some((p) => p.name === PROJECT)) console.log(`  … creating ${PROJECT} through the API`)
    const created = await api<any>('/api/ide/projects', {
      name: PROJECT,
      unique: true,
      files: {
        'index.html': `<!doctype html><html lang="en"><head><title>Design test</title></head><body>
  <h1>Design test</h1><main>
    <button id="go">Go</button><input id="q" placeholder="Search" />
    <p id="out">idle</p><img src="/missing.png" />
  </main><script src="/app.js"></script></body></html>`,
        'app.js': `document.getElementById('go').addEventListener('click', function(){
  document.getElementById('out').textContent = 'clicked ' + (document.getElementById('q').value || 'nothing')
})`,
      },
    })
    if (created?.name) projectName = created.name
  }

  const started = await api<any>('/api/ide/preview/start', { project: projectName })
  check('preview starts', !!started.ok && started.ready === true, JSON.stringify(started.error ?? started))
  check('preview classifies the stack', typeof started.kind === 'string' && started.kind.length > 0, String(started.kind))
  const port: number = started.port
  check('preview gets a public port', Number.isFinite(port) && port > 0, String(port))

  console.log('\n[2] proxied document')
  const html = await (await fetch(`http://127.0.0.1:${port}/`)).text()
  check('bridge script injected before app scripts', html.indexOf('data-re-design-bridge') !== -1 && html.indexOf('data-re-design-bridge') < html.indexOf('app.js'))
  check('document still contains the app markup', html.includes('<h1>Design test</h1>'))

  console.log('\n[3] bridge in a live document')
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: `http://127.0.0.1:${port}/`,
    pretendToBeVisual: true,
    // Load the page's own scripts over HTTP, exactly like the browser would.
    resources: 'usable',
    beforeParse(window) {
      // jsdom has no layout engine, no canvas and no matchMedia — supply the
      // minimum a real browser would provide so the bridge runs unmodified.
      ;(window as any).HTMLElement.prototype.getBoundingClientRect = function () {
        const tag = this.tagName
        const w = tag === 'BUTTON' ? 80 : tag === 'INPUT' ? 200 : 300
        const h = tag === 'BUTTON' ? 28 : 32
        return { x: 10, y: 40, width: w, height: h, top: 40, left: 10, right: 10 + w, bottom: 40 + h, toJSON() { return {} } }
      }
      ;(window as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
  })
  const win: any = dom.window
  const host = makeHost(win)
  // The page's own scripts load over HTTP asynchronously — wait for them, the
  // way a browser would before we start clicking things.
  for (let i = 0; i < 40 && win.document.readyState !== 'complete'; i++) await sleep(100)
  await sleep(400)

  check('bridge announces itself to the host', host.received.some((m) => m.type === 'ready'), JSON.stringify(host.received.map((m) => m.type)))

  const ping = await host.call('ping')
  check('ping answers with page info', ping?.pong === true && typeof ping.url === 'string', JSON.stringify(ping))

  const snap = await host.call('snapshot', { maxNodes: 40 })
  check('snapshot lists elements', Array.isArray(snap.elements) && snap.elements.length > 0, `elements=${snap?.elements?.length}`)
  check('snapshot exposes headings', (snap.headings ?? []).some((h: any) => h.tag === 'h1'))
  const button = (snap.elements ?? []).find((e: any) => e.tag === 'button')
  check('snapshot gives the button a uid + selector', !!button?.uid && typeof button?.sel === 'string', JSON.stringify(button?.sel))
  check('snapshot flags the image without alt', (snap.findings ?? []).some((f: any) => /alt/i.test(f.msg)) || (button?.flags ?? []).length > 0, JSON.stringify(snap.findings?.slice(0, 3)))

  const audit = await host.call('audit')
  check('audit returns findings', Array.isArray(audit.findings))

  const controls = await host.call('controls')
  check('controls map finds the button + input', controls.count >= 2, `count=${controls.count}`)

  console.log('\n[4] interaction (client tool calls)')
  const click = await host.call('click', { target: button.uid, waitMs: 50 })
  check('click reports what it clicked', typeof click.clicked === 'string' && !!click.rect, JSON.stringify(click))
  const after = await host.call('inspect', { target: '#out' })
  if (process.env.RE_DEBUG) console.log('    debug inspect:', JSON.stringify({ text: after.text, name: after.name, tag: after.tag, sel: after.sel }))
  check('click had a visible effect', /clicked/.test(String(after.text)), JSON.stringify(after.text))

  const input = (controls.controls ?? []).find((c: any) => c.kind === 'input')
  const typed = await host.call('type', { target: input.uid, text: 'papers' })
  check('typing sets the field value', typed.typed === 'papers', JSON.stringify(typed))

  const asserts = await host.call('assert', {
    checks: [
      { kind: 'exists', target: '#go' },
      { kind: 'visible', target: '#go' },
      { kind: 'text', target: '#out', expect: 'clicked' },
      { kind: 'value', target: '#q', expect: 'papers' },
      { kind: 'count', selector: 'h1', expect: 1 },
      { kind: 'noHorizontalScroll' },
    ],
  })
  check('asserts run and pass', asserts.allPassed === true, JSON.stringify(asserts.results?.filter((r: any) => !r.pass)))
  const failing = await host.call('assert', { checks: [{ kind: 'text', target: '#out', expect: 'nonsense-xyz' }] })
  check('a failing assert fails loudly', failing.allPassed === false && failing.passed === 0, JSON.stringify(failing))

  const inspect = await host.call('inspect', { target: '#go' })
  check('inspect returns box model + styles', !!inspect.rect && !!inspect.styles, JSON.stringify(Object.keys(inspect)))
  check('inspect computes contrast', inspect.contrast === null || typeof inspect.contrast?.ratio === 'number')

  const consoleOut = await host.call('console', { limit: 10 })
  check('console buffer is readable', Array.isArray(consoleOut.entries))

  const metrics = await host.call('metrics')
  check('metrics report the viewport', typeof metrics.viewport?.w === 'number')

  const unknown = await host.call('does_not_exist').then(() => 'resolved').catch((e) => e.message)
  check('unknown commands are refused, not ignored', /unknown command/.test(String(unknown)), String(unknown))

  console.log('\n[5] bridge protocol robustness')
  const stale = await host.call('inspect', { target: '#not-on-the-page' }).then(() => 'resolved').catch((e) => e.message)
  check('missing element produces an error reply', /not found/.test(String(stale)), String(stale))

  const navigation = await host.call('ping')
  check('page url is reported', String(navigation.url).includes('/'), String(navigation.url))

  console.log('\n[6] Build fingerprint — "which build am I running?"')
  // The CLI answers the question a self-hoster actually has: is the bundle on
  // disk the one this code produces? Its output is the first thing to check
  // when a fix is in the source but not in the app.
  const { execFileSync } = await import('node:child_process')
  const cli = execFileSync(process.execPath, ['backend/bin/research-engine.mjs', 'version'], { cwd: '..', encoding: 'utf8' })
  check('the CLI names a version', /Research Engine \d+\.\d+/.test(cli), cli.trim())
  check('the CLI names the built frontend', /built frontend\s*:/.test(cli))
  check('the CLI states a status', /STATUS\s+:/.test(cli))
  const health = await api<{ web: { served: { version: string } | null; source: string; mode?: string } }>('/api/health')
  check('/api/health reports the served build', !!health.web?.served?.version, JSON.stringify(health.web))
  check('/api/health reports the source version', !!health.web?.source)
  check('/api/health reports the install mode', health.web?.mode === 'checkout' || health.web?.mode === 'portable', String(health.web?.mode))
  check('served and source agree in a current checkout', health.web?.served?.version === health.web?.source, `${health.web?.served?.version} vs ${health.web?.source}`)

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed\n`)
  try { (dom.window as any).close() } catch { /* ignore */ }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('design-test crashed:', e); process.exit(1) })
