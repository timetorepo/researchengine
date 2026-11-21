/** Offline v1 Teams protocol, not a CRDT, permission check or private-Board importer. */
import {validateSharedBoardItems as validateItems} from '../../../shared/teams/board'
import type { JournalEntry, TeamOperation } from './journal'
import type { TeamSnapshot } from './objects'
import { isAccessKind, validateAccessOperation, reduceAccess, requireEditor, type AccessOperation, type AccessState } from './access'

export type TeamItem = {
  id: string; kind: 'note'|'reference'|'image'|'pdf'|'drawing'|'shape'|'connector'|'frame'
  x: number; y: number; width: number; height: number; text: string
  textFormat?: 'markdown'; shape?: 'rectangle'|'ellipse'|'diamond'; pointSpace?: 'unit'
  attachmentId?: string; source?: { url?: string; page?: number }; parentId?: string
  points?: { x: number; y: number }[]; fromId?: string; toId?: string
}
export type TeamBoard = { id: string; revision: number; title: string; items: TeamItem[] }
export type TeamLink = { boardId: string; revision: number; itemId?: string }
export type TeamPost = { id: string; threadId: string; actor: string; sequence: number; text: string; attachments: string[]; links: TeamLink[] }
export type TeamState = { schemaVersion: 1; sequence: number; access?: AccessState; boards: TeamBoard[]; posts: TeamPost[]; requiredAttachments: string[] }
export type BoardReplace = { boardId: string; expectedRevision: number; title: string; items: TeamItem[] }
export type BackChatPost = { id: string; threadId: string; text: string; attachments: string[]; links: TeamLink[] }
export type TypedTeamOperation = AccessOperation | (TeamOperation & ({ kind: 'team.board.replace.v1'; payload: BoardReplace } | { kind: 'team.backchat.post.v1'; payload: BackChatPost }))
const fail = (message: string): never => { throw new Error(message) }
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const attachment = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function record(v: unknown, required: string[], optional: string[] = []): asserts v is Record<string, any> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype || required.some(key => !Object.hasOwn(v, key)) || Reflect.ownKeys(v).some(key => typeof key !== 'string' || ![...required, ...optional].includes(key) || !Object.getOwnPropertyDescriptor(v, key)?.enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(v, key)!, 'value'))) fail('Invalid or unsupported protocol fields')
}
function list(v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v) || Reflect.ownKeys(v).length !== v.length + 1 || Object.keys(v).length !== v.length || Object.keys(v).some((key, i) => key !== String(i) || !Object.hasOwn(Object.getOwnPropertyDescriptor(v,key)!, 'value'))) fail('Invalid protocol array')
}
export function validateTeamOperation(operation: unknown): asserts operation is TypedTeamOperation {
  record(operation, ['id','actor','kind','payload'])
  if (!id(operation.id) || !id(operation.actor)) fail('Invalid operation identity')
  if (isAccessKind(operation.kind)) { validateAccessOperation(operation); return }
  const payload = operation.payload
  if (operation.kind === 'team.board.replace.v1') {
    record(payload,['boardId','expectedRevision','title','items'])
    if (!id(payload.boardId) || !integer(payload.expectedRevision) || payload.expectedRevision >= Number.MAX_SAFE_INTEGER || typeof payload.title !== 'string') fail('Invalid Board revision/title')
    validateItems(payload.items)
  } else if (operation.kind === 'team.backchat.post.v1') {
    record(payload,['id','threadId','text','attachments','links'])
    if (!id(payload.id) || !id(payload.threadId) || typeof payload.text !== 'string') fail('Invalid BackChat post')
    list(payload.attachments); list(payload.links)
    if (payload.attachments.some(value => !attachment(value)) || new Set(payload.attachments).size !== payload.attachments.length) fail('Invalid BackChat attachments')
    for (const link of payload.links) { record(link,['boardId','revision'],['itemId']); if (!id(link.boardId) || !integer(link.revision) || link.revision < 1 || (Object.hasOwn(link,'itemId') && !id(link.itemId))) fail('Invalid BackChat link') }
    if (!payload.text.trim() && !payload.attachments.length && !payload.links.length) fail('Empty BackChat post')
  } else fail('Unsupported Teams operation/version')
}
export function emptyTeamState(): TeamState { return { schemaVersion: 1, sequence: 0, boards: [], posts: [], requiredAttachments: [] } }
/** Internal reducer is only fed a state produced by this module. No mutation of inputs. */
function apply(state: TeamState, entry: JournalEntry, available: ReadonlySet<string>): TeamState {
  if (entry.version !== 1 || entry.sequence !== state.sequence + 1 || !attachment(entry.previous)) fail('Invalid replay sequence/envelope')
  validateTeamOperation(entry.operation)
  const operation = structuredClone(entry.operation), next = structuredClone(state), references = new Set(next.requiredAttachments)
  if (isAccessKind(operation.kind)) {
    validateAccessOperation(operation); if(operation.kind==='team.access.recover.v1'&&operation.payload.checkpoint.digest!==entry.previous)fail('Recovery predecessor digest mismatch'); next.access = reduceAccess(next.access,operation,entry.sequence); next.sequence = entry.sequence; return next
  }
  if (next.access) requireEditor(next.access,operation.actor)
  if (operation.kind === 'team.board.replace.v1') {
    const payload = operation.payload, index = next.boards.findIndex(board => board.id === payload.boardId)
    if ((index < 0 ? 0 : next.boards[index].revision) !== payload.expectedRevision) fail('Board revision conflict')
    const board: TeamBoard = { id: payload.boardId, revision: payload.expectedRevision + 1, title: payload.title, items: payload.items }
    if (index < 0) next.boards.push(board); else next.boards[index] = board
    next.boards.sort((a,b) => order(a.id,b.id))
    for (const item of payload.items) if (item.attachmentId) references.add(item.attachmentId)
  } else if (operation.kind === 'team.backchat.post.v1') {
    const payload = operation.payload
    if (next.posts.some(post => post.id === payload.id)) fail('Duplicate BackChat post identity')
    for (const link of payload.links) {
      const board = next.boards.find(board => board.id === link.boardId)
      if (!board || board.revision !== link.revision || (link.itemId && !board.items.some(item => item.id === link.itemId))) fail('BackChat link must target the current recorded Board revision/item')
    }
    next.posts.push({ ...payload, actor: operation.actor, sequence: entry.sequence })
    payload.attachments.forEach(value => references.add(value))
  } else fail('Unsupported content operation')
  for (const reference of references) if (!available.has(reference)) fail('History references a missing attachment')
  next.sequence = entry.sequence; next.requiredAttachments = [...references].sort(order)
  return next
}
export function replayTeam(entries: JournalEntry[], available: ReadonlySet<string>): TeamState {
  let state = emptyTeamState(); const ids = new Set<string>()
  for (const entry of entries) {
    if (ids.has(entry.operation.id)) fail('Duplicate operation in history')
    state = apply(state,entry,available); ids.add(entry.operation.id)
  }
  return state
}
/** Canonical JSON comparison ignores object property insertion order, never array order. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  return '{' + Object.keys(value).sort(order).map(key => JSON.stringify(key)+':'+canonical((value as Record<string, unknown>)[key])).join(',') + '}'
}
export function validateTeamHistory(entries: JournalEntry[], snapshots: TeamSnapshot[], available: ReadonlySet<string>): TeamState {
  // Validate every prefix referenced by a snapshot, including sequence zero. Full history is authoritative.
  const targets = new Map<number, TeamSnapshot[]>()
  for (const snapshot of snapshots) {
    if (!integer(snapshot.checkpoint.sequence) || snapshot.checkpoint.sequence > entries.length) fail('Snapshot beyond history')
    targets.set(snapshot.checkpoint.sequence, [...(targets.get(snapshot.checkpoint.sequence) ?? []), snapshot])
  }
  let state = emptyTeamState(); const ids = new Set<string>()
  const check = () => { for (const snapshot of targets.get(state.sequence) ?? []) {
    if (canonical(snapshot.state) !== canonical(state) || canonical([...snapshot.attachments].sort(order)) !== canonical(state.requiredAttachments)) fail('Snapshot state/attachments differ from deterministic replay')
  } }
  check()
  for (const entry of entries) {
    if (ids.has(entry.operation.id)) fail('Duplicate operation in history')
    state = apply(state,entry,available); ids.add(entry.operation.id); check()
  }
  return state
}
