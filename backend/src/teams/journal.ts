/** Offline Teams durability primitive. Not an authorization or networking API. */
import { open, mkdir, readFile, unlink } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

export type TeamOperation = { id: string; actor: string; kind: string; payload: unknown }
export type JournalEntry = { version: 1; sequence: number; previous: string; operation: TeamOperation }
export type Receipt = { sequence: number; digest: string }
const aad = Buffer.from('researchengine-teams-journal-v1')
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
function validate(value: TeamOperation) {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'payload') || ['id', 'actor', 'kind'].some(key => typeof value[key as keyof TeamOperation] !== 'string' || !(value[key as keyof TeamOperation] as string).trim())) throw new Error('Invalid operation identity')
  // Require exact JSON data: callers must not lose undefined fields, dates or non-finite numbers.
  const seen = new Set<object>()
  const visit = (v: unknown): void => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return
    if (typeof v !== 'object' || seen.has(v)) throw new Error('Operation must contain finite, acyclic JSON data')
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype) throw new Error('Operation must contain plain JSON data')
    if (Object.getOwnPropertySymbols(v).length || (Array.isArray(v) && Object.keys(v).length !== v.length)) throw new Error('Unsupported JSON properties or sparse array')
    seen.add(v); for (const child of Object.values(v)) visit(child); seen.delete(v)
  }
  visit(value)
}
function seal(value: JournalEntry, key: Buffer): Buffer {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(aad)
  return Buffer.concat([nonce, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()])
}
function unseal(bytes: Buffer, key: Buffer): JournalEntry {
  if (bytes.length < 29) throw new Error('Truncated encrypted record')
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
  cipher.setAAD(aad); cipher.setAuthTag(bytes.subarray(-16))
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8'))
}
async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

export class TeamJournal {
  private entries: JournalEntry[] = []
  private receipts = new Map<string, { json: string; receipt: Receipt }>()
  private tail = '0'.repeat(64)
  private queue: Promise<unknown> = Promise.resolve()
  private poisoned = false
  private closed = false
  private constructor(private directory: string, private key: Buffer, private file: FileHandle, private lock: FileHandle) {}

  /** Caller supplies a separately protected, journal-specific 32-byte host key; it is never stored here. */
  static async open(directory: string, suppliedKey: Buffer): Promise<TeamJournal> {
    if (suppliedKey.length !== 32) throw new Error('A 32-byte host key is required')
    const key = Buffer.from(suppliedKey)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    // Never steal a lock based on PID/time. Offline operator recovery is required after a crash.
    const lock = await open(join(directory, 'writer.lock'), 'wx', 0o600)
    let file: FileHandle | undefined
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); await lock.sync()
      file = await open(join(directory, 'operations.log'), 'a+', 0o600)
      await file.sync(); await syncDirectory(directory)
      const journal = new TeamJournal(directory, key, file, lock)
      const bytes = await readFile(join(directory, 'operations.log'))
      const boundary = bytes.lastIndexOf(10) + 1
      // Only an incomplete non-newline tail may be discarded. Authenticated complete records never are.
      for (const line of bytes.subarray(0, boundary).toString('utf8').split('\n').slice(0, -1)) {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(line)) throw new Error('Invalid journal encoding')
        const encrypted = Buffer.from(line, 'base64')
        if (encrypted.toString('base64') !== line) throw new Error('Noncanonical journal encoding')
        const entry = unseal(encrypted, key)
        validate(entry.operation)
        if (entry.version !== 1 || entry.sequence !== journal.entries.length + 1 || entry.previous !== journal.tail || journal.receipts.has(entry.operation.id)) throw new Error('Journal sequence/hash/identity mismatch')
        journal.remember(entry, hash(encrypted))
      }
      if (boundary !== bytes.length) { await file.truncate(boundary); await file.sync() }
      return journal
    } catch (error) {
      await file?.close(); await lock.close(); await unlink(join(directory, 'writer.lock')); key.fill(0); throw error
    }
  }
  private remember(entry: JournalEntry, digest: string): Receipt {
    const receipt = { sequence: entry.sequence, digest }
    this.entries.push(entry); this.tail = digest
    this.receipts.set(entry.operation.id, { json: JSON.stringify(entry.operation), receipt })
    return { ...receipt }
  }
  replay(): JournalEntry[] { return structuredClone(this.entries) }
  append(operation: TeamOperation): Promise<Receipt> {
    // Clone before queueing: the caller cannot mutate an operation awaiting disk.
    if (this.closed) return Promise.reject(new Error('Journal closed'))
    let cloned: TeamOperation
    try { validate(operation); cloned = structuredClone(operation) } catch (error) { return Promise.reject(error) }
    const job = this.queue.then(async () => {
      if (this.poisoned) throw new Error('Journal closed or requires recovery')
      const existing = this.receipts.get(cloned.id)
      if (existing) {
        if (existing.json !== JSON.stringify(cloned)) throw new Error('Operation ID reused with different content')
        return { ...existing.receipt }
      }
      const entry: JournalEntry = { version: 1, sequence: this.entries.length + 1, previous: this.tail, operation: cloned }
      const encrypted = seal(entry, this.key)
      try {
        await this.file.writeFile(encrypted.toString('base64') + '\n')
        await this.file.sync() // Receipt cannot resolve before durable flush succeeds.
      } catch (error) { this.poisoned = true; throw error }
      return this.remember(entry, hash(encrypted))
    })
    this.queue = job.catch(() => undefined)
    return job
  }
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true; await this.queue
    try { await this.file.close() } finally {
      this.key.fill(0); await this.lock.close(); await unlink(join(this.directory, 'writer.lock')); await syncDirectory(this.directory)
    }
  }
}
