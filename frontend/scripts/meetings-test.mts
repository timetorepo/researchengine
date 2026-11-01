/**
 * Meetings round — the rules a browser test would otherwise be the only check for.
 *
 *  1. Time stamps: clock text, and the timed transcript with lost-audio lines in order.
 *  2. Gap ledger: a microphone that stops is recorded as a span, closed at the end
 *     of the meeting, and a zero-length stop is not recorded at all.
 *  3. Resampling: 48 kHz speech comes out at 16 kHz with the same length of time.
 *  4. Notes prompt: typed notes come first, lost spans are named, and the template
 *     sections are the only sections asked for.
 *
 * Run: npm run meetings-test --workspace frontend
 */
import { clock, timedText, GapLedger, resampleTo16k, joinText, timeline } from '../src/lib/meetings/model.ts'
import { notesPrompt, templateOf, TEMPLATES } from '../src/lib/meetings/templates.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('1. Time stamps')
check('under an hour: m:ss', clock(65) === '1:05', clock(65))
check('past an hour: h:mm:ss', clock(3725) === '1:02:05', clock(3725))
check('negative clamps to zero', clock(-4) === '0:00', clock(-4))
const segs = [
  { id: 'b', startSec: 40, endSec: 60, text: ' second part ' },
  { id: 'a', startSec: 0, endSec: 20, text: 'first part' },
]
check('segments join in array order, trimmed', joinText(segs) === 'second part first part', JSON.stringify(joinText(segs)))
const gap = { startSec: 25, endSec: 35, reason: 'the microphone stopped' }
const lines = timedText(segs, [gap]).split('\n')
check('timed text is in time order with the gap between', lines.length === 3 && lines[0].startsWith('[0:00]') && lines[1].startsWith('[0:25] (audio missing until 0:35') && lines[2].startsWith('[0:40]'), lines.join(' | '))
check('timeline sorts by start', timeline(segs, [gap]).map((r) => r.at).join(',') === '0,25,40')

console.log('2. Gap ledger')
const g = new GapLedger('the microphone stopped')
g.begin(30)
g.begin(31) // a second loss while one is open does not move the start
const closed = g.close(45)
check('one gap, from the first loss to the end', closed.length === 1 && closed[0].startSec === 30 && closed[0].endSec === 45, JSON.stringify(closed))
const z = new GapLedger('x')
z.begin(10)
check('zero-length gap is dropped', z.close(10).length === 0)
const open = new GapLedger('x')
check('nothing open, nothing recorded', open.close(5).length === 0)
const two = new GapLedger('x')
two.begin(5); two.end(8); two.begin(20)
const got = two.close(30)
check('two losses are two gaps', got.length === 2 && got[1].endSec === 30, JSON.stringify(got))

console.log('3. Resampling')
const rate = 48000
const input = new Float32Array(rate) // one second of 48 kHz
for (let i = 0; i < input.length; i++) input[i] = Math.sin((2 * Math.PI * 440 * i) / rate)
const out = resampleTo16k(input, rate)
check('one second in is one second out', Math.abs(out.length - 16000) <= 1, `${out.length}`)
check('same rate is returned unchanged', resampleTo16k(input.subarray(0, 100), 16000).length === 100)
check('values stay within the input range', out.every((v) => Math.abs(v) <= 1.0001))

console.log('4. Notes prompt')
const p = notesPrompt({
  title: 'Interview with Ana',
  memo: 'Ask about pricing',
  template: templateOf('interview'),
  segments: segs,
  transcript: joinText(segs),
  gaps: [gap],
})
check('typed notes are in the prompt', p.prompt.includes('Ask about pricing'))
check('typed notes come before the transcript', p.prompt.indexOf('Ask about pricing') < p.prompt.indexOf('Timed transcript'))
check('lost span is named', p.prompt.includes('0:25 to 0:35'))
check('template sections are asked for', templateOf('interview').sections.every((s) => p.prompt.includes(`## ${s}`)))
check('no sections from other templates', !p.prompt.includes('## Decisions'))
check('unknown template falls back to general', templateOf('nope' as any).id === 'general')
check('every template has sections', TEMPLATES.every((t) => t.sections.length > 0))
const none = notesPrompt({ title: 't', memo: '  ', template: templateOf('general'), segments: [], transcript: 'hello', gaps: [] })
check('no typed notes says so', none.prompt.includes('No notes were typed'))
check('no segments falls back to the plain transcript', none.prompt.includes('"""hello"""'))

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
