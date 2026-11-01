/**
 * The harness routes, as the browser calls them. Every request is relative, so
 * the app works the same behind the dev proxy, the desktop shell and the web build.
 */
import type { LogEvent } from './timeline'

export interface HarnessProfile { id: 'minimal' | 'standard'; title: string; description: string; tools: string[]; maxSteps: number }

export interface SessionSummary {
  id: string
  title: string
  profile: string
  workspace: string | null
  createdAt: number
  updatedAt: number
  events: number
  forkedFrom?: { id: string; at: number }
}

export interface SearchHit { id: string; title: string; i: number; snippet: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${res.status}).`)
  return body as T
}

export const harnessApi = {
  profiles: () => call<{ profiles: HarnessProfile[] }>('/harness/profiles').then((r) => r.profiles),
  sessions: () => call<{ sessions: SessionSummary[] }>('/harness/sessions').then((r) => r.sessions),
  create: (body: { profile: string; project?: string | null; title?: string }) =>
    call<{ session: SessionSummary }>('/harness/sessions', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.session),
  events: (id: string) => call<{ events: LogEvent[] }>(`/harness/sessions/${id}`).then((r) => r.events),
  remove: (id: string) => call<{ ok: true }>(`/harness/sessions/${id}`, { method: 'DELETE' }),
  fork: (id: string, at: number) =>
    call<{ session: SessionSummary }>(`/harness/sessions/${id}/fork`, { method: 'POST', body: JSON.stringify({ at }) }).then((r) => r.session),
  search: (q: string) => call<{ results: SearchHit[] }>(`/harness/search?q=${encodeURIComponent(q)}`).then((r) => r.results),
  projects: () => call<{ projects: { name: string; files: number; mtime: number; git?: boolean }[] }>('/ide/projects').then((r) => r.projects ?? []),
}

/**
 * Open a turn stream. The caller owns the AbortSignal: aborting it closes the
 * connection, and the server stops the model call and any running command.
 */
export async function openTurn(
  id: string,
  body: { text: string; approve: boolean; model: { base: string; model: string; key: string } },
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`/api/harness/sessions/${id}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof err?.error === 'string' ? err.error : `The turn could not start (${res.status}).`)
  }
  return res.body
}
