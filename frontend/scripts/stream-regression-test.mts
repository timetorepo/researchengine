/**
 * Regression suite for the answer-streaming path and the citation audit.
 *
 * Covers the bugs found while investigating "the bot stops streaming":
 *  - Shaping "off" queued every chunk after the first, so the visible text froze.
 *  - The SSE reader dropped an event that ended without a trailing newline,
 *    kept an `event:` name across events, and swallowed in-stream errors.
 *  - The watchdog only guarded the first token, so a mid-answer stall hung.
 *  - The citation audit kept invented [n] numbers inside multi-number groups.
 *  - Inline [n] markers did not link to their source.
 *
 * Run from frontend/:  node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/stream-regression-test.mts
 */
import { auditCitations } from '../src/lib/rag/audit.ts'
import { streamToCallback, ProviderError } from '../src/lib/providers/stream.ts'
import { createFlowRun } from '../src/lib/flow/engine.ts'
import { linkCitations } from '../src/components/chat/Markdown.tsx'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`) }
}

/** A fetch stub that streams the given frames (strings), then closes. */
function stubFetch(frames: string[], delayMs = 0) {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const f of frames) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
        controller.enqueue(enc.encode(f))
      }
      if (!delayMs) controller.close()
    },
  })
  globalThis.fetch = (async () => new Response(body, { status: 200 })) as typeof fetch
}

const baseReq = {
  providerId: 'openai', model: 'gpt-test', apiKey: 'k', system: '', messages: [{ role: 'user', content: 'hi' }],
}
const frame = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`

async function main() {
  console.log('\n[citation audit]')
  const a1 = auditCitations('x [1, 99, 2].', 3)
  check('keeps valid numbers, removes an invented one in the middle of a group', a1.text === 'x [1, 2].' && a1.removed === 1, a1.text)
  const a2 = auditCitations('x [99, 1, 2].', 3)
  check('does not drop a valid number at the start of a group', a2.text === 'x [1, 2].', a2.text)
  check('leaves all-valid groups untouched', auditCitations('x [1, 2, 3].', 3).text === 'x [1, 2, 3].')
  check('removes a wholly invented marker', auditCitations('x [4].', 3).text === 'x .' && auditCitations('x [4].', 3).removed === 1)

  console.log('\n[inline citation links]')
  const sources = [{ url: 'https://a.org/x' }, { url: 'https://b.org/(y)' }]
  const linked = linkCitations('Fact [1] and [2], not [3]. Code `[1]`', sources)
  check('[n] becomes a link to source n', linked.includes('[1](https://a.org/x)') && linked.includes('[2](https://b.org/%28y%29)'), linked)
  check('a marker with no source stays plain', linked.includes('not [3].'))
  check('inline code is not rewritten', linked.includes('`[1]`'))
  check('no sources means no change', linkCitations('a [1]', undefined) === 'a [1]')

  console.log('\n[SSE reader]')
  stubFetch([frame('Hel'), frame('lo'), 'data: ' + JSON.stringify({ choices: [{ delta: { content: ' world' } }] })]) // last frame: no trailing newline
  let got = ''
  await streamToCallback({ ...baseReq, timeoutMs: 5000 }, (t) => { got += t })
  check('delivers a final frame that has no trailing newline', got === 'Hello world', JSON.stringify(got))

  stubFetch([frame('ok '), 'data: ' + JSON.stringify({ error: { message: 'rate limited mid-stream' } }) + '\n\n'])
  let err: any = null
  try { await streamToCallback({ ...baseReq, timeoutMs: 5000 }, () => {}) } catch (e) { err = e }
  check('an in-stream error frame is raised, not swallowed', err instanceof ProviderError && /rate limited/.test(err.message), String(err?.message))

  stubFetch(['event: ping\n\n', frame('A'), 'event: message_stop\ndata: {"type":"message_stop"}\n\n'])
  got = ''
  await streamToCallback({ ...baseReq, timeoutMs: 5000 }, (t) => { got += t })
  check('a stream with event lines still delivers its text', got === 'A', JSON.stringify(got))

  console.log('\n[watchdog]')
  // Two frames, then silence well past the 3s patience: must fail loudly, not hang.
  // Like a real fetch, an abort on the signal errors the body stream.
  const enc = new TextEncoder()
  globalThis.fetch = (async (_url: any, init: any) => new Response(new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(frame('partial ')))
      init?.signal?.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')))
    },
  }), { status: 200 })) as typeof fetch
  let stallErr: any = null
  let stallGot = ''
  const t0 = Date.now()
  try { await streamToCallback({ ...baseReq, timeoutMs: 3000 }, (t) => { stallGot += t }) } catch (e) { stallErr = e }
  const took = Date.now() - t0
  check('a mid-answer stall ends with an error instead of hanging', stallErr instanceof ProviderError && /stopped sending mid-answer/.test(stallErr.message), String(stallErr?.message))
  check('the text received before the stall is kept', stallGot === 'partial ', JSON.stringify(stallGot))
  check('the stall is detected within the patience window', took < 9000, `${took}ms`)

  console.log('\n[pacer, shaping off]')
  const rendered: string[] = []
  let done = false
  const run = createFlowRun({ shaping: 'off', sensitivity: 0.5, punctuationPauses: true, boost: true },
    (t) => rendered.push(t), { onComplete: () => { done = true } })
  run.begin()
  run.ingest('one ')
  run.ingest('two ')
  run.ingest('three')
  check('every chunk reaches the screen with shaping off', rendered.join('') === 'one two three', JSON.stringify(rendered))
  run.endRaw()
  check('the run completes when the stream ends with shaping off', done)

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) { console.log('Failures:', fails.join('; ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
