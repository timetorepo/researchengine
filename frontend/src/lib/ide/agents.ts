/**
 * Parallel agents, without the collisions.
 *
 * Codex runs several agents at once and so does this: each task gets its own
 * id, its own chat, and — on the server — its own copy of the project under
 * `<data>/worktrees/<project>/<agent>`. Nothing an agent writes is visible to
 * the other agents or to you until it is merged, and the merge is checked
 * against the fork point: if you (or another agent) touched the same file in
 * the meantime, the merge is refused and that agent's version is kept aside
 * instead of overwriting your work.
 *
 * The store is deliberately small and lives outside React so a task keeps
 * running while you navigate away — background generation, the way Cursor
 * does it, with the same live story when you come back.
 */
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { runChat, isStreamingChat, stopStream } from '@/lib/chat/runChat'
import type { IdeActivity } from '@/lib/chat/tools'

export type TaskStatus = 'forking' | 'running' | 'ready' | 'merged' | 'conflict' | 'failed' | 'discarded'
export type Handoff = 'local' | 'cloud'

export interface ActivityLine extends IdeActivity {
  id: string
}

export interface ChangedFile {
  path: string
  kind: 'added' | 'modified' | 'deleted'
  added: number
  removed: number
  /** Accepted for merge; the review pane flips this. */
  accepted: boolean
  base?: string
}

export interface AgentTask {
  id: string
  title: string
  prompt: string
  project: string
  chatId: string
  status: TaskStatus
  handoff: Handoff
  /** Files the task said it would work on (its claim, from the prompt). */
  claim: string[]
  activity: ActivityLine[]
  changes: ChangedFile[]
  summary?: string
  error?: string
  startedAt: number
  finishedAt?: number
}

interface AgentState {
  tasks: AgentTask[]
  /** File → the task currently writing it. Two agents never share a path here. */
  locks: Record<string, string>
  spawn: (opts: { title: string; prompt: string; project: string; claim?: string[]; model?: string; handoff?: Handoff; design?: boolean }) => Promise<string | null>
  activity: (line: IdeActivity, chatId?: string) => void
  setStatus: (id: string, status: TaskStatus, patch?: Partial<AgentTask>) => void
  refreshChanges: (id: string) => Promise<void>
  toggleAccepted: (id: string, path: string, accepted?: boolean) => void
  merge: (id: string) => Promise<{ ok: boolean; summary: string; conflicts: string[] }>
  discard: (id: string) => Promise<void>
  stop: (id: string) => void
  clearFinished: () => void
}

const forkApi = (project: string, agent: string) =>
  fetch('/api/ide/agents/fork', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project, agent }),
  }).then((r) => r.json())

