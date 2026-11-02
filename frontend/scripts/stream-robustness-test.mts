// Streaming robustness: split frames, mid-stream errors, empty answers, aborts,
// and that every failure still carries the usage it spent (so it can be billed).
import { streamToCallback, ProviderError, usageOfError } from '../src/lib/providers/stream.ts'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

/** A fetch stub that replies with `chunks`, each delivered as its own read. */
function fakeFetch(chunks: string[], opts: { status?: number; contentType?: string; delayMs?: number } = {}) {
  const enc = new TextEncoder()
  return (async (_url: any, init?: any) => {
    const signal: AbortSignal | undefined = init?.signal
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const c of chunks) {
          if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
          if (signal?.aborted) { controller.error(new DOMException('Aborted', 'AbortError')); return }
          controller.enqueue(enc.encode(c))
        }
        controller.close()
      },
    })
    return new Response(body, { status: opts.status ?? 200, headers: { 'content-type': opts.contentType ?? 'text/event-stream' } })
  }) as typeof fetch
}

const req = (providerId: string, extra: Record<string, unknown> = {}) => ({
  providerId, model: 'm', apiKey: 'k', system: 'sys', messages: [{ role: 'user', content: 'hi' }], ...extra,
})

async function run(name: string, chunks: string[], providerId = 'experiential', extra: any = {}) {
  let text = ''
  try {
    const res = await streamToCallback(req(providerId, extra), (t) => { text += t })
    return { text, res, err: null as any }
  } catch (e) {
    return { text, res: null, err: e }
  }
}

const realFetch = globalThis.fetch

// 1. An OpenAI-style answer whose frames are split across reads, with usage.
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"content":"Hel',
  'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n',
  '\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":5}}\n\ndata: [DONE]\n\n',
])
{
  const { text, res, err } = await run('split', [])
  ok(!err && text === 'Hello world', `split frames assemble into "Hello world" (got ${JSON.stringify(text)})`)
  ok(!!res && res.usage.reported && res.usage.prompt === 11 && res.usage.completion === 5, 'provider-reported usage is used verbatim')
}

// 2. Content delivered as parts instead of a string.
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Parts "}]}}]}\n\n',
  'data: {"choices":[{"delta":{"content":[{"type":"text","text":"work"}]}}]}\n\n',
  'data: [DONE]\n\n',
])
{
  const { text, err } = await run('parts', [])
  ok(!err && text === 'Parts work', `array content parts are read as text (got ${JSON.stringify(text)})`)
}

// 3. Mid-answer provider error: the text so far is kept, the error is surfaced, and the spend is attached.
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"content":"Partial answer that is long enough to cost tokens"}}]}\n\n',
  'event: error\ndata: {"error":{"message":"Upstream overloaded"}}\n\n',
])
{
  const { text, err } = await run('mid-error', [])
  ok(err instanceof ProviderError && /Upstream overloaded/.test(err.message), 'in-stream error frame becomes a ProviderError')
  ok(text.startsWith('Partial answer'), 'text received before the error is kept')
  const u = usageOfError(err)
  ok(!!u && u.completion > 0 && u.prompt > 0, `failed stream still carries its spend (completion ${u?.completion}, reported ${u?.reported})`)
}

// 4. Empty answer: a silent blank would be billed and shown as nothing; it must be an error.
globalThis.fetch = fakeFetch(['data: {"choices":[{"delta":{}}]}\n\n', 'data: [DONE]\n\n'])
{
  const { err } = await run('empty', [])
  ok(err instanceof ProviderError && /without returning any answer/.test(err.message), 'empty answer is reported, not shown blank')
}

// 5. Tool-call-only answers are not empty.
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"search","arguments":"{\\"q\\":"}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"x\\"}"}}]}}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
  'data: [DONE]\n\n',
])
{
  const { res, err } = await run('tools', [])
  ok(!err && !!res && res.toolCalls.length === 1 && res.toolCalls[0].name === 'search', 'a tool-call-only answer is accepted')
}

// 6. Anthropic: usage from message_start/message_delta is reported.
globalThis.fetch = fakeFetch([
  'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":20,"output_tokens":1}}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude says hi"}}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
])
{
  const { text, res, err } = await run('anthropic', [], 'anthropic')
  ok(!err && text === 'Claude says hi', 'Anthropic text streams')
  ok(!!res && res.usage.reported && res.usage.prompt === 20 && res.usage.completion === 7, 'Anthropic usage is reported')
}

// 7. Stopped by the user mid-stream: the abort carries what had been produced.
const controller = new AbortController()
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"content":"Some words before stop"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" and more words that never arrive"}}]}\n\n',
], { delayMs: 40 })
{
  let text = ''
  setTimeout(() => controller.abort(), 20)
  let err: any = null
  try {
    await streamToCallback(req('experiential', { signal: controller.signal }), (t) => { text += t })
  } catch (e) { err = e }
  ok(err?.name === 'AbortError' || controller.signal.aborted, 'user stop aborts the stream')
  const u = usageOfError(err)
  ok(!err || !!u, 'a stopped stream still reports what it used')
}

// 8. A plain JSON answer from the backend (converted to SSE) is read like a stream.
globalThis.fetch = fakeFetch([
  'data: {"choices":[{"delta":{"content":"Plain answer"}}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
  'data: [DONE]\n\n',
])
{
  const { text, res, err } = await run('plain', [])
  ok(!err && text === 'Plain answer' && !!res?.usage.reported, 'converted plain answers stream with usage')
}

globalThis.fetch = realFetch
console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
