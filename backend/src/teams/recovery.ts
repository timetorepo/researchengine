/** Offline full storage packages. No automatic restore, routes, permissions, or key storage. */
import { mkdir, open, readFile, rename, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { TeamJournal, inspectJournal, type Receipt } from './journal'
import { TeamObjects, type ObjectArchive } from './objects'
import { validateTeamHistory } from './replay'

export type RecoveryValidation = 'storage-v1' | 'team-state-v1'
type Ready = { validation?: RecoveryValidation; version: 1; team: string; checkpoint: Receipt; packageSha256: string; identities: string[] }
type Package = { validation?: RecoveryValidation; version: 1; team: string; journal: string; checkpoint: Receipt; objects: ObjectArchive }
export type RecoveryKeys = { journal: Buffer; objects: Buffer; backup: Buffer }
function validateKeys(keys: RecoveryKeys) {
  if ([keys.journal, keys.objects, keys.backup].some(key => !Buffer.isBuffer(key) || key.length !== 32) || keys.journal.equals(keys.objects) || keys.journal.equals(keys.backup) || keys.objects.equals(keys.backup)) throw new Error('Three distinct 32-byte recovery keys required')
}
function copyKeys(keys: RecoveryKeys): RecoveryKeys {
  validateKeys(keys)
  return { journal: Buffer.from(keys.journal), objects: Buffer.from(keys.objects), backup: Buffer.from(keys.backup) }
}
function context(team: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(team)) throw new Error('Invalid team identity')
  return Buffer.from(`re-teams-full-recovery-v1:${team}`)
}
function encode(value: { team: string }, key: Buffer): Buffer {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(context(value.team))
  return Buffer.concat([nonce, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()])
}
function decode<T = Package>(bytes: Buffer, key: Buffer, team: string): T {
  if (bytes.length < 28) throw new Error('Truncated recovery package')
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
  cipher.setAAD(context(team)); cipher.setAuthTag(bytes.subarray(-16))
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8'))
}
function inspect(value: Package, keys: RecoveryKeys, team: string, requiredValidation: RecoveryValidation = 'storage-v1'): Buffer {
  if (!value || value.version !== 1 || value.team !== team || typeof value.journal !== 'string' || !value.checkpoint) throw new Error('Invalid recovery package')
  const validation = value.validation ?? 'storage-v1'
  if (!['storage-v1','team-state-v1'].includes(validation) || !['storage-v1','team-state-v1'].includes(requiredValidation) || (requiredValidation === 'team-state-v1' && validation !== requiredValidation)) throw new Error('Recovery validation policy mismatch')
  const log = Buffer.from(value.journal, 'base64')
  if (log.toString('base64') !== value.journal) throw new Error('Invalid journal encoding')
  const { entries, checkpoints } = inspectJournal(log, keys.journal), last = checkpoints.at(-1)!
  if (last.sequence !== value.checkpoint.sequence || last.digest !== value.checkpoint.digest) throw new Error('Recovery checkpoint mismatch')
  const snapshots = TeamObjects.inspectArchive(value.objects, keys.objects, team)
  for (const snapshot of snapshots) if (checkpoints[snapshot.checkpoint.sequence]?.digest !== snapshot.checkpoint.digest) throw new Error('Snapshot not bound to recovery journal')
  if (validation === 'team-state-v1') validateTeamHistory(entries, snapshots, new Set(value.objects.objects.filter(object => object.kind === 'attachment').map(object => object.id)))
  return log
}
async function syncDirectory(path: string) {
  const handle = await open(path, 'r'); try { await handle.sync() } finally { await handle.close() }
}
async function durableFile(path: string, bytes: Buffer) {
  const file = await open(path, 'wx', 0o600)
  try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
}
export async function exportRecovery(journal: TeamJournal, objects: TeamObjects, keys: RecoveryKeys, team: string, validation: RecoveryValidation = 'storage-v1'): Promise<Buffer> {
  keys = copyKeys(keys)
  try {
    context(team)
    // Queued append ordering is frozen until object capture and package verification finish.
    return await journal.capture(async (log, checkpoints) => {
      const value: Package = { validation, version: 1, team, journal: log.toString('base64'), checkpoint: checkpoints.at(-1)!, objects: await objects.exportArchive() }
      inspect(value, keys, team)
      return encode(value, keys.backup)
    })
  } finally { Object.values(keys).forEach(key => key.fill(0)) }
}
export function inspectRecovery(bytes: Buffer, keys: RecoveryKeys, team: string, requiredValidation: RecoveryValidation = 'storage-v1'): Receipt {
  keys = copyKeys(keys)
  try {
    const value = decode(bytes, keys.backup, team)
    inspect(value, keys, team, requiredValidation)
    return { ...value.checkpoint }
  } finally { Object.values(keys).forEach(key => key.fill(0)) }
}
/** New destination only. On I/O failure leave incomplete evidence; never erase or replace existing data. */
export async function restoreRecovery(bytes: Buffer, destination: string, keys: RecoveryKeys, team: string, requiredValidation: RecoveryValidation = 'storage-v1'): Promise<Receipt> {
  keys = copyKeys(keys)
  try {
    bytes = Buffer.from(bytes)
    const value = decode(bytes, keys.backup, team), log = inspect(value, keys, team, requiredValidation)
    // All cryptographic, checkpoint and snapshot-reference validation precedes any filesystem write.
    await mkdir(destination, { mode: 0o700 }) // EEXIST is intentional, even for an empty directory.
    await syncDirectory(dirname(destination))
    await durableFile(join(destination, 'INCOMPLETE'), Buffer.from('Restore attempt started. Only a verified authenticated READY marker means complete.\n'))
    await syncDirectory(destination)
    const journalDirectory = join(destination, 'journal')
    await mkdir(journalDirectory, { mode: 0o700 }); await syncDirectory(destination)
    await durableFile(join(journalDirectory, 'operations.log'), log); await syncDirectory(journalDirectory)
    const objects = await TeamObjects.open(join(destination, 'objects'), keys.objects, team)
    await objects.importArchive(value.objects)
    // Ready marker binds the package bytes for operator verification; not an anti-rollback authority.
    const ready: Ready = { validation: value.validation ?? 'storage-v1', version: 1, team, checkpoint: value.checkpoint, packageSha256: createHash('sha256').update(bytes).digest('hex'), identities: value.objects.objects.map(object => `${object.kind}-${object.id}`).sort() }
    await durableFile(join(destination, 'READY.pending'), encode(ready, keys.backup))
    await rename(join(destination, 'READY.pending'), join(destination, 'READY')); await syncDirectory(destination)
    // INCOMPLETE remains intentionally as provenance; READY is the final commit marker.
    return { ...value.checkpoint }
  } finally { Object.values(keys).forEach(key => key.fill(0)) }
}
/** Read-only offline readiness check; refuses missing marker or altered restored contents. */
export async function verifyRestored(destination: string, keys: RecoveryKeys, team: string, requiredValidation: RecoveryValidation = 'storage-v1'): Promise<Receipt> {
  keys = copyKeys(keys)
  try {
    await access(join(destination, 'journal', 'writer.lock')).then(() => { throw new Error('Restored journal is in use; verify offline') }, error => { if (error.code !== 'ENOENT') throw error })
    const ready = decode<Ready>(await readFile(join(destination, 'READY')), keys.backup, team)
    if (ready.version !== 1 || ready.team !== team) throw new Error('Invalid restored marker')
    const objects = await TeamObjects.readArchive(join(destination, 'objects'), keys.objects, team)
    if (JSON.stringify(objects.objects.map(object => `${object.kind}-${object.id}`).sort()) !== JSON.stringify(ready.identities)) throw new Error('Restored object inventory changed')
    const log = await readFile(join(destination, 'journal', 'operations.log'))
    const value: Package = { validation: ready.validation, version: 1, team, journal: log.toString('base64'), checkpoint: ready.checkpoint, objects }
    inspect(value, keys, team, requiredValidation)
    return { ...value.checkpoint }
  } finally { Object.values(keys).forEach(key => key.fill(0)) }
}

/** Authenticated marker metadata for the local host activation gate; no writes or journal repair. */
export async function readRestoreMarker(destination:string,backupKey:Buffer,team:string):Promise<Ready>{
  if(backupKey.length!==32)throw new Error('Invalid restore marker key')
  const ready=decode<Ready>(await readFile(join(destination,'READY')),backupKey,team)
  if(!ready||ready.version!==1||ready.team!==team||ready.validation!=='team-state-v1'||!ready.checkpoint||!Number.isSafeInteger(ready.checkpoint.sequence)||ready.checkpoint.sequence<0||typeof ready.checkpoint.digest!=='string'||!/^[a-f0-9]{64}$/.test(ready.checkpoint.digest)||!Array.isArray(ready.identities)||ready.identities.some(id=>typeof id!=='string'||!/^(attachment|snapshot)-[a-f0-9]{64}$/.test(id))||new Set(ready.identities).size!==ready.identities.length)throw new Error('Invalid typed restore marker')
  return ready
}
