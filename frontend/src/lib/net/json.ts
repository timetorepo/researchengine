/**
 * Reading a JSON answer from the local server — and saying what happened when it
 * is not JSON.
 *
 * The bug this exists for: the Library asked the server for a search and was
 * told "the local server answered /api/library/search?q=javascript&refresh=1
 * with something that was not JSON." That sentence is true and useless. The
 * response was the app's own index.html with a 200, which means the server that
 * answered was a build without that route — the UI and the server were
 * different versions — and nothing in the message said so.
 *
 * A response that is not JSON has to describe itself: what the content type
 * actually was, whether it was the app shell, whether the body was empty, and
 * what to do about it. Guessing is what produced the original message.
 */

export class NotJsonError extends Error {
  status: number
  contentType: string
  /** What kind of thing came back, when it can be told apart. */
  kind: 'html-shell' | 'html-other' | 'empty' | 'truncated' | 'text' | 'binary'
  constructor(message: string, opts: { status: number; contentType: string; kind: NotJsonError['kind'] }) {
    super(message)
    this.name = 'NotJsonError'
    this.status = opts.status
    this.contentType = opts.contentType
    this.kind = opts.kind
  }
}

const snippet = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 140)

/**
 * Parse a Response as JSON. Throws a `NotJsonError` whose message is a sentence
 * the UI can print as-is — the same standard the rest of the app holds itself
 * to. Never throws a bare `Unexpected token`.
 */
export async function readJsonResponse<T = any>(res: Response, url: string, opts: { retryHint?: string } = {}): Promise<T> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  const where = `the local server's answer to ${url}`
  const retry = opts.retryHint ? ` ${opts.retryHint}` : ''

  let text: string
  try {
    text = await res.text()
  } catch (e) {
    throw new NotJsonError(
      `${where} could not be read — the connection dropped while the body was arriving (${String((e as any)?.message ?? e)}).${retry}`,
      { status: res.status, contentType, kind: 'truncated' },
    )
  }

  const body = text.trim()

  if (!body) {
    throw new NotJsonError(
      `${where} came back empty (HTTP ${res.status}, no body). A server with no route for this path used to answer with the app's HTML page instead; an empty answer usually means the request was cut short.${retry}`,
      { status: res.status, contentType, kind: 'empty' },
    )
  }

  const looksHtml = contentType.includes('html') || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body)
  if (looksHtml) {
    const isShell = /<div id="root"/i.test(body) || /<title>[^<]*research engine/i.test(body)
    throw new NotJsonError(
      isShell
        ? `${where} was the app's own page, not data — so the server that answered does not have this API route. The window and the local server are different versions: restart Research Engine, or install the latest version. (Settings → About shows the server version.)${retry}`
        : `${where} was an HTML page, not data, which is what a proxy or a hosting provider answers when it does not recognise an API route.${retry}`,
      { status: res.status, contentType, kind: isShell ? 'html-shell' : 'html-other' },
    )
  }

  try {
    return JSON.parse(body) as T
  } catch {
    const hint = contentType.includes('json')
      ? 'The header said JSON but the body was cut off — the server probably stopped mid-answer.'
      : `It was ${contentType || 'an unnamed type'}.`
    throw new NotJsonError(
      `${where} was not JSON (HTTP ${res.status}). ${hint} It began: "${snippet(body)}".${retry}`,
      { status: res.status, contentType, kind: contentType.includes('json') ? 'truncated' : contentType.includes('text') ? 'text' : 'binary' },
    )
  }
}

/**
 * A GET that is expected to answer JSON, with the status handled. Kept next to
 * the parser so a caller cannot check the status but skip the body diagnosis.
 */
export async function fetchJson<T = any>(url: string, init?: RequestInit, opts: { retryHint?: string } = {}): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    // An error response is usually JSON ({"error": "…"}); quote the server's own
    // sentence when it has one, and fall back to the parser's diagnosis when it
    // does not.
    const body = await res.text().catch(() => '')
    let sentence = ''
    try {
      const parsed = JSON.parse(body)
      sentence = typeof parsed?.error === 'string' ? parsed.error : ''
      if (!sentence && typeof parsed?.hint === 'string') sentence = parsed.hint
    } catch { /* not JSON — the parser below says what it was */ }
    if (sentence) throw new Error(`HTTP ${res.status} — ${sentence}${opts.retryHint ? ` ${opts.retryHint}` : ''}`)
    const res2 = new Response(body, { status: res.status, headers: res.headers })
    await readJsonResponse(res2, url, opts)
    throw new Error(`HTTP ${res.status}`)
  }
  return readJsonResponse<T>(res, url, opts)
}