export const useAgents = create<AgentState>((set, get) => ({
  tasks: [],
  locks: {},

  spawn: async ({ title, prompt, project, claim = [], model, handoff = 'local', design }) => {
    const id = `agent-${nanoid(6).toLowerCase().replace(/[^a-z0-9-]/g, '')}`
    const chatId = useStore.getState().newChat()
    const task: AgentTask = {
      id, title, prompt, project, chatId, status: 'forking', handoff, claim,
      activity: [], changes: [], startedAt: Date.now(),
    }
    // Claim the paths up front so the UI can show who is touching what. With
    // per-agent working copies a claim is not a lock on writing (the copies are
    // separate) — it is the map of what will need merging.
    set((s) => ({
      tasks: [task, ...s.tasks],
      locks: claim.reduce((acc, p) => ({ ...acc, [`${project}:${p}`]: id }), s.locks),
    }))

    const fork = await forkApi(project, id)
    if (!fork?.ok) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'failed', error: fork?.error ?? 'Could not create the agent working copy.' } : t)),
      }))
      return null
    }

    useStore.getState().renameChat?.(chatId, `⚙ ${title}`)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'running' } : t)) }))

    // The run is fire-and-forget, so it can land after the user has already
    // discarded or merged this task. Only a task that is still open may move
    // on — otherwise a discarded agent comes back to life as "ready".
    const stillOpen = (t: AgentTask) => t.status === 'running' || t.status === 'forking'

    // Fire and forget: the run keeps going while you are on another page.
    void runChat({
      chatId,
      prompt,
      project,
      agent: id,
      design,
      modelOverride: model,
      preamble: [
        'You are one of several agents working in parallel on this project.',
        `Your working copy is private (agent ${id}); edits land in the shared project only when the user merges them.`,
        'Work in small, complete steps and say what you changed and why. Prefer reading before writing.',
        handoff === 'cloud' ? 'This task was handed off to a cloud model by the user.' : '',
      ].filter(Boolean).join(' '),
    }).then(async () => {
      const wasOpen = stillOpen(get().tasks.find((t) => t.id === id) ?? ({ status: 'discarded' } as AgentTask))
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && stillOpen(t) ? { ...t, status: 'ready', finishedAt: Date.now() } : t)) }))
      if (!wasOpen) return
      await get().refreshChanges(id)
      // Background work announces itself — you may be on another page.
      const done = get().tasks.find((t) => t.id === id)
      useUI.getState().toast(
        'Agent finished',
        done?.changes.length
          ? `${title} — ${done.changes.length} file(s) ready to review. Open the Agents tab to merge.`
          : `${title} — finished without changing a file.`,
        done?.changes.length ? 'success' : 'info',
      )
    }).catch((e: any) => {
      const wasOpen = stillOpen(get().tasks.find((t) => t.id === id) ?? ({ status: 'discarded' } as AgentTask))
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && stillOpen(t) ? { ...t, status: 'failed', error: String(e?.message ?? e), finishedAt: Date.now() } : t)) }))
      if (wasOpen) useUI.getState().toast('Agent failed', `${title} — ${String(e?.message ?? e)}`, 'danger')
    })

    return id
  },

  activity: (line, chatId) => {
    const at = line.at ?? Date.now()
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.status !== 'running' && t.status !== 'forking') return t
        if (chatId && t.chatId !== chatId) return t
        if (!chatId && line.agent !== t.id) return t
        const entry: ActivityLine = { ...line, at, id: nanoid(6) }
        return { ...t, activity: [...t.activity.slice(-120), entry] }
      }),
    }))
  },

  setStatus: (id, status, patch) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, ...patch } : t)),
  })),

  refreshChanges: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    try {
      const res = await fetch(`/api/ide/agents/changes?project=${encodeURIComponent(task.project)}&agent=${encodeURIComponent(task.id)}`)
      const data = await res.json()
      const changes: ChangedFile[] = (data.changes ?? []).map((c: any) => ({ ...c, accepted: true }))
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, changes, summary: data.summary ?? t.summary } : t)) }))
    } catch { /* the review pane simply stays empty */ }
  },

  toggleAccepted: (id, path, accepted) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id
      ? { ...t, changes: t.changes.map((c) => (c.path === path ? { ...c, accepted: accepted ?? !c.accepted } : c)) }
      : t)),
  })),

  merge: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return { ok: false, summary: 'Unknown task.', conflicts: [] }
    const files = task.changes.filter((c) => c.accepted).map((c) => c.path)
    if (!files.length) return { ok: false, summary: 'Nothing selected to merge.', conflicts: [] }
    const res = await fetch('/api/ide/agents/merge', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: task.project, agent: task.id, files }),
    })
    const data = await res.json()
    const conflicts: string[] = (data.conflicts ?? []).map((c: any) => c.path)
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id
        ? {
          ...t,
          status: conflicts.length ? 'conflict' : 'merged',
          changes: t.changes.filter((c) => !(data.merged ?? []).includes(c.path)),
          summary: data.summary ?? t.summary,
          activity: [...t.activity, { id: nanoid(6), at: Date.now(), agent: id, project: t.project, kind: conflicts.length ? 'error' : 'write', note: data.summary ?? 'merged' }],
        }
        : t)),
      locks: Object.fromEntries(Object.entries(s.locks).filter(([k, v]) => v !== id)),
    }))
    window.dispatchEvent(new CustomEvent('re:ide-changed', { detail: { project: task.project } }))
    useUI.getState().toast(
      conflicts.length ? 'Merged with conflicts' : 'Agent merged',
      String(data.summary ?? ''),
      conflicts.length ? 'info' : 'success',
    )
    return { ok: !!data.ok, summary: String(data.summary ?? ''), conflicts }
  },

  discard: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    if (isStreamingChat(task.chatId)) stopStream(task.chatId)
    await fetch('/api/ide/agents/discard', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: task.project, agent: task.id }),
    }).catch(() => {})
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'discarded', finishedAt: Date.now() } : t)),
      locks: Object.fromEntries(Object.entries(s.locks).filter(([k, v]) => v !== id)),
    }))
    useUI.getState().toast('Agent discarded', `${task.title} — its working copy is gone; the project is untouched.`, 'info')
  },

  stop: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    stopStream(task.chatId)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'ready', finishedAt: Date.now() } : t)) }))
    void get().refreshChanges(id)
  },

  clearFinished: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status === 'running' || t.status === 'forking' || t.status === 'ready' || t.status === 'conflict') })),
}))

/* ------------------------------------------------------------------ */
/* Live activity wiring                                                */
/* ------------------------------------------------------------------ */

let wired = false

/** Bridge the tools' activity events into whatever is listening. */
export function subscribeActivity(fn: (line: IdeActivity) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const h = (e: Event) => fn((e as CustomEvent).detail as IdeActivity)
  window.addEventListener('re:agent-activity', h)
  return () => window.removeEventListener('re:agent-activity', h)
}

/** Called once by the app: agent tasks collect every tool call they make. */
export function wireAgentActivity() {
  if (wired || typeof window === 'undefined') return
  wired = true
  subscribeActivity((line) => {
    if (!line.agent) return
    useAgents.getState().activity(line, undefined)
  })
}

/** Human sentence for one activity line — the Cursor-style verb. */
export function describeActivity(a: IdeActivity): { verb: string; detail?: string } {
  switch (a.kind) {
    case 'read': return { verb: 'Read', detail: a.bytes ? `${Math.max(1, Math.round(a.bytes / 40))} lines` : undefined }
    case 'write': return { verb: a.created ? 'Created' : 'Edited', detail: a.added || a.removed ? `+${a.added ?? 0} −${a.removed ?? 0}` : undefined }
    case 'run': return { verb: 'Ran', detail: a.note }
    case 'search': return { verb: 'Searched', detail: a.note }
    case 'list': return { verb: 'Explored the project', detail: a.note }
    case 'error': return { verb: 'Hit a problem', detail: a.note }
    default: return { verb: 'Working', detail: a.note }
  }
}
