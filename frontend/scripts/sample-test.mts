/**
 * Sample-app end-to-end check: creates the built-in sample project through the
 * real API, starts its preview, loads the served page and runs the Design-mode
 * bridge against it — proving the "Try a sample app" path and the audit both
 * work from a clean state.
 *
 * Run: npx tsx scripts/sample-test.mts
 */
import { JSDOM, VirtualConsole } from 'jsdom'
import { SAMPLE_PROJECT } from '../src/lib/ide/sample'

const API = process.env.RE_API ?? 'http://localhost:8787'
const PROJECT = 'sample-landing-e2e'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api<T = any>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(API + path, body
    ? { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : { method: method === 'GET' ? 'GET' : method })
  return await res.json() as T
}

function makeHost(win: any) {
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  const events: any[] = []
  win.parent = { postMessage(msg: any) { events.push(msg); if (msg?.type === 'result' || msg?.type === 'error') { const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.type === 'error' ? p.reject(new Error(msg.payload?.message)) : p.resolve(msg.payload) } } } }
  let n = 0
  return {
    events,
    call<T = any>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 6000): Promise<T> {
      const id = `s${++n}`
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${cmd}`)) }, timeoutMs)
        pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v) }, reject: (e) => { clearTimeout(t); reject(e) } })
        win.postMessage({ source: 're-design-host', cmd, args, id }, '*')
      })
    },
  }
}

async function main() {
  console.log(`\n[1] sample project — ${PROJECT}`)
  await api(`/api/ide/projects/${PROJECT}`, undefined, 'DELETE').catch(() => null)
  const created = await api<any>('/api/ide/projects', { name: PROJECT, files: SAMPLE_PROJECT })
  check('sample project is created', created.ok === true, JSON.stringify(created))
  const tree = await api<any>(`/api/ide/tree?project=${PROJECT}`, undefined, 'GET')
  const names = (tree.tree ?? []).map((n: any) => n.name)
  check('sample ships index.html + css + js', names.includes('index.html') && names.includes('styles.css') && names.includes('app.js'), names.join(','))

  console.log('\n[2] preview + served document')
  const started = await api<any>('/api/ide/preview/start', { project: PROJECT })
  check('static preview starts without a dev server', started.ready === true && started.kind === 'static', JSON.stringify(started.error ?? started))
  const port = started.port
  const html = await (await fetch(`http://127.0.0.1:${port}/`)).text()
  check('bridge injected', html.includes('data-re-design-bridge'))
  check('app markup intact', html.includes('Ship research faster'))
  const sameOrigin = await (await fetch(`${API}/api/ide/preview/site?project=${PROJECT}&path=/`)).text()
  check('same-origin fallback serves the page', sameOrigin.includes('Ship research faster') && sameOrigin.includes('data-re-design-bridge'))

  console.log('\n[3] the bridge on the sample page')
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e: any) => { if (!/Not implemented/.test(e.message)) console.log('    jsdom:', e.message.slice(0, 120)) })
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', resources: 'usable', url: `http://127.0.0.1:${port}/`, pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      ;(w as any).HTMLElement.prototype.getBoundingClientRect = function () {
        const t = this.tagName
        const w = t === 'BUTTON' ? 62 : t === 'INPUT' ? 180 : 520
        const h = t === 'BUTTON' ? 22 : t === 'H2' ? 40 : 30
        return { x: 20, y: 100, width: w, height: h, top: 100, left: 20, right: 20 + w, bottom: 100 + h, toJSON() {} }
      }
      ;(w as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
  })
  const win: any = dom.window
  const host = makeHost(win)
  for (let i = 0; i < 40 && win.document.readyState !== 'complete'; i++) await sleep(100)
  await sleep(500)

  check('bridge announces itself', host.events.some((e) => e.type === 'ready'))

  const controls = await host.call('controls')
  check('every interactive control is discovered', controls.count >= 6, `count=${controls.count}`)
  const names0 = (controls.controls ?? []).map((c: any) => c.name)
  check('controls have accessible names', names0.includes('Get started') && names0.includes('Notify me'), names0.join(' | '))

  const audit = await host.call('audit')
  const kinds = new Set((audit.findings ?? []).map((f: any) => f.kind))
  check('audit finds real problems', (audit.findings ?? []).length >= 3, JSON.stringify(audit.findings?.slice(0, 4)))
  check('audit reports the missing alt text', (audit.findings ?? []).some((f: any) => /alt text/i.test(f.msg)), JSON.stringify(audit.findings?.filter((f: any) => /alt/i.test(f.msg))))
  check('audit reports the heading structure problem (no h1)', (audit.findings ?? []).some((f: any) => /no h1|heading level jumps/i.test(f.msg)), JSON.stringify(audit.findings?.map((f: any) => f.msg)))
  check('audit reports dead links (href="#")', (audit.findings ?? []).some((f: any) => /does nothing/i.test(f.msg)))
  check('audit finds more than one kind of problem', kinds.size >= 2, [...kinds].join(','))

  const snapshot = await host.call('snapshot', { maxNodes: 60 })
  const smallTargets = (snapshot.elements ?? []).filter((e: any) => (e.flags ?? []).some((f: string) => f.startsWith('small-target')))
  check('tiny tap targets are flagged', smallTargets.length > 0, `flagged=${smallTargets.length}`)
  const tinyText = (snapshot.elements ?? []).filter((e: any) => (e.flags ?? []).some((f: string) => f.startsWith('tiny-text')))
  check('10px copy is flagged as tiny text', tinyText.length > 0, `flagged=${tinyText.length}`)

  const click = await host.call('click', { target: '#primary', waitMs: 60 })
  check('a real button can be clicked', typeof click.clicked === 'string', JSON.stringify(click))
  const consoleAfter = await host.call('console', { limit: 20 })
  check('page console output is captured', (consoleAfter.entries ?? []).some((e: any) => /primary clicked/.test(e.text)), JSON.stringify(consoleAfter.entries))

  const asserts = await host.call('assert', {
    checks: [
      { kind: 'exists', target: '#primary' },
      { kind: 'visible', target: '#secondary' },
      { kind: 'text', target: 'h2', expect: 'Ship research faster' },
      { kind: 'count', selector: 'article', expect: 3 },
      { kind: 'rect', target: '#primary', maxWidth: 200 },
      { kind: 'noConsoleErrors' },
    ],
  })
  check('assertion suite passes on the sample', asserts.allPassed === true, JSON.stringify(asserts.results?.filter((r: any) => !r.pass)))

  console.log('\n[4] authoring a fix (what the AI does)')
  const edited = SAMPLE_PROJECT['styles.css']
    .replace('.btn { border: 0; border-radius: 6px; padding: 4px 7px; font-size: 11px; cursor: pointer; }',
             '.btn { border: 0; border-radius: 8px; padding: 12px 18px; font-size: 14px; cursor: pointer; }')
    .replace(/\.muted \{ color: #b4bac6; \}/, '.muted { color: #4a5261; }')
    .replace(/\.tiny \{ font-size: 10px; \}/, '.tiny { font-size: 13px; }')
  const saved = await api<any>('/api/ide/file', { project: PROJECT, path: 'styles.css', content: edited })
  check('the AI-side file write goes through', saved.ok === true)
  const reloaded = await (await fetch(`http://127.0.0.1:${port}/styles.css`)).text()
  check('the preview serves the fixed stylesheet', /padding: 12px 18px/.test(reloaded), reloaded.slice(0, 80))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed\n`)
  try { win.close() } catch { /* ignore */ }
  await api(`/api/ide/projects/${PROJECT}`, undefined, 'DELETE').catch(() => null)
  await api('/api/ide/preview/stop', { project: PROJECT }).catch(() => null)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('sample-test crashed:', e); process.exit(1) })
