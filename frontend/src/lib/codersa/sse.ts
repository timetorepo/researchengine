/**
 * A small server-sent-events reader for the harness turn stream.
 *
 * It reads a fetch body incrementally, never holds more than `maxBuffer`
 * characters of an unfinished line, and stops cleanly when the caller aborts.
 * Events are delivered one at a time, in order, with their parsed JSON data.
 */
export interface SseEvent {
  event: string
  data: unknown
}

export const SSE_MAX_BUFFER = 256 * 1024

export async function* readSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  maxBuffer = SSE_MAX_BUFFER,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  const onAbort = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (line === '') {
          if (data.length) {
            const raw = data.join('\n')
            data = []
            let parsed: unknown = raw
            try { parsed = JSON.parse(raw) } catch { /* keep the text */ }
            yield { event, data: parsed }
          }
          event = 'message'
        } else if (line.startsWith(':')) {
          // A comment or keep-alive.
        } else if (line.startsWith('event:')) {
          event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''))
        }
      }
      if (buffer.length > maxBuffer) throw new Error('The stream sent an overlong line.')
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    try { reader.releaseLock() } catch { /* already released */ }
  }
}
