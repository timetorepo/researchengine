import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, readdir, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TeamObjects, type TeamSnapshot } from '../src/teams/objects'
import { TeamJournal } from '../src/teams/journal'

if (process.argv[2] === 'child') {
  const store = await TeamObjects.open(process.argv[3], Buffer.from(process.argv[4], 'hex'), 'team-one')
  const id = await store.putAttachment(Buffer.from('durable before SIGKILL'))
  process.stdout.write(`DURABLE:${id}\n`)
  setInterval(() => {}, 1000)
} else {
const root = await mkdtemp(join(tmpdir(), 're-team-objects-')), key = randomBytes(32)
let checks = 0
try {
  const directory = join(root, 'source'), store = await TeamObjects.open(directory, key, 'team-one')
  const source = Buffer.from('PRIVATE_ATTACHMENT_SENTINEL'), pending = store.putAttachment(source); source.fill(0)
  const id = await pending
  assert.equal((await store.getAttachment(id)).toString(), 'PRIVATE_ATTACHMENT_SENTINEL')
  const file = join(directory, `attachment-${id}`), encrypted = await readFile(file)
  assert.ok(!encrypted.includes('PRIVATE_ATTACHMENT_SENTINEL')); assert.equal((await stat(file)).mode & 0o777, 0o600); checks++
  assert.deepEqual(await Promise.all(Array.from({ length: 10 }, () => store.putAttachment(Buffer.from('PRIVATE_ATTACHMENT_SENTINEL')))), Array(10).fill(id))
  assert.deepEqual(await readFile(file), encrypted); assert.ok((await readdir(directory)).every(name => !name.startsWith('.pending-'))); checks++
  for (const bad of ['../operations.log', '', 'x'.repeat(64)]) await assert.rejects(store.getAttachment(bad), /identity/)
  await assert.rejects((await TeamObjects.open(directory, key, 'other-team')).getAttachment(id))
  await assert.rejects((await TeamObjects.open(directory, randomBytes(32), 'team-one')).getAttachment(id)); checks++
  const journal = await TeamJournal.open(join(root, 'journal'), randomBytes(32))
  const receipt = await journal.append({ id: 'op-one', actor: 'member', kind: 'attachment', payload: { attachment: id } })
  assert.deepEqual(journal.checkpoint(), receipt); assert.equal(journal.checkpoint(0).sequence, 0); assert.throws(() => journal.checkpoint(2))
  const snapshot: TeamSnapshot = { version: 1, checkpoint: journal.checkpoint(), state: { text: 'PRIVATE_SNAPSHOT_SENTINEL' }, attachments: [id] }
  const snapshotId = await store.putSnapshot(snapshot, journal)
  assert.deepEqual(await store.getSnapshot(snapshotId), snapshot)
  assert.ok(!(await readFile(join(directory, `snapshot-${snapshotId}`))).includes('PRIVATE_SNAPSHOT_SENTINEL')); await journal.close(); checks++
  await assert.rejects(store.putSnapshot({ ...snapshot, checkpoint: { sequence: 1, digest: 'a'.repeat(64) } }, journal), /checkpoint/)
  const beforeMissing = (await readdir(directory)).sort()
  await assert.rejects(store.putSnapshot({ ...snapshot, attachments: ['a'.repeat(64)] }, journal))
  await assert.rejects(store.putSnapshot({ ...snapshot, attachments: [id, id] }, journal), /Invalid/)
  await assert.rejects(store.putSnapshot({ ...snapshot, state: { missing: undefined } }, journal))
  assert.deepEqual((await readdir(directory)).sort(), beforeMissing); checks++
  const bundle = await store.exportSnapshot(snapshotId)
  assert.ok(!bundle.includes('PRIVATE_SNAPSHOT_SENTINEL')); assert.ok(!bundle.includes('PRIVATE_ATTACHMENT_SENTINEL'))
  const restoreDirectory = join(root, 'restored'), restored = await TeamObjects.open(restoreDirectory, key, 'team-one')
  assert.equal(await restored.importSnapshot(bundle), snapshotId); assert.equal(await restored.importSnapshot(bundle), snapshotId)
  assert.deepEqual(await restored.getSnapshot(snapshotId), snapshot); assert.equal((await restored.getAttachment(id)).toString(), 'PRIVATE_ATTACHMENT_SENTINEL'); checks++
  const damaged = Buffer.from(bundle); damaged[20] ^= 1
  const emptyDirectory = join(root, 'empty'), empty = await TeamObjects.open(emptyDirectory, key, 'team-one')
  await assert.rejects(empty.importSnapshot(damaged)); await assert.rejects(empty.importSnapshot(bundle.subarray(0, 15)))
  await assert.rejects((await TeamObjects.open(emptyDirectory, key, 'other-team')).importSnapshot(bundle))
  assert.deepEqual(await readdir(emptyDirectory), []); checks++
  const tampered = Buffer.from(encrypted); tampered[15] ^= 1; await writeFile(file, tampered)
  await assert.rejects(store.getAttachment(id)); await assert.rejects(store.getSnapshot(snapshotId)); await assert.rejects(store.exportSnapshot(snapshotId))
  await assert.rejects(store.putAttachment(Buffer.from('PRIVATE_ATTACHMENT_SENTINEL')))
  assert.deepEqual(await readFile(file), tampered); assert.ok(!(await readdir(directory)).some(name => name.startsWith('.pending-')))
  await writeFile(file, encrypted); checks++
  // Orphan temporary ciphertext is never treated as committed data or included in backups.
  await writeFile(join(directory, '.pending-orphan'), randomBytes(50))
  const reopened = await TeamObjects.open(directory, key, 'team-one')
  assert.deepEqual(await reopened.getSnapshot(snapshotId), snapshot)
  const fresh = await TeamObjects.open(join(root, 'fresh'), key, 'team-one'); await fresh.importSnapshot(await reopened.exportSnapshot(snapshotId))
  assert.equal((await readdir(join(root, 'fresh'))).length, 2); checks++
  // Missing attachment makes a snapshot unusable; restore repairs absence, never overwrites corruption.
  await unlink(join(restoreDirectory, `attachment-${id}`)); await assert.rejects(restored.getSnapshot(snapshotId))
  await restored.importSnapshot(bundle); assert.deepEqual(await restored.getSnapshot(snapshotId), snapshot); checks++
  const crashDirectory = join(root, 'crash')
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), 'child', crashDirectory, key.toString('hex')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let crashId = ''
  await new Promise<void>((resolve, reject) => {
    let text = ''
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Child receipt timeout')) }, 15000)
    child.stdout.on('data', chunk => { text += chunk; const match = /DURABLE:([a-f0-9]{64})/.exec(text); if (match) { crashId = match[1]; clearTimeout(timeout); child.kill('SIGKILL'); resolve() } })
    child.on('error', error => { clearTimeout(timeout); reject(error) })
    child.on('exit', code => { clearTimeout(timeout); if (!crashId) reject(new Error(`Child exited before receipt: ${code}`)) })
  })
  if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve))
  assert.equal((await (await TeamObjects.open(crashDirectory, key, 'team-one')).getAttachment(crashId)).toString(), 'durable before SIGKILL'); checks++
  console.log(`PASS ${checks} Teams object checks: encrypted atomic immutable attachments, concurrent deduplication, namespace/key/path isolation, durable checkpoint snapshots, missing/invalid references, encrypted snapshot backup/restore, tamper/truncation refusal, corruption preservation, orphan exclusion, missing-object recovery, SIGKILL after attachment receipt. No networking.`)
} finally { key.fill(0); await rm(root, { recursive: true, force: true }) }

}
