/**
 * The thread as the user sees it, built either from the harness log (a session
 * reopened later) or from live turn events (while a turn runs). Both paths
 * share the same rules, so a live thread and a reloaded one look the same.
 */
import type { SseEvent } from './sse'

export type ToolStatus = 'running' | 'done' | 'refused'

export type ToolItem = { kind: 'tool'; id: string; name: string; args: string; output?: string; status: ToolStatus }

export type Item =
  | { kind: 'user'; id: string; at?: number; text: string }
  | { kind: 'assistant'; id: string; at?: number; text: string }
  | ToolItem
  | { kind: 'error'; id: string; text: string }
  | { kind: 'stopped'; id: string }

/** A log event as the server stores it. Only the fields the thread needs. */
export interface LogEvent {
  i: number
  t: number
  type: 'header' | 'user' | 'assistant' | 'tool' | 'error' | 'stopped'
  content?: string
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  toolCallId?: string
  name?: string
}

/** The thread keeps this many items on screen; older ones stay in the log. */
export const MAX_ITEMS = 400
/** Tool output shown in the DOM. The server already clips what it stores. */
export const TOOL_OUTPUT_CHARS = 12_000

/** Refusals start with one of these phrases (see backend/src/harness/tools.ts). */
const REFUSAL = /^(Shell is off|This session has no|Refused|Refusing|Not run|This tool is not|That tool is not)/

export function isRefusal(output: string): boolean {
  return REFUSAL.test(output)
}

let seq = 0
export function newId(prefix: string): string {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`
}

/** Rebuild the thread from a full log. Tool results are matched by call id. */
export function itemsFromLog(events: LogEvent[]): Item[] {
  const out: Item[] = []
  const byCall = new Map<string, ToolItem>()
  for (const e of events) {
    if (e.type === 'user') {
      out.push({ kind: 'user', id: `e${e.i}`, at: e.i, text: e.content ?? '' })
    } else if (e.type === 'assistant') {
      if (e.content) out.push({ kind: 'assistant', id: `e${e.i}`, at: e.i, text: e.content })
      for (const c of e.toolCalls ?? []) {
        const item: ToolItem = { kind: 'tool', id: `c${c.id}`, name: c.name, args: c.arguments, status: 'running' }
        byCall.set(c.id, item)
        out.push(item)
      }
    } else if (e.type === 'tool') {
      const output = e.content ?? ''
      const status: ToolStatus = isRefusal(output) ? 'refused' : 'done'
      const item = e.toolCallId ? byCall.get(e.toolCallId) : undefined
      if (item) { item.output = output; item.status = status }
      else out.push({ kind: 'tool', id: `e${e.i}`, name: e.name ?? 'tool', args: '', output, status })
    } else if (e.type === 'error') {
      out.push({ kind: 'error', id: `e${e.i}`, text: e.content ?? 'Something went wrong.' })
    } else if (e.type === 'stopped') {
      out.push({ kind: 'stopped', id: `e${e.i}` })
    }
  }
  return out
}

/**
 * Fold one live turn event into the thread. Returns a new array and never
 * mutates the old one, so React only re-renders the items that changed.
 */
export function applyLive(items: Item[], ev: SseEvent): Item[] {
  const data = (ev.data && typeof ev.data === 'object' ? ev.data : {}) as Record<string, unknown>
  switch (ev.event) {
    case 'assistant': {
      const text = String(data.content ?? '')
      return text ? [...items, { kind: 'assistant', id: newId('a'), text }] : items
    }
    case 'tool_call':
      return [...items, { kind: 'tool', id: newId('t'), name: String(data.name ?? 'tool'), args: String(data.arguments ?? ''), status: 'running' }]
    case 'tool_result': {
      const name = String(data.name ?? '')
      const output = String(data.content ?? '')
      const idx = findRunning(items, name)
      if (idx < 0) return items
      const next = items.slice()
      const prev = next[idx] as ToolItem
      next[idx] = { ...prev, output, status: isRefusal(output) ? 'refused' : 'done' }
      return next
    }
    case 'error':
      return [...items, { kind: 'error', id: newId('x'), text: String(data.message ?? 'Something went wrong.') }]
    case 'stopped':
      return [...items, { kind: 'stopped', id: newId('s') }]
    default:
      return items
  }
}

/** The oldest call still waiting for a result with this name: results come back in call order. */
function findRunning(items: Item[], name: string): number {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'tool' && it.status === 'running' && it.name === name) return i
  }
  return -1
}

/** Keep the newest items when a thread is long. Returns how many were left out. */
export function windowItems(items: Item[], limit = MAX_ITEMS): { shown: Item[]; hidden: number } {
  if (items.length <= limit) return { shown: items, hidden: 0 }
  const hidden = items.length - limit
  return { shown: items.slice(hidden), hidden }
}

/** Clip long tool output for the DOM. The full text stays in the log. */
export function clipOutput(text: string, max = TOOL_OUTPUT_CHARS): { text: string; clipped: number } {
  if (text.length <= max) return { text, clipped: 0 }
  const head = Math.floor(max * 0.7)
  const tail = max - head
  return {
    text: `${text.slice(0, head)}\n… ${text.length - max} characters left out …\n${text.slice(-tail)}`,
    clipped: text.length - max,
  }
}

/** A one-line summary of a tool call's arguments, for the card header. */
export function summarizeArgs(name: string, args: string): string {
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(args) as Record<string, unknown> } catch { return args.slice(0, 160) }
  if (name === 'bash') return String(parsed.command ?? '').slice(0, 200)
  if (name === 'str_replace_editor') return `${String(parsed.command ?? '')} ${String(parsed.path ?? '')}`.trim()
  if (name === 'read_file' || name === 'list_files') return String(parsed.path ?? '.')
  return args.slice(0, 160)
}
