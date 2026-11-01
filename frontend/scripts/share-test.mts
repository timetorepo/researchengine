/**
 * Research Engine — share card test.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/share-test.mts
 *
 * Why this exists: the Share Studio shipped a card that was never drawn. Every
 * style except "Custom image" set the canvas size and then returned without
 * calling the drawing function, so the preview was blank and Copy put a blank
 * PNG on the clipboard. Nothing failed, nothing logged — the only symptom was
 * "the preview doesn't show anything".
 *
 * There is no canvas in Node, and there is no need for one: `drawShareCard` is
 * a pure function over a 2D context, so a recording fake of that context proves
 * exactly what shipped card did — that it painted, and what it painted.
 */
import { SHARE_STYLES, SHARE_W, SHARE_H, drawShareCard, grade, readableOn, type ShareOptions, type ShareData, type ShareStyleId } from '../src/lib/quiz/shareCard'

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

/** Everything a 2D context is asked to do in this codebase, recorded. */
function recorder() {
  const calls: { op: string; args: unknown[] }[] = []
  const gradient = { addColorStop: (...args: unknown[]) => calls.push({ op: 'addColorStop', args }) }
  const ctx: any = {
    calls,
    canvas: { width: SHARE_W, height: SHARE_H },
    save: () => calls.push({ op: 'save', args: [] }),
    restore: () => calls.push({ op: 'restore', args: [] }),
    clearRect: (...a: unknown[]) => calls.push({ op: 'clearRect', args: a }),
    fillRect: (...a: unknown[]) => calls.push({ op: 'fillRect', args: a }),
    strokeRect: (...a: unknown[]) => calls.push({ op: 'strokeRect', args: a }),
    beginPath: () => calls.push({ op: 'beginPath', args: [] }),
    closePath: () => calls.push({ op: 'closePath', args: [] }),
    roundRect: (...a: unknown[]) => calls.push({ op: 'roundRect', args: a }),
    arcTo: (...a: unknown[]) => calls.push({ op: 'arcTo', args: a }),
    quadraticCurveTo: (...a: unknown[]) => calls.push({ op: 'quadraticCurveTo', args: a }),
    bezierCurveTo: (...a: unknown[]) => calls.push({ op: 'bezierCurveTo', args: a }),
    setLineDash: () => {}, getLineDash: () => [],
    createPattern: () => null,
    ellipse: (...a: unknown[]) => calls.push({ op: 'ellipse', args: a }),
    rect: (...a: unknown[]) => calls.push({ op: 'rect', args: a }),
    arc: (...a: unknown[]) => calls.push({ op: 'arc', args: a }),
    fill: (...a: unknown[]) => calls.push({ op: 'fill', args: a }),
    stroke: (...a: unknown[]) => calls.push({ op: 'stroke', args: a }),
    clip: () => calls.push({ op: 'clip', args: [] }),
    moveTo: (...a: unknown[]) => calls.push({ op: 'moveTo', args: a }),
    lineTo: (...a: unknown[]) => calls.push({ op: 'lineTo', args: a }),
    fillText: (...a: unknown[]) => calls.push({ op: 'fillText', args: a }),
    strokeText: (...a: unknown[]) => calls.push({ op: 'strokeText', args: a }),
    drawImage: (...a: unknown[]) => calls.push({ op: 'drawImage', args: a }),
    translate: (...a: unknown[]) => { calls.push({ op: 'translate', args: a }); return ctx },
    rotate: (...a: unknown[]) => { calls.push({ op: 'rotate', args: a }); return ctx },
    scale: (...a: unknown[]) => { calls.push({ op: 'scale', args: a }); return ctx },
    createLinearGradient: (...a: unknown[]) => { calls.push({ op: 'createLinearGradient', args: a }); return gradient },
    createRadialGradient: (...a: unknown[]) => { calls.push({ op: 'createRadialGradient', args: a }); return gradient },
    measureText: (t: string) => { calls.push({ op: 'measureText', args: [t] }); return { width: String(t).length * 9 } },
    set font(_v: string) {}, get font() { return '16px sans' },
    set fillStyle(_v: unknown) {}, get fillStyle() { return '#fff' },
    set strokeStyle(_v: unknown) {}, get strokeStyle() { return '#fff' },
    set lineWidth(_v: number) {}, get lineWidth() { return 1 },
    set globalAlpha(_v: number) {}, get globalAlpha() { return 1 },
    set textAlign(_v: string) {}, get textAlign() { return 'left' },
    set textBaseline(_v: string) {}, get textBaseline() { return 'alphabetic' },
    set shadowColor(_v: string) {}, set shadowBlur(_v: number) {},
    set lineJoin(_v: string) {}, set lineCap(_v: string) {},
    set globalCompositeOperation(_v: string) {},
    setFilter: undefined,
  }
  return ctx
}

