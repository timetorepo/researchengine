/**
 * The pick marquee — R26.
 *
 * R26 asked for pick mode to be smoother and to take its colour from Appearance
 * rather than from a hard-coded green. Both claims are about the *injected
 * bridge*, which is a piece of JavaScript that lives in the preview document, so
 * both are testable without a browser: the bridge is a string, a JSDOM is a
 * document, and the host protocol is four fields.
 *
 * What is held down here:
 *
 *   • the colour arrives with the call — accent, tint and label ink — and the
 *     marquee is drawn in it; the old green is only a fallback;
 *   • the box *travels* to the element instead of appearing on it: one frame
 *     after a hover it is a fraction of the way there, and a little later it is
 *     there, which is what "smoother" has to mean if it means anything;
 *   • it measures the element once per hover, not once per mouse move, which is
 *     the other half of smooth: no layout read per pixel of movement;
 *   • a picked element lingers and then lets go, while a kept highlight stays;
 *   • the browser's reduced-motion setting turns the travel off;
 *   • scrolling away hides the marquee.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/bridge-pick-test.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'
import { BRIDGE_JS } from '../../backend/src/preview/bridge'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  box: { x: 40, y: 60, w: 200, h: 100 },
  other: { x: 300, y: 420, w: 120, h: 40 },
}

/** A document with the bridge running in it, driven exactly like the app drives it. */
function makePage(reduceMotion = false) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Pick fixture</title></head><body>
      <div id="box">A box</div><div id="other">Another</div>
    </body></html>`,
    { runScripts: 'dangerously', url: 'http://127.0.0.1:5199/', pretendToBeVisual: true },
  )
  const win: any = dom.window
  // Frames are driven by hand: the marquee's whole claim is about *when* it is
  // where, and a real 16 ms clock makes that a race with the test runner.
  const frames: Array<(t: number) => void> = []
  win.requestAnimationFrame = (fn: (t: number) => void) => { frames.push(fn); return frames.length }
  win.cancelAnimationFrame = () => {}
  win.matchMedia = (q: string) => ({
    matches: reduceMotion && /prefers-reduced-motion/.test(q),
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  })
  // Every element answers with one of two rects, and every measurement is
  // counted — the count is how "one read per hover" is checked.
  let reads = 0
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    reads++
    const r = RECTS[this.id] ?? { x: 0, y: 0, w: 10, h: 10 }
    return { x: r.x, y: r.y, width: r.w, height: r.h, top: r.y, left: r.x, right: r.x + r.w, bottom: r.y + r.h, toJSON() { return {} } }
  }
  const pending = new Map<string, (v: any) => void>()
  const received: any[] = []
  win.parent = {
    postMessage(msg: any) {
      received.push(msg)
      if (msg?.type === 'result' || msg?.type === 'error') pending.get(msg.id)?.(msg.payload)
      pending.delete(msg.id)
    },
  }
  const script = win.document.createElement('script')
  script.textContent = BRIDGE_JS
  win.document.body.appendChild(script)

  let n = 0
  const call = (cmd: string, args: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
    const id = `t${++n}`
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${cmd}`)) }, 5000)
    pending.set(id, (v) => { clearTimeout(t); resolve(v) })
    win.postMessage({ source: 're-design-host', cmd, args, id }, '*')
  })
  const overlay = () => win.document.querySelector('[data-re-overlay]') as any
  /** Run the frames the bridge asked for, and only those. */
  const pump = (n: number) => {
    for (let i = 0; i < n; i++) {
      const due = frames.splice(0, frames.length)
      if (!due.length) return i
      for (const fn of due) fn(i * 16)
    }
    return n
  }
  const move = (id: string) => {
    const el = win.document.getElementById(id)
    el.dispatchEvent(new win.MouseEvent('mousemove', { bubbles: true }))
  }
  const click = (id: string) => {
    const el = win.document.getElementById(id)
    el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }))
  }
  return { win, call, overlay, pump, move, click, received, reads: () => reads }
}

const num = (v: unknown) => Number(String(v ?? '0').replace('px', ''))

