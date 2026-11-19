import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, appendFile, writeFile, unlink, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TeamJournal } from '../src/teams/journal'

const key = randomBytes(32)
if (process.argv[2] === 'child') {
  const journal = await TeamJournal.open(process.argv[3], Buffer.from(process.argv[4], 'hex'))
  await journal.append({ id: 'crash-acked', actor: 'member', kind: 'note', payload: 'acknowledged before SIGKILL' })
  process.stdout.write('DURABLE\n')
  setInterval(() => {}, 1000)
} else {
  const root = await mkdtemp(join(tmpdir(), 're-teams-journal-'))
  let checks = 0
  try {
    const dir = join(root, 'team'), path = join(dir, 'operations.log')
    let j = await TeamJournal.open(dir, key)
    await assert.rejects(TeamJournal.open(dir, key), /EEXIST/); checks++
    const op = { id: 'one', actor: 'member', kind: 'note', payload: { text: 'PRIVATE_CONTENT_SENTINEL' } }
    const pending = j.append(op); op.payload.text = 'changed after queue'
    const receipt = await pending
    assert.equal(receipt.sequence, 1); assert.equal(j.replay()[0].operation.payload && (j.replay()[0].operation.payload as any).text, 'PRIVATE_CONTENT_SENTINEL')
    const disk = await readFile(path); assert.ok(!disk.includes('PRIVATE_CONTENT_SENTINEL')); assert.equal((await stat(path)).mode & 0o777, 0o600); checks++
    const original = j.replay()[0].operation
    assert.deepEqual(await j.append(original), receipt)
    await assert.rejects(j.append(op), /reused/); checks++
    const parallel = await Promise.all(Array.from({ length: 20 }, (_, i) => j.append({ id: `p-${i}`, actor: 'm', kind: 'note', payload: i })))
    assert.deepEqual(parallel.map(r => r.sequence), Array.from({ length: 20 }, (_, i) => i + 2)); checks++
    const replay = j.replay(); replay[0].operation.id = 'modified'
    assert.equal(j.replay()[0].operation.id, 'one')
    const closingWrite = j.append({ id: 'drain', actor: 'm', kind: 'note', payload: null }); await j.close(); await closingWrite
    await assert.rejects(j.append(original), /closed/)
    j = await TeamJournal.open(dir, key); assert.equal(j.replay().length, 22); await j.close(); checks++
    const beforeWrongKey = await readFile(path)
    await assert.rejects(TeamJournal.open(dir, randomBytes(32)))
    assert.deepEqual(await readFile(path), beforeWrongKey); checks++
    await appendFile(path, 'partial-uncommitted-tail')
    j = await TeamJournal.open(dir, key); assert.equal(j.replay().length, 22); await j.close()
    assert.ok((await readFile(path)).toString().endsWith('\n')); checks++
    const valid = await readFile(path), corrupt = Buffer.from(valid); corrupt[20] = corrupt[20] === 65 ? 66 : 65
    await writeFile(path, corrupt); await assert.rejects(TeamJournal.open(dir, key)); assert.deepEqual(await readFile(path), corrupt)
    await writeFile(path, valid)
    const lines = valid.toString().trimEnd().split('\n'); [lines[0], lines[1]] = [lines[1], lines[0]]
    await writeFile(path, lines.join('\n') + '\n'); await assert.rejects(TeamJournal.open(dir, key)); await writeFile(path, valid); checks++
    j = await TeamJournal.open(dir, key)
    for (const payload of [undefined, NaN, Infinity, new Date(), [, 1], { bad: undefined }]) await assert.rejects(j.append({ id: 'invalid', actor: 'm', kind: 'note', payload }))
    await j.close(); checks++
    // A failed flush must not acknowledge or permit later writes on this handle.
    const failureDir = join(root, 'flush-failure')
    j = await TeamJournal.open(failureDir, key)
    const handle = (j as any).file, originalSync = handle.sync.bind(handle)
    handle.sync = async () => { throw new Error('injected disk flush failure') }
    await assert.rejects(j.append({ id: 'uncertain', actor: 'm', kind: 'note', payload: null }), /flush failure/)
    assert.equal(j.replay().length, 0)
    await assert.rejects(j.append({ id: 'later', actor: 'm', kind: 'note', payload: null }), /requires recovery/)
    handle.sync = originalSync; await j.close()
    // An unacknowledged complete record may survive. Retry uses the same operation ID.
    j = await TeamJournal.open(failureDir, key)
    assert.equal((await j.append({ id: 'uncertain', actor: 'm', kind: 'note', payload: null })).sequence, 1)
    await j.close(); checks++
    // Real OS-process kill after the receipt; lock removal is an explicit OFFLINE maintenance step.
    const crashDir = join(root, 'crash')
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), 'child', crashDir, key.toString('hex')], { stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise<void>((resolve, reject) => {
      let text = ''; child.stdout.on('data', chunk => { text += chunk; if (text.includes('DURABLE')) { child.kill('SIGKILL'); resolve() } }); child.on('error', reject); child.on('exit', code => { if (!text.includes('DURABLE')) reject(new Error(`Child exited before receipt: ${code}`)) })
    })
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve))
    await assert.rejects(TeamJournal.open(crashDir, key), /EEXIST/)
    await unlink(join(crashDir, 'writer.lock'))
    j = await TeamJournal.open(crashDir, key); assert.equal(j.replay()[0].operation.id, 'crash-acked')
    assert.equal((await j.append(j.replay()[0].operation)).sequence, 1); await j.close(); checks++
    console.log(`PASS ${checks} Teams journal checks: lock, encryption, cloned/idempotent writes, serialized sequences, replay/drain, wrong key, torn tail, tamper/reorder refusal, invalid JSON, SIGKILL after durable receipt. No networking.`)
  } finally { key.fill(0); await rm(root, { recursive: true, force: true }) }
}
