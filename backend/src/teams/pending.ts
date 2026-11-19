/** Offline durable client outbox. Transport is supplied explicitly; nothing opens a connection. */
import { randomUUID } from 'node:crypto'
import { TeamJournal, type JournalEntry, type Receipt } from './journal'
import { TeamObjects } from './objects'
import { validateTeamOperation, type TypedTeamOperation } from './replay'

export type QueueBinding = { team: string; client: string; actor: string }
export type PendingItem = { operation: TypedTeamOperation; status: 'pending'|'acknowledged'|'conflict'|'superseded'; attempts: number; message?: string; receipt?: Receipt; replacedBy?: string }
export type DispatchResult = { type: 'ack'; operationId: string; receipt: Receipt } | { type: 'conflict'; operationId: string; message: string }
export type QueueTransport = (operation: TypedTeamOperation, signal: AbortSignal) => Promise<DispatchResult>
export type DrainResult = { status: 'idle'|'blocked'|'deferred'|'stopped'; acknowledged: number; operationId?: string }
type Event = { kind: 'queue.enqueue.v1'; payload: { operation: TypedTeamOperation } } | { kind: 'queue.attempt.v1'; payload: { id: string } } | { kind: 'queue.ack.v1'; payload: { id: string; receipt: Receipt } } | { kind: 'queue.defer.v1'|'queue.conflict.v1'; payload: { id: string; message: string } } | { kind: 'queue.replace.v1'; payload: { id: string; operation: TypedTeamOperation } }
function fields(value: unknown, names: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== names.length || names.some(name => !Object.hasOwn(value,name) || !Object.getOwnPropertyDescriptor(value,name)?.enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(value,name)!, 'value'))) throw new Error('Invalid queue record fields')
}
function validateBinding(binding: QueueBinding) {
  fields(binding,['team','client','actor'])
  if (Object.values(binding).some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value))) throw new Error('Invalid queue scope')
}
function validateReceipt(receipt: Receipt) {
  fields(receipt,['sequence','digest'])
  if (!Number.isSafeInteger(receipt.sequence) || receipt.sequence < 1 || typeof receipt.digest !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.digest) || receipt.digest === '0'.repeat(64)) throw new Error('Invalid host receipt')
}
function validateForActor(operation: unknown, actor: string): asserts operation is TypedTeamOperation {
  validateTeamOperation(operation)
  if (operation.actor !== actor) throw new Error('Queued operation actor differs from client scope')
}
function originals(operation: TypedTeamOperation): string[] {
  return operation.kind === 'team.board.replace.v1' ? [...new Set(operation.payload.items.flatMap(item => item.attachmentId ? [item.attachmentId] : []))] : [...operation.payload.attachments]
}
function reduce(items: PendingItem[], event: Event, actor: string): PendingItem[] {
  const next = structuredClone(items)
  if (event.kind === 'queue.enqueue.v1') {
    fields(event.payload,['operation']); validateForActor(event.payload.operation,actor)
    if (next.some(item => item.operation.id === event.payload.operation.id)) throw new Error('Duplicate queued operation identity')
    next.push({ operation: structuredClone(event.payload.operation), status: 'pending', attempts: 0 }); return next
  }
  const expected = event.kind === 'queue.replace.v1' ? ['id','operation'] : event.kind === 'queue.ack.v1' ? ['id','receipt'] : ['queue.defer.v1','queue.conflict.v1'].includes(event.kind) ? ['id','message'] : ['id']
  fields(event.payload, expected)
  const index = next.findIndex(item => item.operation.id === event.payload.id), item = next[index]
  if (!item) throw new Error('Queue event refers to missing operation')
  if (event.kind === 'queue.replace.v1') {
    if (item.status !== 'conflict') throw new Error('Only a retained conflict can be replaced')
    validateForActor(event.payload.operation,actor)
    if (next.some(value => value.operation.id === event.payload.operation.id)) throw new Error('Replacement needs a new operation identity')
    item.status = 'superseded'; item.replacedBy = event.payload.operation.id
    next.splice(index + 1,0,{ operation: structuredClone(event.payload.operation), status: 'pending', attempts: 0 }); return next
  }
  if (next.find(value => value.status === 'pending' || value.status === 'conflict')?.operation.id !== item.operation.id) throw new Error('Queue event bypasses FIFO head')
  if (item.status !== 'pending') throw new Error('Queue result/attempt has invalid status')
  if (event.kind === 'queue.attempt.v1') {
    if (item.attempts >= Number.MAX_SAFE_INTEGER) throw new Error('Attempt counter exhausted')
    item.attempts++; delete item.message
  } else {
    if (!item.attempts) throw new Error('Result without durable attempt')
    if (event.kind === 'queue.ack.v1') { validateReceipt(event.payload.receipt); item.status = 'acknowledged'; item.receipt = { ...event.payload.receipt }; delete item.message }
    else if (event.kind === 'queue.defer.v1' || event.kind === 'queue.conflict.v1') {
      if (typeof event.payload.message !== 'string' || !event.payload.message.trim()) throw new Error('Queue result needs a message')
      item.message = event.payload.message
      if (event.kind === 'queue.conflict.v1') item.status = 'conflict'
    } else throw new Error('Unsupported queue event')
  }
  return next
}
function replay(entries: JournalEntry[], binding: QueueBinding): PendingItem[] {
  if (!entries.length) throw new Error('Missing queue binding')
  const first = entries[0].operation
  if (first.kind !== 'queue.bind.v1' || first.actor !== binding.actor) throw new Error('Invalid queue binding record')
  validateBinding(first.payload as QueueBinding)
  const saved = first.payload as QueueBinding
  if (saved.team !== binding.team || saved.client !== binding.client || saved.actor !== binding.actor) throw new Error('Queue belongs to a different team/client/actor')
  let items: PendingItem[] = []
  for (const entry of entries.slice(1)) {
    if (entry.operation.actor !== binding.actor || !['queue.enqueue.v1','queue.attempt.v1','queue.ack.v1','queue.defer.v1','queue.conflict.v1','queue.replace.v1'].includes(entry.operation.kind)) throw new Error('Unsupported queue event/actor')
    items = reduce(items,entry.operation as Event,binding.actor)
  }
  return items
}
/** Abort is local: a host may have committed despite a lost response. Retrying preserves the ID. */
async function send(transport: QueueTransport, operation: TypedTeamOperation, signal: AbortSignal): Promise<DispatchResult> {
  if (signal.aborted) throw new Error('Dispatch stopped; host outcome may be unknown')
  let abort!: () => void
  const stopped = new Promise<never>((_,reject) => { abort = () => reject(new Error('Dispatch stopped; host outcome may be unknown')); signal.addEventListener('abort',abort,{once:true}) })
  try { return await Promise.race([transport(structuredClone(operation),signal),stopped]) }
  finally { signal.removeEventListener('abort',abort) }
}
export class PendingQueue {
  private items: PendingItem[] = []
  private serial: Promise<unknown> = Promise.resolve()
  private running?: Promise<DrainResult>
  private controller?: AbortController
  private recoveryRequired = false
  private closing = false
  private closeResult?: Promise<void>
  private constructor(private journal: TeamJournal, private binding: QueueBinding, private objects: TeamObjects) {}
  static async open(directory: string, key: Buffer, binding: QueueBinding, objects: TeamObjects): Promise<PendingQueue> {
    validateBinding(binding)
    if (objects.teamId !== binding.team) throw new Error('Object store belongs to a different team')
    binding = structuredClone(binding)
    const journal = await TeamJournal.open(directory,key)
    try {
      if (!journal.replay().length) await journal.append({ id: randomUUID(), actor: binding.actor, kind: 'queue.bind.v1', payload: binding })
      const queue = new PendingQueue(journal,binding,objects); queue.items = replay(journal.replay(),binding); return queue
    } catch (error) { await journal.close(); throw error }
  }
  view(): PendingItem[] { return structuredClone(this.items) }
  private ordered<T>(work: () => Promise<T>): Promise<T> {
    const result = this.serial.then(() => { if (this.recoveryRequired) throw new Error('Queue requires recovery'); return work() }); this.serial = result.catch(() => undefined); return result
  }
  private async commit(event: Event): Promise<void> {
    const next = reduce(this.items,event,this.binding.actor)
    try { await this.journal.append({ id: randomUUID(), actor: this.binding.actor, ...event }) }
    catch (error) { this.recoveryRequired = true; throw error }
    this.items = next // Only visible/dispatchable after durable flush.
  }
  private async checkOriginals(operation: TypedTeamOperation) { for (const id of originals(operation)) await this.objects.getAttachment(id) }
  enqueue(operation: TypedTeamOperation): Promise<void> {
    if (this.closing) return Promise.reject(new Error('Queue closed'))
    try { validateForActor(operation,this.binding.actor); operation = structuredClone(operation) } catch (error) { return Promise.reject(error) }
    return this.ordered(async () => {
      const existing = this.items.find(item => item.operation.id === operation.id)
      if (existing) {
        if (JSON.stringify(existing.operation) !== JSON.stringify(operation)) throw new Error('Operation ID reused with different content')
        return // Local retry is idempotent in every disposition; never resurrect acknowledged work.
      }
      await this.checkOriginals(operation); await this.commit({kind:'queue.enqueue.v1',payload:{operation}})
    })
  }
  replaceConflict(id: string, operation: TypedTeamOperation): Promise<void> {
    if (this.closing) return Promise.reject(new Error('Queue closed'))
    try { validateForActor(operation,this.binding.actor); operation = structuredClone(operation) } catch (error) { return Promise.reject(error) }
    return this.ordered(async () => { await this.checkOriginals(operation); await this.commit({kind:'queue.replace.v1',payload:{id,operation}}) })
  }
  drain(transport: QueueTransport, signal?: AbortSignal): Promise<DrainResult> {
    if (this.closing) return Promise.reject(new Error('Queue closed'))
    if (this.running) return this.running
    const controller = new AbortController(), stop = () => controller.abort(); this.controller = controller
    signal?.addEventListener('abort',stop,{once:true}); if (signal?.aborted) stop()
    const run = async (): Promise<DrainResult> => {
      let acknowledged = 0
      while (!controller.signal.aborted) {
        const item = await this.ordered(async () => {
          const head = this.items.find(value => value.status === 'pending' || value.status === 'conflict')
          if (!head || head.status === 'conflict') return head ? structuredClone(head) : undefined
          await this.commit({kind:'queue.attempt.v1',payload:{id:head.operation.id}}); return structuredClone(head)
        })
        if (!item) return {status:'idle',acknowledged}
        const id = item.operation.id
        if (item.status === 'conflict') return {status:'blocked',acknowledged,operationId:id}
        let result: DispatchResult
        try {
          await this.checkOriginals(item.operation)
          result = structuredClone(await send(transport,item.operation,controller.signal))
          if (controller.signal.aborted) throw new Error('Dispatch stopped; host outcome may be unknown')
          if (result?.operationId !== id) throw new Error('Host response operation identity mismatch')
          if (result.type === 'ack') { fields(result,['type','operationId','receipt']); validateReceipt(result.receipt) }
          else if (result.type === 'conflict') { fields(result,['type','operationId','message']); if (typeof result.message !== 'string' || !result.message.trim()) throw new Error('Invalid conflict response') }
          else throw new Error('Unsupported host response')
        } catch (error) {
          await this.ordered(() => this.commit({kind:'queue.defer.v1',payload:{id,message:error instanceof Error && error.message ? error.message : 'Dispatch failed; host outcome unknown'}}))
          return {status:controller.signal.aborted?'stopped':'deferred',acknowledged,operationId:id}
        }
        if (result.type === 'conflict') {
          await this.ordered(() => this.commit({kind:'queue.conflict.v1',payload:{id,message:result.message}}))
          return {status:'blocked',acknowledged,operationId:id}
        }
        await this.ordered(() => this.commit({kind:'queue.ack.v1',payload:{id,receipt:result.receipt}})); acknowledged++
      }
      return {status:'stopped',acknowledged}
    }
    this.running = run().finally(() => { signal?.removeEventListener('abort',stop); this.running = undefined; this.controller = undefined })
    return this.running
  }
  stop() { this.controller?.abort() }
  close(): Promise<void> {
    if (this.closeResult) return this.closeResult
    this.closing = true; this.stop()
    this.closeResult = (async () => {
      let failure: unknown
      try { await this.running } catch (error) { failure = error }
      await this.serial; await this.journal.close()
      if (failure) throw failure
    })()
    return this.closeResult
  }
}