async function main() {
  /* ------------------------- [1] the colour crosses over ------------------ */

  console.log('\n[1] The marquee is drawn in the Appearance colour the app sends')
  const page = makePage()
  await sleep(40)
  const ACCENT = 'oklch(0.62 0.19 264)'
  const SOFT = `color-mix(in srgb, ${ACCENT} 16%, transparent)`
  const armed = await page.call('pick', { on: true, accent: ACCENT, soft: SOFT, ink: '#0b1220' })
  check('pick arms and answers', armed?.picking === true, JSON.stringify(armed))
  page.move('box')
  await sleep(120)
  const o = page.overlay()
  check('the marquee exists once something is hovered', !!o)
  check('and its border is the accent that was handed over',
    String(o?.style.borderColor) === ACCENT, String(o?.style.borderColor))
  check('with the translucency that came with it',
    String(o?.style.background).includes('color-mix') || String(o?.style.background) === SOFT,
    String(o?.style.background))
  const label = o?.firstChild as any
  // jsdom hands a hex colour back as rgb(), so the ink is compared by value.
  const ink = String(label?.style?.color ?? '')
  check('and the label carries the same ink, so it stays legible on any theme',
    (/rgb\(11,\s*18,\s*32\)/.test(ink) || ink === '#0b1220') && String(label?.style?.background) === ACCENT,
    `${ink} / ${label?.style?.background}`)
  check('the label names the element and its size',
    /div · 200×100/.test(String(label?.textContent)), String(label?.textContent))

  /* --------------------------- [2] it travels ---------------------------- */

  console.log('\n[2] The box travels to the element instead of appearing on it')
  const target = RECTS.box
  // The hover already asked for a frame; nothing has moved yet, because no
  // frame has run. That is the difference between travelling and snapping.
  check('before any frame runs, the box is still where it started',
    num(o?.style.width) === 0, `w=${num(o?.style.width)}`)
  page.pump(1)
  const early = { w: num(o?.style.width), h: num(o?.style.height) }
  check('one frame in, it is on its way rather than there',
    Math.abs(early.w - target.w * 0.32) < 1 && early.w < target.w * 0.5,
    `w=${early.w} of ${target.w}`)
  page.pump(3)
  const mid = num(o?.style.width)
  check('and it closes the distance frame by frame, not in one jump',
    mid > early.w && mid < target.w * 0.85, `w=${mid} of ${target.w}`)
  page.pump(60)
  const settled = { w: num(o?.style.width), h: num(o?.style.height) }
  check('and it arrives at the element',
    Math.abs(settled.w - target.w) < 0.5 && Math.abs(settled.h - target.h) < 0.5,
    `w=${settled.w} h=${settled.h}`)
  const tf = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(String(o?.style.transform))
  check('including where the element is',
    !!tf && Math.abs(Number(tf[1]) - 40) < 0.5 && Math.abs(Number(tf[2]) - 60) < 0.5,
    String(o?.style.transform))
  check('it is transformed, not repositioned, so a frame is one compositor layer and no layout',
    /translate3d/.test(String(o?.style.transform)) && String(o?.style.willChange).includes('transform'))
  check('and once it has settled it stops asking for frames',
    page.pump(5) === 0, 'it kept animating after arriving')

  console.log('\n[2b] …and it measures once per element, not once per mouse move')
  const before = page.reads()
  page.move('box'); page.move('box'); page.move('box')
  page.pump(2)
  const perMove = page.reads() - before
  check('three moves inside the same element cost no new measurement',
    perMove === 0, `${perMove} reads`)
  page.move('other')
  const afterMoveFrame = page.reads() - before
  check('moving to a different element measures exactly once',
    afterMoveFrame <= 1, `${afterMoveFrame} reads`)
  page.pump(60)
  check('and the marquee follows it there',
    Math.abs(num(page.overlay()?.style.width) - RECTS.other.w) < 0.5,
    String(page.overlay()?.style.width))

  /* ------------------------ [3] pick, and then what ---------------------- */

  console.log('\n[3] A picked element lingers, a kept one stays, scrolling hides it')
  const picked = await page.call('highlight', { target: '#box', keep: false, accent: ACCENT })
  check('the pick answers with the element it measured',
    picked?.rect?.w === RECTS.box.w && picked?.rect?.h === RECTS.box.h, JSON.stringify(picked?.rect))
  page.pump(2)
  check('it is visible right after the pick', String(page.overlay()?.style.opacity) === '1')
  await sleep(1700)
  check('and it lets go on its own after a moment',
    String(page.overlay()?.style.opacity) === '0', String(page.overlay()?.style.opacity))
  await page.call('highlight', { target: '#box', keep: true, accent: ACCENT })
  await sleep(1700)
  check('a kept highlight is still there after the same wait',
    String(page.overlay()?.style.opacity) === '1', String(page.overlay()?.style.opacity))
  page.win.document.dispatchEvent(new page.win.Event('scroll', { bubbles: false }))
  await sleep(40)
  check('scrolling the page hides it rather than smearing it over the old position',
    String(page.overlay()?.style.opacity) === '0', String(page.overlay()?.style.opacity))
  const pickedMsg = page.received.find((m) => m.type === 'picked')
  await page.call('pick', { on: false })
  page.click('box')
  await sleep(40)
  check('with the picker off, a click in the page is no longer swallowed',
    page.received.filter((m) => m.type === 'picked').length === (pickedMsg ? 1 : 0),
    String(page.received.filter((m) => m.type === 'picked').length))

  /* --------------------------- [4] reduced motion ------------------------ */

  console.log('\n[4] With reduced motion asked for, the box is simply where the pointer is')
  const calm = makePage(true)
  await sleep(40)
  await calm.call('pick', { on: true, accent: ACCENT, soft: SOFT, ink: '#0b1220' })
  calm.move('box')
  calm.pump(1)
  calm.win.document.dispatchEvent(new calm.win.Event('scroll'))
  calm.move('other')
  calm.pump(1)
  const calmOverlay = calm.overlay()
  check('it is already at the element, not on its way',
    Math.abs(num(calmOverlay?.style.width) - RECTS.other.w) < 1.5,
    String(calmOverlay?.style.width))
  check('and the label still says what it is on',
    /div · 120×40/.test(String(calmOverlay?.firstChild?.textContent)), String(calmOverlay?.firstChild?.textContent))

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('bridge-pick-test crashed:', e); process.exit(1) })