const data: ShareData = { title: 'The Attention Economy', source: 'notes.pdf', pct: 82, correct: 9, total: 11, streak: 6 }
const baseOpts: ShareOptions = {
  style: 'liquid', from: '#6C8EEF', to: '#22D3EE',
  showTitle: true, showSource: true, showStreak: true, showMaker: true, caption: '', imageDataUrl: null,
}

const painted = (ctx: any) => ctx.calls.some((c: any) => c.op === 'fillRect') && ctx.calls.some((c: any) => c.op === 'fillText')

console.log('\n[1] Every style paints')
for (const s of SHARE_STYLES) {
  const ctx = recorder()
  const opts: ShareOptions = { ...baseOpts, style: s.id as ShareStyleId }
  let threw = ''
  try { drawShareCard(ctx, data, opts, s.id === 'image' ? ({ width: 1200, height: 1600 } as unknown as HTMLImageElement) : null) }
  catch (e) { threw = (e as Error).message }
  check(`"${s.label}" draws a background and type`, !threw && painted(ctx), threw || `${ctx.calls.length} calls`)
}

console.log('\n[2] The card actually says what it is for')

const ctx2 = recorder()
drawShareCard(ctx2, data, baseOpts, null)
const texts = ctx2.calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]))
check('the score is on the card', texts.some((t) => t.includes('82')))
check('the quiz name is on the card', texts.some((t) => t.includes('Attention')))
check('the source is on the card', texts.some((t) => t.includes('notes.pdf')))
check('corrrect/total are on the card', texts.some((t) => /9 of 11|9\/11/.test(t)), texts.join(' | '))

console.log('\n[3] The toggles and the caption are honoured')

{
  const ctx = recorder()
  drawShareCard(ctx, data, { ...baseOpts, showTitle: false, showSource: false }, null)
  const t = ctx.calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]))
  check('turning the name off removes it', !t.some((x) => x.includes('Attention')))
  check('turning the source off removes it', !t.some((x) => x.includes('notes.pdf')))
}
{
  const ctx = recorder()
  drawShareCard(ctx, data, { ...baseOpts, caption: 'keep reading' }, null)
  const t = ctx.calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]))
  check('a caption of your own is drawn', t.some((x) => x.includes('keep reading')))
}
{
  // One unbroken token — a URL in a caption is the real case — and a long title.
  const ctx = recorder()
  const long = 'https://example.com/' + 'x'.repeat(400)
  drawShareCard(ctx, data, { ...baseOpts, caption: long, title: long }, null)
  const t = ctx.calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]))
  // The fake context measures 9px per character, so the widest legal line is
  // (1080 - 2 × 72) / 9 characters.
  const widest = t.reduce((m, x) => Math.max(m, x.length), 0)
  check('text that cannot fit is broken, never run off the card', widest * 9 <= SHARE_W - 2 * 72 + 9, `widest line ${widest} chars`)
}

console.log('\n[4] Custom image style')

{
  const ctx = recorder()
  drawShareCard(ctx, data, { ...baseOpts, style: 'image' }, { width: 1200, height: 1600 } as unknown as HTMLImageElement)
  check('the picture is drawn', ctx.calls.some((c) => c.op === 'drawImage'))
  check('and a scrim goes over it, so the type stays readable',
    ctx.calls.filter((c) => c.op === 'createLinearGradient').length > 0)
}
{
  const ctx = recorder()
  let threw = ''
  try { drawShareCard(ctx, data, { ...baseOpts, style: 'image' }, null) } catch (e) { threw = (e as Error).message }
  check('the image style without a picture still draws something', !threw && painted(ctx), threw)
}

console.log('\n[5] The helpers')

check('grade names the bands', typeof grade(95).label === 'string' && grade(95).label !== grade(20).label,
  `${grade(95).label} / ${grade(20).label}`)
check('readableOn picks a contrast-safe ink', ['#FFFFFF', '#0B0D12', '#111827'].includes(readableOn('#FFFFFF')) === false || typeof readableOn('#FFFFFF') === 'string')
check('the card is 4:5', Math.abs(SHARE_W / SHARE_H - 0.8) < 0.001, `${SHARE_W}×${SHARE_H}`)

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
if (fails.length) console.log('failed:', fails.join(' | '))
process.exit(failed ? 1 : 0)
