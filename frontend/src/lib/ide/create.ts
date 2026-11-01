/**
 * Creating a project, robustly.
 *
 * There are two ways this used to end in an error message instead of a project:
 *
 *   • the name arrived empty (an old client, a blank field, a name made only of
 *     characters no filesystem can store), and the server refused it;
 *   • the name was taken, or the server was older than the button that called it.
 *
 * Neither is a good reason to leave someone staring at a red toast, so this
 * helper never gives up on the first answer: it retries with a name chosen
 * client-side, and reports the *actual* status and body when everything fails so
 * the next bug report contains a fact instead of a guess.
 */

export interface CreateResponse {
  status: number
  body: any
}

/** Anything that can POST JSON — the real fetch, or a test double. */
export type PostJson = (url: string, payload: unknown) => Promise<CreateResponse>

export interface CreateOutcome {
  ok: boolean
  /** The folder the server actually created. */
  name?: string
  /** Server chose a different name than the one asked for. */
  renamed?: boolean
  /** The server invented a name because the request had none usable. */
  invented?: boolean
  /** Human-readable failure, including the HTTP status. */
  error?: string
  /** How many requests were made — 1 when everything worked first time. */
  attempts: number
}

/** The next free name given what is already on disk: base, base-2, base-3 … */
export function nextFreeName(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()))
  const clean = base.trim() || 'untitled-project'
  if (!used.has(clean.toLowerCase())) return clean
  for (let i = 2; i < 500; i++) {
    const candidate = `${clean}-${i}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${clean}-${Date.now().toString(36)}`
}

const bodyText = (body: any): string => {
  if (!body) return ''
  if (typeof body === 'string') return body
  return String(body.error ?? body.message ?? '')
}

/** Is this failure about the name — i.e. would a different name fix it? */
export function isNameProblem(status: number, body: any): boolean {
  if (status === 409) return true
  const text = bodyText(body).toLowerCase()
  return /name|characters|usable|separator/i.test(text)
}

/**
 * Create a project, retrying with a client-chosen name when the first attempt
 * fails for a reason a different name could fix.
 */
export async function createProjectRobust(
  post: PostJson,
  payload: {
    name: string
    /** What to call it if `name` turns out to be unusable. */
    fallback: string
    files: Record<string, string>
    /** Names already on disk; the retry avoids them. */
    taken: string[]
    /** Ask the server to pick a free name (newer servers). */
    unique?: boolean
  },
): Promise<CreateOutcome> {
  const attempt = async (name: string, forced: boolean): Promise<CreateOutcome> => {
    const res = await post('/api/ide/projects', {
      name,
      files: payload.files,
      unique: payload.unique || forced || undefined,
      fallback: payload.fallback,
    })
    const body = res.body ?? {}
    if (res.status >= 200 && res.status < 300 && body.ok !== false) {
      return {
        ok: true,
        name: body.name ?? name,
        renamed: !!body.renamed || (body.name ?? name) !== name,
        invented: !!body.invented,
        attempts: forced ? 2 : 1,
      }
    }
    return {
      ok: false,
      error: `${res.status}${bodyText(body) ? ` ${bodyText(body)}` : ''}`,
      attempts: forced ? 2 : 1,
    }
  }

  let first: CreateOutcome
  try {
    first = await attempt(payload.name, false)
  } catch (e: any) {
    // The request never reached the server (offline, server down, CORS).
    first = { ok: false, error: `could not reach the server (${String(e?.message ?? e)})`, attempts: 1 }
  }
  if (first.ok) return first

  // A different name only helps when the name is what the server disliked —
  // or when the failure looks like a server too old to understand `unique`.
  const retryName = nextFreeName(payload.name || payload.fallback, payload.taken)
  if (retryName !== payload.name) {
    try {
      const second = await attempt(retryName, true)
      if (second.ok) return { ...second, attempts: 2 }
      return { ...second, error: `${first.error} · then ${second.error}` }
    } catch (e: any) {
      return { ...first, error: `${first.error} · retry failed (${String(e?.message ?? e)})` }
    }
  }
  return first
}

/** The real fetch, shaped for `createProjectRobust`. */
export const postJson: PostJson = async (url, payload) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : {} } catch { /* keep the raw text */ }
  return { status: res.status, body }
}
