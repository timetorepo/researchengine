import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { exportRecovery, inspectRecovery, restoreRecovery, verifyRestored, type RecoveryKeys } from '../src/teams/recovery'

if (process.argv[2] === 'child') {
  const keys = JSON.parse(process.argv[5]) as Record<string, string>
  const original = TeamObjects.prototype.importArchive
  TeamObjects.prototype.importArchive = async function (archive) {
    await original.call(this, archive)
    process.stdout.write('BEFORE_READY\n')
    await new Promise(() => {})
  }
  await restoreRecovery(await readFile(process.argv[3]), process.argv[4], { journal: Buffer.from(keys.journal, 'hex'), objects: Buffer.from(keys.objects, 'hex'), backup: Buffer.from(keys.backup, 'hex') }, 'team-one')
} else {
  const root = await mkdtemp(join(tmpdir(), 're-recovery-'))
  const keys: RecoveryKeys = { journal: randomBytes(32), objects: randomBytes(32), backup: randomBytes(32) }
  let journal: TeamJournal | undefined, checks = 0
  // Test-only authenticated mutations exercise semantic validation, not just GCM failure.
  const rewrite = (bytes: Buffer, change: (value: any) => void) => {
    const aad = Buffer.from('re-teams-full-recovery-v1:team-one')
    const decipher = createDecipheriv('aes-256-gcm', keys.backup, bytes.subarray(0, 12))
    decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(-16))
    const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString())
    change(value)
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keys.backup, nonce); cipher.setAAD(aad)
    return Buffer.concat([nonce, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()])
  }
  try {
    journal = await TeamJournal.open(join(root, 'journal'), keys.journal)
    const objects = await TeamObjects.open(join(root, 'objects'), keys.objects, 'team-one')
    const attachment = await objects.putAttachment(Buffer.from('PRIVATE_RECOVERY_ATTACHMENT'))
    const unreferenced = await objects.putAttachment(Buffer.from('UNREFERENCED_ORIGINAL'))
    const operation = { id: 'one', actor: 'member', kind: 'note', payload: { text: 'PRIVATE_RECOVERY_OPERATION', attachment } }
    await journal.append(operation)
    const snapshot = { version: 1 as const, checkpoint: journal.checkpoint(), state: { text: 'PRIVATE_RECOVERY_SNAPSHOT' }, attachments: [attachment] }
    const snapshotId = await objects.putSnapshot(snapshot, journal)
    await journal.append({ id: 'two', actor: 'member', kind: 'note', payload: { text: 'after snapshot' } })
    const checkpoint = journal.checkpoint(), bundle = await exportRecovery(journal, objects, keys, 'team-one')
    for (const text of ['PRIVATE_RECOVERY_ATTACHMENT', 'PRIVATE_RECOVERY_OPERATION', 'PRIVATE_RECOVERY_SNAPSHOT', 'UNREFERENCED_ORIGINAL']) assert.ok(!bundle.includes(text))
    assert.deepEqual(inspectRecovery(bundle, keys, 'team-one'), checkpoint); checks++
    const destination = join(root, 'restored')
    assert.deepEqual(await restoreRecovery(bundle, destination, keys, 'team-one'), checkpoint)
    assert.deepEqual(await verifyRestored(destination, keys, 'team-one'), checkpoint)
    const restoredObjects = await TeamObjects.open(join(destination, 'objects'), keys.objects, 'team-one')
    assert.deepEqual(await restoredObjects.getSnapshot(snapshotId), snapshot)
    assert.equal((await restoredObjects.getAttachment(unreferenced)).toString(), 'UNREFERENCED_ORIGINAL')
    const restoredJournal = await TeamJournal.open(join(destination, 'journal'), keys.journal)
    await assert.rejects(verifyRestored(destination, keys, 'team-one'), /in use/)
    assert.equal(restoredJournal.replay().length, 2); assert.equal((await restoredJournal.append(operation)).sequence, 1); await restoredJournal.close(); checks++
    const existingLog = await readFile(join(destination, 'journal', 'operations.log'))
    await assert.rejects(restoreRecovery(bundle, destination, keys, 'team-one'), /EEXIST/)
    assert.deepEqual(await readFile(join(destination, 'journal', 'operations.log')), existingLog); checks++
    const invalidDestination = join(root, 'invalid')
    const damaged = Buffer.from(bundle); damaged[20] ^= 1
    for (const invalid of [damaged, bundle.subarray(0, 20), rewrite(bundle, value => value.version = 2), rewrite(bundle, value => value.objects.objects = value.objects.objects.filter((object: any) => object.id !== attachment)), rewrite(bundle, value => value.checkpoint.sequence++), rewrite(bundle, value => value.journal = Buffer.from('torn tail').toString('base64'))]) {
      await assert.rejects(restoreRecovery(invalid, invalidDestination, keys, 'team-one')); await assert.rejects(access(invalidDestination))
    }
    for (const name of ['journal', 'objects', 'backup'] as const) assert.throws(() => inspectRecovery(bundle, { ...keys, [name]: randomBytes(32) }, 'team-one'))
    assert.throws(() => inspectRecovery(bundle, keys, 'other-team'))
    assert.throws(() => inspectRecovery(bundle, { ...keys, backup: keys.objects }, 'team-one'), /distinct/); checks++
    // Readiness authenticates exact inventory, including originals not referenced by a snapshot.
    const originalPath = join(destination, 'objects', `attachment-${unreferenced}`), originalCiphertext = await readFile(originalPath)
    await unlink(originalPath); await assert.rejects(verifyRestored(destination, keys, 'team-one'), /inventory/)
    await writeFile(originalPath, originalCiphertext)
    const readyPath = join(destination, 'READY'), ready = await readFile(readyPath), badReady = Buffer.from(ready); badReady[15] ^= 1
    await writeFile(readyPath, badReady); await assert.rejects(verifyRestored(destination, keys, 'team-one')); await writeFile(readyPath, ready)
    assert.deepEqual(await verifyRestored(destination, keys, 'team-one'), checkpoint); checks++
    // Capture blocks new append ordering until the object inventory has been read and verified.
    const originalExport = objects.exportArchive.bind(objects)
    let release!: () => void, entered!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    objects.exportArchive = async () => { entered(); await barrier; return originalExport() }
    const capture = exportRecovery(journal, objects, keys, 'team-one'); await started
    let appended = false
    const after = journal.append({ id: 'three', actor: 'member', kind: 'note', payload: null }).then(() => { appended = true })
    assert.equal(appended, false); release()
    assert.deepEqual(inspectRecovery(await capture, keys, 'team-one'), checkpoint); await after
    assert.equal(journal.checkpoint().sequence, 3); objects.exportArchive = originalExport; checks++
    // Corrupt source data cannot produce an apparently complete package.
    const path = join(root, 'objects', `attachment-${attachment}`), original = await readFile(path), corrupt = Buffer.from(original); corrupt[20] ^= 1
    await writeFile(path, corrupt); await assert.rejects(exportRecovery(journal, objects, keys, 'team-one')); await writeFile(path, original)
    assert.equal(journal.checkpoint().sequence, 3); checks++
    const backupPath = join(root, 'package.bin'); await writeFile(backupPath, bundle)
    const crashDestination = join(root, 'crashed')
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), 'child', backupPath, crashDestination, JSON.stringify(Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, key.toString('hex')])))], { stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise<void>((resolve, reject) => {
      let text = ''
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Restore child timeout')) }, 15000)
      child.stdout.on('data', chunk => { text += chunk; if (text.includes('BEFORE_READY')) { clearTimeout(timeout); child.kill('SIGKILL'); resolve() } })
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('exit', code => { clearTimeout(timeout); if (!text.includes('BEFORE_READY')) reject(new Error(`Child exited early ${code}`)) })
    })
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve))
    assert.ok((await readdir(crashDestination)).includes('INCOMPLETE')); await assert.rejects(access(join(crashDestination, 'READY')))
    await assert.rejects(verifyRestored(crashDestination, keys, 'team-one'))
    await assert.rejects(restoreRecovery(bundle, crashDestination, keys, 'team-one'), /EEXIST/)
    const freshDestination = join(root, 'after-crash'); await restoreRecovery(bundle, freshDestination, keys, 'team-one'); assert.deepEqual(await verifyRestored(freshDestination, keys, 'team-one'), checkpoint); checks++
    console.log(`PASS ${checks} full Teams storage recovery checks: encrypted journal/all-object roundtrip, snapshot checkpoint and retry preservation, no overwrite, invalid package/no writes, exact authenticated inventory, frozen append boundary, source corruption refusal, real SIGKILL before READY and separate-destination recovery. No networking.`)
  } finally { await journal?.close(); Object.values(keys).forEach(key => key.fill(0)); await rm(root, { recursive: true, force: true }) }
}
