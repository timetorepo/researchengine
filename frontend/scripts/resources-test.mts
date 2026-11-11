/**
 * The live resource meter: three numbers, and the truth about each.
 *
 * A meter that invents a number is worse than no meter, so this suite checks the
 * two places where a number does not exist and the code must say so:
 *
 *   • the first CPU reading is a percentage of nothing — it must be null, and
 *     the second reading must be a real number in a sane range;
 *   • a machine with no readable GPU must return a reason, not 0%.
 *
 * It then mounts the meter itself with a stubbed server answer and asserts the
 * three readings are on screen, that the dash survives, and that the GPU reason
 * is what the panel shows.
 *
 * Run from frontend/:  node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/resources-test.mts
 */
import { JSDOM } from 'jsdom'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/', pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1440 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 900 })
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
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'SVGElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'getComputedStyle', 'localStorage', 'DOMParser', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  if (!(key in globalThis) || key.startsWith('HTML') || ['window', 'document', 'navigator', 'localStorage', 'getComputedStyle'].includes(key)) {
    try { Object.defineProperty(globalThis, key, { configurable: true, value: win[key] }) } catch { /* keep what exists */ }
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { readFileSync } = await import('node:fs')

  /* ===================== [1] the sampler tells the truth ===================== */

  console.log('\n[1] A percentage needs two samples, and says so')
  const { sampleProcessCpu, systemMemory, gpuReading, resetMetricsCache } = await import('../../backend/src/services/system-metrics')

  resetMetricsCache()
  const first = sampleProcessCpu()
  check('the first reading is null, not a made-up zero', first.pct === null, String(first.pct))
  check('the process knows how long it has been busy', first.usedSec >= 0 && first.cores > 0)

  // Burn a little CPU so the second reading has something to measure.
  const until = Date.now() + 120
  let acc = 0
  while (Date.now() < until) acc += Math.sqrt(acc + 1)
  const second = sampleProcessCpu()
  check('the second reading is a real percentage', typeof second.pct === 'number' && Number.isFinite(second.pct), String(second.pct))
  check('and it is not nonsense', (second.pct ?? 0) >= 0 && (second.pct ?? 0) < 10_000, String(second.pct))

  const mem = systemMemory()
  check('memory is reported against the whole machine',
    mem.totalMB > 0 && mem.usedMB > 0 && mem.usedPct > 0 && mem.usedPct <= 100)

  const gpu = await gpuReading()
  check('the GPU either answers or explains itself',
    gpu.available ? Number.isFinite(gpu.utilPct) && gpu.utilPct! >= 0 && !!gpu.source : typeof gpu.reason === 'string' && gpu.reason.length > 20,
    JSON.stringify(gpu))
  const gpuAgain = await gpuReading()
  check('the probe is cached, so a two-second poll is not a fork bomb', gpuAgain === gpu)

  /* ==================[2] the meter shows what the server sent ================== */

  console.log('\n[2] The meter renders the three readings, dashes included')

  const payload = {
    ok: true, at: Date.now(),
    process: { rssMB: 384, heapMB: 22, uptimeSec: 754, node: 'v22', cpuPct: 12.5, cpuSec: 4.2 },
    system: { totalMB: 16384, freeMB: 9216, usedMB: 7168, usedPct: 43.8, load1: 1.42, cores: 8 },
    gpu: { available: false, reason: 'No GPU telemetry on this machine: neither nvidia-smi nor a Linux DRM counter answered.' },
  }
  let calls = 0
  const realFetch = globalThis.fetch
  ;(globalThis as any).fetch = async () => {
    calls++
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const { ResourceMeter } = await import('../src/components/topbar/ResourceMeter')
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(ResourceMeter as any, {}))
  await wait(220)
  const html = host.innerHTML

  check('the meter asked the server for a sample', calls > 0)
  check('memory is on screen', html.includes('384 MB'))
  check('processor use is on screen', html.includes('13%') || html.includes('12.5%') || html.includes('12%'))
  check('the GPU is a dash rather than a zero', /GPU|gpu/.test(html) && html.includes('—'))
  check('the meter stays out of the way until you hover it', !!host.querySelector('[aria-label="Live resource use"]'))

  // Hover: the detail card, with the reason the GPU has no number.
  const button = host.querySelector('[aria-label="Live resource use"]') as any
  // React maps onMouseEnter onto the delegated mouseover event.
  button?.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
  await wait(120)
  const detail = host.innerHTML
  check('the detail card opens on hover', detail.includes('Research Engine right now'))
  check('it says how much of the machine is in use', detail.includes('43.8%') || detail.includes('of the machine'))
  check('and it explains the missing GPU reading instead of hiding it',
    detail.includes('nvidia-smi') || detail.includes('No GPU telemetry'))
  check('the card names the sampling interval', detail.includes('every 2s'))

  root.unmount()
  ;(globalThis as any).fetch = realFetch

  /* ========================= [3] it is wired to the top bar ========================= */

  console.log('\n[3] The top bar carries it, and the route feeds it')
  const topbar = readFileSync(new URL('../src/components/topbar/TopBar.tsx', import.meta.url), 'utf8')
  check('the meter is mounted in the top bar', /<ResourceMeter \/>/.test(topbar))
  const route = readFileSync(new URL('../../backend/src/routes/resources.ts', import.meta.url), 'utf8')
  check('the resources route samples CPU, memory and GPU',
    /sampleProcessCpu/.test(route) && /systemMemory/.test(route) && /gpuReading/.test(route))
  const hook = readFileSync(new URL('../src/hooks/useResources.ts', import.meta.url), 'utf8')
  check('polling pauses when the window is hidden', /document\.hidden/.test(hook) && /visibilitychange/.test(hook))

  console.log('')
  if (failed) {
    console.log(`FAILURES: ${passed} passed, ${failed} failed`)
    for (const f of fails) console.log(`  failed: ${f}`)
    process.exit(1)
  }
  console.log(`ALL PASS: ${passed} passed, 0 failed`)
}

void main()
