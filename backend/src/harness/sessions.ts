/**
 * Sessions as an append-only log: one JSON Lines file per session.
 *
 * Every turn appends events and never rewrites them, so a session can be
 * resumed, forked at any event, searched, and replayed exactly as it happened.
 * The log holds what was said and done. It never holds an API key: `append`
 * refuses any event carrying a key-looking field.
 */
import { appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
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
  /** The project folder the session works in, or null for a chat-only session. */
  workspace: string | null
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
      workspace: head?.workspace ?? null,
      createdAt: head?.t ?? 0,
      updatedAt: last?.t ?? head?.t ?? 0,
      events: events.length,
      forkedFrom: head?.forkedFrom,
    }
  }

  /**
   * The list view's summary without reading the whole log: the header is the
   * first line (parsed alone), the event count is the number of newlines
   * streamed through in fixed-size chunks, and the last-updated time is the
   * file's mtime. Memory stays flat however long the sessions are.
   */
  const summarizeFile = async (id: string): Promise<SessionSummary | null> => {
    const path = pathFor(id)
    const info = await stat(path).catch(() => null)
    if (!info) return null
    let lines = 0
    let first = ''
    let sawFirst = false
    await new Promise<void>((resolve) => {
      const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 64 * 1024 })
      stream.on('data', (chunk: string | Buffer) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        let from = 0
        for (;;) {
          const nl = text.indexOf('\n', from)
          if (nl < 0) break
          if (!sawFirst) { first += text.slice(from, nl); sawFirst = true }
          lines++
          from = nl + 1
        }
        if (!sawFirst && first.length < 16 * 1024) first += text.slice(from)
      })
      stream.on('error', () => resolve())
      stream.on('end', () => {
        // A last line without a trailing newline still counts as an event.
        if (!sawFirst && first) { sawFirst = true; lines = Math.max(lines, 1) }
        resolve()
      })
    })
    let head: SessionEvent | undefined
    try { head = JSON.parse(first) as SessionEvent } catch { head = undefined }
    return {
      id,
      title: head?.title || 'Untitled session',
      profile: head?.profile || 'minimal',
      workspace: head?.workspace ?? null,
      createdAt: head?.t ?? info.birthtimeMs ?? 0,
      // The file's mtime can be coarser than the event clock, so never report an update before the creation.
      updatedAt: Math.max(info.mtimeMs, head?.t ?? 0),
      events: lines,
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
        const summary = await summarizeFile(id)
        if (summary) out.push(summary)
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
