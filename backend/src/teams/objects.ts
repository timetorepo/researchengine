/** Immutable offline objects. No HTTP, authorization, key storage, or private-chat access. */
import { open, mkdir, readFile, link, unlink, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import type { Receipt, TeamJournal } from './journal'

export type TeamSnapshot = { version: 1; checkpoint: Receipt; state: unknown; attachments: string[] }
export type ObjectArchive = { version: 1; objects: { kind: Kind; id: string; ciphertext: string }[] }
type Kind = 'attachment' | 'snapshot'
const validId = (id: string) => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)
function json(value: unknown): string {
  const seen = new Set<object>()
  const visit = (v: unknown): void => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return
    if (typeof v !== 'object' || seen.has(v)) throw new Error('Expected finite acyclic JSON')
    if ((!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype) || Object.getOwnPropertySymbols(v).length || (Array.isArray(v) && Object.keys(v).length !== v.length)) throw new Error('Expected plain JSON')
    seen.add(v); Object.values(v).forEach(visit); seen.delete(v)
  }
  visit(value); return JSON.stringify(value)
}
function validateSnapshot(value: TeamSnapshot) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || value.version !== 1 || !value.checkpoint || !Number.isSafeInteger(value.checkpoint.sequence) || value.checkpoint.sequence < 0 || !validId(value.checkpoint.digest) || !Object.hasOwn(value, 'state') || !Array.isArray(value.attachments) || value.attachments.some(id => !validId(id)) || new Set(value.attachments).size !== value.attachments.length) throw new Error('Invalid snapshot')
  json(value)
}
async function syncDirectory(path: string) {
  const file = await open(path, 'r'); try { await file.sync() } finally { await file.close() }
}
export class TeamObjects {
  get teamId(): string { return this.team }
  private constructor(private directory: string, private key: Buffer, private team: string) {}
  /** Key must be dedicated to this team's objects, not its journal. Trusted private local parent only. */
  static async open(directory: string, key: Buffer, team: string, options: { create?: boolean } = {}): Promise<TeamObjects> {
    if (key.length !== 32 || !/^[a-zA-Z0-9_-]{1,128}$/.test(team)) throw new Error('Invalid object key/team identity')
    if (options.create !== false) await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
    await syncDirectory(dirname(directory))
    await syncDirectory(directory)
    return new TeamObjects(directory, Buffer.from(key), team)
  }
  private id(kind: Kind, bytes: Buffer) { return createHmac('sha256', this.key).update(this.team + ':' + kind + ':').update(bytes).digest('hex') }
  private encrypt(kind: string, bytes: Buffer): Buffer {
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, nonce)
    cipher.setAAD(Buffer.from(`re-teams-objects-v1:${this.team}:${kind}`))
    return Buffer.concat([nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()])
  }
  private decrypt(kind: string, bytes: Buffer): Buffer {
    if (bytes.length < 28) throw new Error('Truncated object')
    const cipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12))
    cipher.setAAD(Buffer.from(`re-teams-objects-v1:${this.team}:${kind}`)); cipher.setAuthTag(bytes.subarray(-16))
    return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()])
  }
  private path(kind: Kind, id: string) {
    if (!validId(id)) throw new Error('Invalid object identity')
    return join(this.directory, `${kind}-${id}`)
  }
  private async get(kind: Kind, id: string): Promise<Buffer> {
    const bytes = this.decrypt(kind, await readFile(this.path(kind, id)))
    if (this.id(kind, bytes) !== id) throw new Error('Object identity mismatch')
    return bytes
  }
  private async put(kind: Kind, bytes: Buffer): Promise<string> {
    const id = this.id(kind, bytes), destination = this.path(kind, id)
    const temporary = join(this.directory, `.pending-${randomBytes(16).toString('hex')}`)
    const file = await open(temporary, 'wx', 0o600)
    try {
      try { await file.writeFile(this.encrypt(kind, bytes)); await file.sync() } finally { await file.close() }
      try { await link(temporary, destination) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        // Never replace or silently heal a corrupt existing immutable object.
        if (!(await this.get(kind, id)).equals(bytes)) throw new Error('Conflicting object')
      }
      await syncDirectory(this.directory)
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
    await syncDirectory(this.directory)
    return id
  }
  async putAttachment(bytes: Buffer, maxStoreBytes?:number): Promise<string> {
    if(maxStoreBytes!==undefined){
      if(!Number.isSafeInteger(maxStoreBytes)||maxStoreBytes<1)throw new Error('Invalid attachment store budget')
      const archive=await this.exportArchive(),id=this.id('attachment',bytes)
      // Existing bytes are integrity-validated by exportArchive; dedup consumes no new space.
      if(!archive.objects.some(object=>object.kind==='attachment'&&object.id===id)){
        const used=archive.objects.reduce((sum,object)=>sum+Buffer.from(object.ciphertext,'base64').length,0)
        if(used+bytes.length+28>maxStoreBytes)throw new Error('Attachment store quota exceeded')
      }
    }
    return this.put('attachment', Buffer.from(bytes))
  }
  getAttachment(id: string): Promise<Buffer> { return this.get('attachment', id) }
  async putSnapshot(snapshot: TeamSnapshot, journal: Pick<TeamJournal, 'checkpoint'>): Promise<string> {
    validateSnapshot(snapshot)
    const durable = journal.checkpoint(snapshot.checkpoint.sequence)
    if (durable.digest !== snapshot.checkpoint.digest) throw new Error('Snapshot checkpoint does not match durable journal')
    return this.publishSnapshot(snapshot)
  }
  private async publishSnapshot(snapshot: TeamSnapshot): Promise<string> {
    validateSnapshot(snapshot)
    const copy = JSON.parse(json(snapshot)) as TeamSnapshot
    for (const id of copy.attachments) await this.getAttachment(id)
    return this.put('snapshot', Buffer.from(json(copy)))
  }
  async getSnapshot(id: string): Promise<TeamSnapshot> {
    const snapshot = JSON.parse((await this.get('snapshot', id)).toString('utf8')) as TeamSnapshot
    validateSnapshot(snapshot)
    for (const attachment of snapshot.attachments) await this.getAttachment(attachment)
    return snapshot
  }
  private inspectArchive(archive: ObjectArchive): { kind: Kind; id: string; bytes: Buffer }[] {
    if (!archive || archive.version !== 1 || !Array.isArray(archive.objects)) throw new Error('Invalid object archive')
    const identities = new Set<string>()
    const objects = archive.objects.map(value => {
      if (!value || !['attachment', 'snapshot'].includes(value.kind) || !validId(value.id) || typeof value.ciphertext !== 'string') throw new Error('Invalid archive object')
      const name = `${value.kind}-${value.id}`
      if (identities.has(name)) throw new Error('Duplicate archive object')
      identities.add(name)
      const encrypted = Buffer.from(value.ciphertext, 'base64')
      if (encrypted.toString('base64') !== value.ciphertext) throw new Error('Invalid archive encoding')
      const bytes = this.decrypt(value.kind, encrypted)
      if (this.id(value.kind, bytes) !== value.id) throw new Error('Archive identity mismatch')
      return { kind: value.kind, id: value.id, bytes }
    })
    for (const object of objects) if (object.kind === 'snapshot') {
      const snapshot = JSON.parse(object.bytes.toString('utf8')) as TeamSnapshot
      validateSnapshot(snapshot)
      for (const id of snapshot.attachments) if (!identities.has(`attachment-${id}`)) throw new Error('Archive missing snapshot attachment')
    }
    return objects
  }
  /** Read-only validation without creating directories. */
  static inspectArchive(archive: ObjectArchive, key: Buffer, team: string): TeamSnapshot[] {
    if (key.length !== 32 || !/^[a-zA-Z0-9_-]{1,128}$/.test(team)) throw new Error('Invalid object key/team identity')
    const inspector = new TeamObjects('', key, team)
    return inspector.inspectArchive(archive).filter(value => value.kind === 'snapshot').map(value => JSON.parse(value.bytes.toString('utf8')) as TeamSnapshot)
  }
  /** All committed objects, including unreferenced originals; temporary files are excluded. */
  async exportArchive(): Promise<ObjectArchive> {
    const names = (await readdir(this.directory)).sort()
    const objects: ObjectArchive['objects'] = []
    for (const name of names) {
      if (/^\.pending-/.test(name)) continue
      const match = /^(attachment|snapshot)-([a-f0-9]{64})$/.exec(name)
      if (!match) throw new Error('Unexpected file in dedicated object store')
      objects.push({ kind: match[1] as Kind, id: match[2], ciphertext: (await readFile(join(this.directory, name))).toString('base64') })
    }
    const archive: ObjectArchive = { version: 1, objects }
    this.inspectArchive(archive)
    return archive
  }
  /** Existing store only; unlike open, this does not create or sync directories. */
  static async readArchive(directory: string, key: Buffer, team: string): Promise<ObjectArchive> {
    if (key.length !== 32 || !/^[a-zA-Z0-9_-]{1,128}$/.test(team)) throw new Error('Invalid object key/team identity')
    return new TeamObjects(directory, key, team).exportArchive()
  }
  async importArchive(archive: ObjectArchive): Promise<void> {
    const objects = this.inspectArchive(archive)
    // Validate everything before writes, then publish attachment dependencies first.
    for (const kind of ['attachment', 'snapshot'] as const) for (const object of objects) if (object.kind === kind) await this.put(kind, object.bytes)
  }
  /** A snapshot + its referenced attachments, NOT a full journal/history/key backup. */
  async exportSnapshot(id: string): Promise<Buffer> {
    const snapshot = await this.getSnapshot(id)
    const attachments = await Promise.all(snapshot.attachments.map(async attachment => ({ id: attachment, bytes: (await this.getAttachment(attachment)).toString('base64') })))
    return this.encrypt('backup', Buffer.from(json({ version: 1, id, snapshot, attachments })))
  }
  async importSnapshot(bundle: Buffer): Promise<string> {
    const parsed = JSON.parse(this.decrypt('backup', Buffer.from(bundle)).toString('utf8'))
    if (parsed.version !== 1 || !validId(parsed.id) || !Array.isArray(parsed.attachments)) throw new Error('Invalid snapshot backup')
    validateSnapshot(parsed.snapshot)
    const snapshot = parsed.snapshot as TeamSnapshot
    if (this.id('snapshot', Buffer.from(json(snapshot))) !== parsed.id || parsed.attachments.length !== snapshot.attachments.length) throw new Error('Backup snapshot mismatch')
    // Fully validate before publishing anything; all attachments precede snapshot publication.
    const attachments: { id: string; bytes: Buffer }[] = parsed.attachments.map((value: { id: string; bytes: string }, index: number) => {
      if (!value || typeof value.bytes !== 'string' || value.id !== snapshot.attachments[index]) throw new Error('Backup attachment mismatch')
      const bytes = Buffer.from(value.bytes, 'base64')
      if (bytes.toString('base64') !== value.bytes || this.id('attachment', bytes) !== value.id) throw new Error('Backup attachment integrity mismatch')
      return { id: value.id, bytes }
    })
    for (const attachment of attachments) await this.putAttachment(attachment.bytes)
    return this.publishSnapshot(snapshot)
  }
}
