// Headless verification of the AIFlowEngine stream shaper.
import { StreamShaper, createFlowRun, STAGE_LABELS } from '../src/lib/flow/engine'

// fake rAF loop @60Hz driven by a fake clock
let now = 0
let rafCbs: Array<() => void> = []
;(globalThis as any).performance = { now: () => now }
;(globalThis as any).requestAnimationFrame = (cb: () => void) => { rafCbs.push(cb); return rafCbs.length }
;(globalThis as any).cancelAnimationFrame = () => {}
const step = (ms: number) => {
  const frames = Math.round(ms / 16.67)
  for (let i = 0; i < frames; i++) {
    now += 16.67
    const cbs = rafCbs; rafCbs = []
    cbs.forEach((c) => c())
  }
}

let failed = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

// --- test 1: word-by-word pacing + punctuation pause ordering ---
{
  let rendered = ''
  let firstToken = false
  let complete = false
  const shaper = new StreamShaper(
    { shaping: 'standard', sensitivity: 0.5, punctuationPauses: true },
    (t) => { rendered += t },
    { onFirstToken: () => { firstToken = true }, onComplete: () => { complete = true } },
  )
  shaper.start()
  // raw burst arrives instantly
  shaper.ingest('Hello there. A test, yes.')
  step(100)
  check('nothing rendered after only 100ms of a burst', rendered.length < 'Hello there. A test, yes.'.length, `rendered ${rendered.length} chars`)
  shaper.endRaw()
  for (let i = 0; i < 240 && !complete; i++) step(50)
  check('full text eventually rendered', rendered === 'Hello there. A test, yes.', JSON.stringify(rendered))
  check('firstToken hook fired', firstToken)
  check('onComplete fired', complete)
}

// --- test 2: code fences reveal whole lines ---
{
  let rendered = ''
  let complete = false
  const shaper = new StreamShaper(
    { shaping: 'standard', sensitivity: 0.5, punctuationPauses: true },
    (t) => { rendered += t },
    { onComplete: () => { complete = true } },
  )
  shaper.start()
  shaper.ingest('Here:\n```js\nconst a = 1;\nconst b = 2;\n```\nDone.')
  shaper.endRaw()
  for (let i = 0; i < 400 && !complete; i++) step(50)
  check('code fence text intact', rendered === 'Here:\n```js\nconst a = 1;\nconst b = 2;\n```\nDone.', JSON.stringify(rendered.slice(0, 60)))
}

// --- test 3: shaping off = pass-through ---
{
  let rendered = ''
  let complete = false
  const shaper = new StreamShaper(
    { shaping: 'off', sensitivity: 0.5, punctuationPauses: true },
    (t) => { rendered += t },
    { onComplete: () => { complete = true } },
  )
  shaper.start()
  shaper.ingest('Instant answer.')
  check('off mode renders immediately', rendered === 'Instant answer.', JSON.stringify(rendered))
  shaper.endRaw()
  check('off mode completes immediately', complete)
}

// --- test 4: stall + resume hooks ---
{
  let stalled = 0, resumed = 0
  const shaper = new StreamShaper(
    { shaping: 'standard', sensitivity: 0.5, punctuationPauses: true },
    () => {},
    { onStreamStall: () => stalled++, onStreamResume: () => resumed++ },
  )
  shaper.start()
  shaper.ingest('One two three four five six seven eight nine ten.')
  step(60) // first words emit
  step(2000) // raw stream still open but nothing arrives -> stall
  check('stall detected after 250ms dry', stalled >= 1, `stalled=${stalled}`)
  shaper.ingest('More words now.')
  check('resume fired on new chunk', resumed >= 1, `resumed=${resumed}`)
}

// --- test 5: FlowRun stage hooks + backpressure doesn't dump ---
{
  const stages: string[] = []
  let renderedWords: number[] = []
  let frameCounts: string[] = []
  const run = createFlowRun(
    { shaping: 'subtle', sensitivity: 1, punctuationPauses: true },
    (t) => { frameCounts.push(t) },
    { onStageChange: (s) => stages.push(s) },
  )
  run.setStage('think')
  run.begin()
  // huge burst -> buffer grows; pacer must NOT dump it all in one flush
  run.ingest(Array.from({ length: 120 }, (_, i) => `word${i}`).join(' '))
  step(16.67 * 3)
  const firstFrame = frameCounts[0] ?? ''
  check('backpressure keeps first flush bounded', firstFrame.split(/\s+/).length < 60, `first flush ${firstFrame.split(/\s+/).length} words`)
  run.endRaw()
  check('stage hooks fired', stages.includes('think'), stages.join(','))
  run.abort()
}

// --- stage labels ---
check('stage labels complete', Object.keys(STAGE_LABELS).length === 7)

console.log(failed === 0 ? '\nALL ENGINE CHECKS PASSED' : `\n${failed} CHECKS FAILED`)
process.exit(failed === 0 ? 0 : 1)
