/**
 * Codersa's logic, checked without a browser:
 *  1. The SSE reader handles events split across chunks, CRLF, comments, and abort.
 *  2. A reloaded log and a live turn pair tool calls with their results the same way.
 *  3. Refusals are recognised from the backend's wording.
 *  4. Long threads and long tool output stay bounded.
 *
 * Run: npm run codersa-test --workspace frontend
 */
import assert from 'node:assert/strict'
import { readSse, SSE_MAX_BUFFER } from '../src/lib/codersa/sse'
import { itemsFromLog, applyLive, windowItems, clipOutput, summarizeArgs, MAX_ITEMS, TOOL_OUTPUT_CHARS, type Item, type LogEvent } from '../src/lib/codersa/timeline'

let passed = 0
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn()
  passed++
  console.log(`  ok  ${name}`)
}

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

async function collect(chunks: string[], signal?: AbortSignal) {
  const out: { event: string; data: unknown }[] = []
  for await (const ev of readSse(streamOf(chunks), signal)) out.push(ev)
  return out
}

console.log('SSE reader')

await check('an event split across chunks is reassembled', async () => {
  const events = await collect(['event: assi', 'stant\ndata: {"content":"he', 'llo"}\n\n'])
  assert.deepEqual(events, [{ event: 'assistant', data: { content: 'hello' } }])
})

await check('CRLF line endings and keep-alive comments are handled', async () => {
  const events = await collect([': keep-alive\r\nevent: end\r\ndata: {"outcome":"done"}\r\n\r\n'])
  assert.deepEqual(events, [{ event: 'end', data: { outcome: 'done' } }])
})

await check('multiple events in one chunk keep their order', async () => {
  const events = await collect(['event: start\ndata: {"a":1}\n\nevent: tool_call\ndata: {"name":"bash"}\n\n'])
  assert.deepEqual(events.map((e) => e.event), ['start', 'tool_call'])
})

await check('text that is not JSON is passed through as text', async () => {
  const events = await collect(['data: plain words\n\n'])
  assert.deepEqual(events, [{ event: 'message', data: 'plain words' }])
})

await check('an overlong unfinished line is refused, not buffered forever', async () => {
  const huge = 'x'.repeat(SSE_MAX_BUFFER + 10)
  await assert.rejects(collect([huge]), /overlong line/)
})

await check('aborting the signal stops the reader', async () => {
  const controller = new AbortController()
  const enc = new TextEncoder()
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(c) { c.enqueue(enc.encode('event: assistant\ndata: {"content":"a"}\n\n')) },
    cancel() { cancelled = true },
  })
  const seen: string[] = []
  const run = (async () => { for await (const ev of readSse(body, controller.signal)) { seen.push(ev.event); controller.abort() } })()
  await run.catch(() => {})
  assert.equal(seen.length, 1)
  assert.equal(cancelled, true)
})

console.log('Thread')

const log: LogEvent[] = [
  { i: 1, t: 1, type: 'user', content: 'fix the test' },
  { i: 2, t: 2, type: 'assistant', content: 'Looking.', toolCalls: [{ id: 'c1', name: 'bash', arguments: '{"command":"npm test"}' }] },
  { i: 3, t: 3, type: 'tool', toolCallId: 'c1', name: 'bash', content: 'Shell is off for this session. Ask the user to allow shell before running commands.' },
  { i: 4, t: 4, type: 'assistant', content: 'Shell was off, so I stopped.' },
  { i: 5, t: 5, type: 'stopped' },
]

await check('a reloaded log pairs each tool call with its result by call id', () => {
  const items = itemsFromLog(log)
  const tool = items.find((x) => x.kind === 'tool')
  assert.ok(tool && tool.kind === 'tool')
  assert.equal(tool.status, 'refused')
  assert.match(tool.output ?? '', /Shell is off/)
  assert.equal(items.length, 5, 'user, assistant, tool, assistant, stopped')
})

await check('a live turn pairs results with calls in order, per tool name', () => {
  let items: Item[] = []
  items = applyLive(items, { event: 'tool_call', data: { name: 'read_file', arguments: '{"path":"a"}' } })
  items = applyLive(items, { event: 'tool_call', data: { name: 'read_file', arguments: '{"path":"b"}' } })
  items = applyLive(items, { event: 'tool_result', data: { name: 'read_file', content: 'A' } })
  const tools = items.filter((x): x is Extract<Item, { kind: 'tool' }> => x.kind === 'tool')
  assert.equal(tools[0].output, 'A', 'the first call gets the first result')
  assert.equal(tools[0].status, 'done')
  assert.equal(tools[1].status, 'running', 'the second call is still waiting')
})

await check('applyLive never mutates the array it was given', () => {
  const before: Item[] = [{ kind: 'user', id: 'u', text: 'hi' }]
  const snapshot = JSON.stringify(before)
  const after = applyLive(before, { event: 'assistant', data: { content: 'hello' } })
  assert.equal(JSON.stringify(before), snapshot)
  assert.equal(after.length, 2)
})

await check('an empty assistant event adds nothing', () => {
  const before: Item[] = []
  assert.equal(applyLive(before, { event: 'assistant', data: { content: '' } }), before)
})

await check('an error event becomes an error item with its message', () => {
  const items = applyLive([], { event: 'error', data: { type: 'error', message: 'rate limited' } })
  assert.deepEqual(items.map((x) => x.kind === 'error' && x.text), ['rate limited'])
})

await check('a long thread shows its newest items and says how many are hidden', () => {
  const many: Item[] = Array.from({ length: MAX_ITEMS + 25 }, (_, n) => ({ kind: 'user', id: `u${n}`, text: String(n) }))
  const { shown, hidden } = windowItems(many)
  assert.equal(hidden, 25)
  assert.equal(shown.length, MAX_ITEMS)
  assert.equal(shown[0].kind === 'user' && shown[0].text, '25', 'the oldest shown item is the 26th')
})

console.log('Output and arguments')

await check('long tool output is clipped, keeping its start and end', () => {
  const text = 'a'.repeat(TOOL_OUTPUT_CHARS) + 'MIDDLE' + 'z'.repeat(500)
  const { text: out, clipped } = clipOutput(text)
  assert.ok(out.length < text.length)
  assert.ok(out.startsWith('aaa'))
  assert.ok(out.endsWith('zzz'))
  assert.equal(clipped, text.length - TOOL_OUTPUT_CHARS)
})

await check('short output is returned as it is', () => {
  assert.deepEqual(clipOutput('ok'), { text: 'ok', clipped: 0 })
})

await check('a bash call shows its command; a bad argument string is shown as text', () => {
  assert.equal(summarizeArgs('bash', '{"command":"npm test"}'), 'npm test')
  assert.equal(summarizeArgs('str_replace_editor', '{"command":"view","path":"src/a.ts"}'), 'view src/a.ts')
  assert.equal(summarizeArgs('bash', 'not json'), 'not json')
})

console.log(`\n${passed} passed, 0 failed`)
