import assert from 'node:assert/strict'
import { mkdtemp, rm, access, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { TeamJournal, type JournalEntry, type TeamOperation } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { emptyTeamState, replayTeam, validateTeamHistory, validateTeamOperation, type TeamItem, type TypedTeamOperation } from '../src/teams/replay'
import { exportRecovery, inspectRecovery, restoreRecovery, verifyRestored } from '../src/teams/recovery'

const root = await mkdtemp(join(tmpdir(), 're-team-replay-'))
const keys = { journal: randomBytes(32), objects: randomBytes(32), backup: randomBytes(32) }
let journal: TeamJournal | undefined, checks = 0
const frame: TeamItem = { id: 'frame', kind: 'frame', x: 0, y: 0, width: 400, height: 400, text: 'Group' }
const note: TeamItem = { id: 'note', kind: 'note', x: 10, y: 10, width: 160, height: 120, text: 'Evidence', textFormat: 'markdown', parentId: 'frame' }
const entry = (operation: TeamOperation, sequence = 1): JournalEntry => ({ version: 1, sequence, previous: '0'.repeat(64), operation })
const board = (items: TeamItem[] = [frame,note], revision = 0, opId = 'replace'): TypedTeamOperation => ({ id: opId, actor: 'alice', kind: 'team.board.replace.v1', payload: { boardId: 'board', expectedRevision: revision, title: 'Shared research', items } })
try {
  assert.deepEqual(replayTeam([], new Set()), emptyTeamState())
  const op = board(), before = structuredClone(op), first = replayTeam([entry(op)], new Set())
  first.boards[0].items[0].text = 'changed result'; assert.deepEqual(op, before)
  assert.equal(replayTeam([entry(op)], new Set()).boards[0].items[0].text, 'Group'); checks++
  for (const mutation of [
    (value: any) => value.kind = 'team.board.replace.v2',
    (value: any) => value.payload.expectedRevision = -1,
    (value: any) => value.payload.hidden = 'unsupported',
    (value: any) => value.payload.items[0].width = Infinity,
    (value: any) => value.payload.items[1].parentId = 'missing',
    (value: any) => value.payload.items[1].parentId = 'note',
    (value: any) => value.payload.items[1].source = { url: 'javascript:alert(1)' },
    (value: any) => value.payload.items[1].attachmentId = '../secret',
    (value: any) => value.payload.items[1].shape = 'diamond',
    (value: any) => value.payload.items.push({ ...note }),
    (value: any) => value.payload.items[0].parentId = 'note',
  ]) { const invalid = structuredClone(op); mutation(invalid); assert.throws(() => replayTeam([entry(invalid)], new Set())) }
  const sparse = board(); delete sparse.payload.items[0]; assert.throws(() => validateTeamOperation(sparse)); checks++
  const connector: TeamItem = { id: 'edge', kind: 'connector', x: 0, y: 0, width: 100, height: 100, text: '', fromId: 'frame', toId: 'note' }
  const drawing: TeamItem = { id: 'drawing', kind: 'drawing', x: 0, y: 0, width: 100, height: 100, text: '', pointSpace: 'unit', points: [{ x: 0.2, y: 0.3 }] }
  validateTeamOperation(board([frame,note,connector,drawing]))
  assert.throws(() => validateTeamOperation(board([frame,note,{ ...connector, toId: 'frame' }])))
  assert.throws(() => validateTeamOperation(board([frame,note,{ ...drawing, points: [{x:2,y:0}] }])))
  assert.throws(() => replayTeam([entry(board([],1))],new Set()), /revision conflict/)
  assert.throws(() => replayTeam([entry(op),entry(board([],0,'stale'),2)],new Set()), /revision conflict/)
  assert.throws(() => replayTeam([entry(op,2)],new Set()), /sequence/)
  assert.throws(() => replayTeam([entry(op),entry(op,2)],new Set()), /Duplicate operation/); checks++
  journal = await TeamJournal.open(join(root,'journal'),keys.journal)
  const objects = await TeamObjects.open(join(root,'objects'),keys.objects,'team-one')
  const attachment = await objects.putAttachment(Buffer.from('Original PDF bytes for protocol tests, not a parsed PDF'))
  const image: TeamItem = { id: 'image', kind: 'image', x: 5, y: 6, width: 160, height: 120, text: 'Original', attachmentId: attachment }
  const create = board([frame,note,image,connector,drawing]); await journal.append(create)
  const checkpoint = journal.checkpoint(), state1 = replayTeam(journal.replay(),new Set([attachment]))
  const snapshot1 = { version: 1 as const, checkpoint, state: state1, attachments: [attachment] }
  await objects.putSnapshot(snapshot1,journal)
  const post: TypedTeamOperation = { id: 'post-op', actor: 'bob', kind: 'team.backchat.post.v1', payload: { id: 'message-one', threadId: 'thread', text: 'Please review this evidence.', attachments: [attachment], links: [{boardId:'board',revision:1,itemId:'note'}] } }
  await journal.append(post)
  const replace = board([],1,'remove-items'); await journal.append(replace)
  const state3 = replayTeam(journal.replay(),new Set([attachment]))
  assert.equal(state3.boards[0].revision,2); assert.equal(state3.boards[0].items.length,0)
  assert.equal(state3.posts[0].actor,'bob'); assert.equal(state3.posts[0].sequence,2)
  assert.deepEqual(state3.posts[0].links,[{boardId:'board',revision:1,itemId:'note'}]) // Explicit historical revision, not a live dangling link.
  assert.deepEqual(state3.requiredAttachments,[attachment]); checks++
  for (const change of [
    (value:any) => value.payload.links[0].revision=0,
    (value:any) => value.payload.links[0].revision=2,
    (value:any) => value.payload.links[0].itemId='absent',
    (value:any) => value.payload.actor='forged-actor',
    (value:any) => value.payload.attachments.push(attachment),
  ]) { const invalid=structuredClone(post); change(invalid); assert.throws(()=>replayTeam([entry(create),entry(invalid,2)],new Set([attachment]))) }
  const duplicatePost=structuredClone(post); duplicatePost.id='different-op'
  assert.throws(()=>replayTeam([entry(create),entry(post,2),entry(duplicatePost,3)],new Set([attachment])), /Duplicate BackChat/)
  assert.throws(()=>replayTeam(journal!.replay(),new Set()), /missing attachment/); checks++
  const snapshot3 = {version:1 as const,checkpoint:journal.checkpoint(),state:state3,attachments:[attachment]}
  await objects.putSnapshot(snapshot3,journal)
  assert.deepEqual(validateTeamHistory(journal.replay(),[snapshot1,snapshot3],new Set([attachment])),state3)
  const wrong=structuredClone(snapshot1); wrong.state.boards[0].title='Invented state'
  assert.throws(()=>validateTeamHistory(journal!.replay(),[wrong],new Set([attachment])), /differ from/)
  assert.throws(()=>validateTeamHistory(journal!.replay(),[{...snapshot3,attachments:[]}],new Set([attachment])), /differ from/); checks++
  // Snapshot object property order is not meaningful; array order and values are meaningful.
  const reordered={...snapshot3,state:{requiredAttachments:state3.requiredAttachments,posts:state3.posts,boards:state3.boards,sequence:state3.sequence,schemaVersion:1 as const}}
  validateTeamHistory(journal.replay(),[reordered],new Set([attachment])); checks++
  const bundle=await exportRecovery(journal,objects,keys,'team-one','team-state-v1')
  assert.deepEqual(inspectRecovery(bundle,keys,'team-one','team-state-v1'),journal.checkpoint())
  const restored=join(root,'restored'); await restoreRecovery(bundle,restored,keys,'team-one','team-state-v1')
  assert.deepEqual(await verifyRestored(restored,keys,'team-one','team-state-v1'),journal.checkpoint())
  const restoredJournal=await TeamJournal.open(join(restored,'journal'),keys.journal)
  assert.deepEqual(replayTeam(restoredJournal.replay(),new Set([attachment])),state3); await restoredJournal.close(); checks++
  const storageBundle=await exportRecovery(journal,objects,keys,'team-one')
  assert.throws(()=>inspectRecovery(storageBundle,keys,'team-one','team-state-v1'), /policy mismatch/)
  const noWrite=join(root,'reject-policy'); await assert.rejects(restoreRecovery(storageBundle,noWrite,keys,'team-one','team-state-v1'),/policy mismatch/); await assert.rejects(access(noWrite))
  // A trusted-key holder changing a package to falsely claim typed validation cannot bypass replay.
  const decipher=createDecipheriv('aes-256-gcm',keys.backup,storageBundle.subarray(0,12)); decipher.setAAD(Buffer.from('re-teams-full-recovery-v1:team-one')); decipher.setAuthTag(storageBundle.subarray(-16))
  const parsed=JSON.parse(Buffer.concat([decipher.update(storageBundle.subarray(12,-16)),decipher.final()]).toString()); parsed.validation='team-state-v1'
  parsed.objects.objects=parsed.objects.objects.filter((object:any)=>object.id!==attachment)
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keys.backup,nonce);cipher.setAAD(Buffer.from('re-teams-full-recovery-v1:team-one'))
  const missing=Buffer.concat([nonce,cipher.update(JSON.stringify(parsed)),cipher.final(),cipher.getAuthTag()])
  await assert.rejects(restoreRecovery(missing,noWrite,keys,'team-one','team-state-v1'));await assert.rejects(access(noWrite)); checks++
  // Storage-only snapshots may be written by the old primitive; typed export must reject an invented state.
  const falseSnapshot=await objects.putSnapshot(wrong,journal)
  await assert.rejects(exportRecovery(journal,objects,keys,'team-one','team-state-v1'), /differ from/)
  await unlink(join(root,'objects',`snapshot-${falseSnapshot}`)); checks++
  console.log(`PASS ${checks} typed Teams replay checks: deterministic immutable state, strict schemas/geometry/links, revision and sequence conflicts, historical BackChat links/author provenance, retained attachment requirements, checkpoint snapshot equality, canonical properties, typed backup/restore and policy refusal before writes. No networking.`)
} finally { await journal?.close(); Object.values(keys).forEach(key=>key.fill(0)); await rm(root,{recursive:true,force:true}) }
