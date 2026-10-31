/**
 * Sessions as an append-only log: one JSON Lines file per session.
 *
 * Every turn appends events and never rewrites them, so a session can be
 * resumed, forked at any event, searched, and replayed exactly as it happened.
 * The log holds what was said and done. It never holds an API key: `append`
 * refuses any event carrying a key-looking field.
 */
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { definePlugin } from './kernel'

export type EventType = 'header' | 'user' | 'assistant' | 'tool' | 'error' | 'stopped'

export interface SessionEvent {
  /** Position in the log, from 0. */
  i: number
  t: number
  type: EventType
  content?: string
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  toolCallId?: string
  name?: string
  /** For a header: the mode and workspace the session was created with. */
  profile?: string
  workspace?: string | null
  title?: string
  forkedFrom?: { id: string; at: number }
}

export interface SessionSummary {
  id: string
  title: string
  profile: string
  createdAt: number
  updatedAt: number
  events: number
  forkedFrom?: { id: string; at: number }
}

export interface SessionStore {
  dir: string
  create(opts: { profile: string; workspace: string | null; title?: string }): Promise<SessionSummary>
  append(id: string, event: Omit<SessionEvent, 'i' | 't'>): Promise<SessionEvent>
  read(id: string): Promise<SessionEvent[]>
  list(): Promise<SessionSummary[]>
  fork(id: string, at: number): Promise<SessionSummary>
  search(query: string, limit?: number): Promise<Array<{ id: string; title: string; i: number; snippet: string }>>
  remove(id: string): Promise<void>
}

const ID = /^[0-9a-f-]{36}$/
/** Field names that must never reach the log. */
const SECRET_FIELD = /(^|_|[a-z])(key|token|secret|password|authorization)$/i

export function createSessionStore(dataDir: string): SessionStore {
  const dir = join(dataDir, 'harness', 'sessions')
  /** Events per session, so appends know their index without reading the file. */
  const counts = new Map<string, number>()

  const pathFor = (id: string) => {
    if (!ID.test(id)) throw new Error('invalid session id')
    return join(dir, `${id}.jsonl`)
  }

  const readEvents = async (id: string): Promise<SessionEvent[]> => {
    const raw = await readFile(pathFor(id), 'utf8').catch(() => '')
    return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l) as SessionEvent)
  }

  const summarize = (id: string, events: SessionEvent[]): SessionSummary => {
    const head = events[0]
    const last = events[events.length - 1]
    return {
      id,
      title: head?.title || 'Untitled session',
      profile: head?.profile || 'minimal',
      createdAt: head?.t ?? 0,
      updatedAt: last?.t ?? head?.t ?? 0,
      events: events.length,
      forkedFrom: head?.forkedFrom,
    }
  }

  const store: SessionStore = {
    dir,
    async create({ profile, workspace, title }) {
      await mkdir(dir, { recursive: true })
      const id = randomUUID()
      const header = await store.append(id, { type: 'header', profile, workspace, title: title?.slice(0, 120) || 'New session' } as any)
      return summarize(id, [header])
    },

    async append(id, event) {
      for (const k of Object.keys(event)) {
        if (SECRET_FIELD.test(k)) throw new Error(`refusing to log a secret-looking field "${k}"`)
      }
      await mkdir(dir, { recursive: true })
      // The next index is cached per session, so a long session does not re-read its whole log per event.
      let n = counts.get(id)
      if (n === undefined) n = (await readEvents(id).catch(() => [])).length
      const full = { ...event, i: n, t: Date.now() } as SessionEvent
      await appendFile(pathFor(id), JSON.stringify(full) + '\n', 'utf8')
      counts.set(id, n + 1)
      return full
    },

    read: (id) => readEvents(id),

    async list() {
      const names = await readdir(dir).catch(() => [] as string[])
      const out: SessionSummary[] = []
      for (const n of names) {
        const id = n.replace(/\.jsonl$/, '')
        if (!ID.test(id)) continue
        out.push(summarize(id, await readEvents(id)))
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async fork(id, at) {
      const events = await readEvents(id)
      if (!events.length) throw new Error('no such session')
      if (at < 0 || at >= events.length) throw new Error('fork point is outside the session')
      const head = events[0]
      const newId = randomUUID()
      await mkdir(dir, { recursive: true })
      const header = {
        i: 0, t: Date.now(), type: 'header' as const, profile: head.profile, workspace: head.workspace ?? null,
        title: `Fork of ${head.title ?? 'session'}`.slice(0, 120), forkedFrom: { id, at },
      }
      const copied = events.slice(0, at + 1).slice(1).map((e, n) => ({ ...e, i: n + 1 }))
      await writeFile(pathFor(newId), [header, ...copied].map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
      counts.set(newId, copied.length + 1)
      return summarize(newId, [header as SessionEvent, ...copied])
    },

    async search(query, limit = 20) {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const out: Array<{ id: string; title: string; i: number; snippet: string }> = []
      for (const s of await store.list()) {
        for (const e of await readEvents(s.id)) {
          const text = e.content ?? ''
          const at = text.toLowerCase().indexOf(q)
          if (at < 0) continue
          out.push({ id: s.id, title: s.title, i: e.i, snippet: text.slice(Math.max(0, at - 60), at + q.length + 60) })
          if (out.length >= limit) return out
        }
      }
      return out
    },

    async remove(id) {
      counts.delete(id)
      await rm(pathFor(id), { force: true })
    },
  }
  return store
}

export function sessionsPlugin(dataDir: string) {
  return definePlugin({
    name: 'sessions',
    apply(ctx) {
      ctx.provide<SessionStore>('sessions', createSessionStore(dataDir))
    },
  })
}
