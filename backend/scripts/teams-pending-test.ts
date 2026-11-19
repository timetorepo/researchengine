import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PendingQueue, type QueueTransport } from '../src/teams/pending'
import { TeamObjects } from '../src/teams/objects'
import { TeamJournal } from '../src/teams/journal'
import { replayTeam, type TypedTeamOperation } from '../src/teams/replay'
const binding = { team: 'team-one', client: 'client-one', actor: 'alice' }
const board = (id: string, revision = 0, boardId = 'board'): TypedTeamOperation => ({id,actor:'alice',kind:'team.board.replace.v1',payload:{boardId,expectedRevision:revision,title:'PRIVATE_PENDING_SENTINEL',items:[]}})
if (process.argv[2] === 'child') {
  const root = process.argv[3], key = Buffer.from(process.argv[4],'hex'), objectKey = Buffer.from(process.argv[5],'hex')
  const objects = await TeamObjects.open(join(root,'objects'),objectKey,binding.team)
  const queue = await PendingQueue.open(join(root,'outbox'),key,binding,objects)
  const phase = process.argv[6]
  await queue.enqueue(board('crash-operation'))
  if (phase === 'pending') { process.stdout.write('DURABLE\n'); setInterval(()=>{},1000) }
  else await queue.drain(async operation => {
    const host = await TeamJournal.open(join(root,'host'),Buffer.from(process.argv[7],'hex'))
    await host.append(operation); await host.close()
    process.stdout.write('HOST_DURABLE\n'); await new Promise(()=>{}); throw new Error('unreachable')
  })
} else {
const root = await mkdtemp(join(tmpdir(),'re-pending-')), key = randomBytes(32), objectKey = randomBytes(32), hostKey = randomBytes(32)
let queue: PendingQueue|undefined, host: TeamJournal|undefined, checks = 0
try {
  const objects = await TeamObjects.open(join(root,'objects'),objectKey,binding.team)
  const outbox = join(root,'outbox')
  queue = await PendingQueue.open(outbox,key,binding,objects)
  const source = board('one'), enqueued = queue.enqueue(source); source.payload.title='caller mutation'; await enqueued
  assert.equal(queue.view()[0].operation.payload.title,'PRIVATE_PENDING_SENTINEL')
  const view = queue.view(); view[0].operation.id='view mutation'; assert.equal(queue.view()[0].operation.id,'one')
  assert.ok(!(await readFile(join(outbox,'operations.log'))).includes('PRIVATE_PENDING_SENTINEL'))
  await queue.enqueue(board('one')); await assert.rejects(queue.enqueue(board('one',1)),/different content/)
  await assert.rejects(queue.enqueue({...board('spoof'),actor:'mallory'}),/actor/)
  await queue.close(); checks++
  const beforeWrongScope = await readFile(join(outbox,'operations.log'))
  for (const changed of [{...binding,team:'other'},{...binding,client:'other'},{...binding,actor:'other'}]) await assert.rejects(PendingQueue.open(outbox,key,changed,objects))
  assert.deepEqual(await readFile(join(outbox,'operations.log')),beforeWrongScope)
  queue = await PendingQueue.open(outbox,key,binding,objects); assert.equal(queue.view()[0].status,'pending'); checks++
  host = await TeamJournal.open(join(root,'host'),hostKey)
  const hostSend: QueueTransport = async operation => {
    const history=host!.replay(), existing=history.find(entry=>entry.operation.id===operation.id)
    if (!existing) {
      try { replayTeam([...history,{version:1,sequence:history.length+1,previous:host!.checkpoint().digest,operation}],new Set()) }
      catch(error) { return {type:'conflict',operationId:operation.id,message:error instanceof Error?error.message:'Conflict'} }
    }
    const receipt=await host!.append(operation); return {type:'ack',operationId:operation.id,receipt}
  }
  let calls=0
  assert.equal((await queue.drain(async operation=>{calls++;await hostSend(operation,new AbortController().signal);throw new Error('Lost ACK after host commit')})).status,'deferred')
  assert.equal(host.replay().length,1); assert.equal(queue.view()[0].status,'pending'); assert.equal(queue.view()[0].attempts,1)
  await queue.close(); queue=await PendingQueue.open(outbox,key,binding,objects)
  assert.equal((await queue.drain(async(op,signal)=>{calls++;return hostSend(op,signal)})).status,'idle')
  assert.equal(calls,2); assert.equal(host.replay().length,1); assert.equal(queue.view()[0].status,'acknowledged')
  await queue.close(); queue=await PendingQueue.open(outbox,key,binding,objects)
  await queue.enqueue(board('one')); await queue.drain(async()=>{throw new Error('Must not resend acknowledged work')}); checks++
  await queue.enqueue(board('two',1))
  let release!:()=>void, entered!:()=>void
  const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
  const concurrent:QueueTransport=async(op,signal)=>{entered();await gate;return hostSend(op,signal)}
  const first=queue.drain(concurrent), second=queue.drain(concurrent); assert.equal(first,second); await started; release(); await first
  assert.equal(queue.view().find(item=>item.operation.id==='two')?.attempts,1); checks++
  // Conflicts block followers; explicit replacement preserves the slot and old work.
  await queue.enqueue(board('stale',0)); await queue.enqueue(board('dependent',3))
  assert.equal((await queue.drain(hostSend)).status,'blocked')
  assert.equal(queue.view().find(item=>item.operation.id==='dependent')?.attempts,0)
  await queue.close(); queue=await PendingQueue.open(outbox,key,binding,objects)
  let sent=0; assert.equal((await queue.drain(async(op,s)=>{sent++;return hostSend(op,s)})).status,'blocked');assert.equal(sent,0)
  await assert.rejects(queue.replaceConflict('stale',board('stale',2)),/new operation/)
  await queue.replaceConflict('stale',board('resolved',2)); await queue.drain(hostSend)
  const conflict=queue.view().find(item=>item.operation.id==='stale')!;assert.equal(conflict.status,'superseded');assert.equal(conflict.operation.payload.expectedRevision,0);assert.equal(conflict.replacedBy,'resolved')
  assert.deepEqual(host.replay().map(entry=>entry.operation.id),['one','two','resolved','dependent']);checks++
  // Stop a transport which ignores AbortSignal; its late reply must not clear pending work.
  await queue.enqueue(board('stop-me',4))
  let finish!:(value:any)=>void, signalEntered!:()=>void
  const reached=new Promise<void>(resolve=>{signalEntered=resolve})
  const stopped=queue.drain(async()=>{signalEntered();return new Promise(resolve=>{finish=resolve})})
  await reached; queue.stop(); assert.equal((await stopped).status,'stopped')
  finish({type:'ack',operationId:'stop-me',receipt:{sequence:500,digest:'a'.repeat(64)}})
  await queue.close();queue=await PendingQueue.open(outbox,key,binding,objects);assert.equal(queue.view().find(item=>item.operation.id==='stop-me')?.status,'pending')
  await queue.drain(hostSend);checks++
  await queue.enqueue(board('bad-ack',5))
  assert.equal((await queue.drain(async()=>({type:'ack',operationId:'someone-else',receipt:{sequence:1,digest:'a'.repeat(64)}}))).status,'deferred')
  assert.equal((await queue.drain(async()=>({type:'ack',operationId:'bad-ack',receipt:{sequence:NaN,digest:'x'}}))).status,'deferred')
  assert.equal(queue.view().find(item=>item.operation.id==='bad-ack')?.status,'pending');await queue.drain(hostSend);checks++
  // Original bytes are durable before enqueue and rechecked before dispatch.
  const attachment=await objects.putAttachment(Buffer.from('Original pending attachment'))
  const withOriginal:TypedTeamOperation={id:'with-original',actor:'alice',kind:'team.backchat.post.v1',payload:{id:'post',threadId:'thread',text:'',attachments:[attachment],links:[]}}
  await assert.rejects(queue.enqueue({...withOriginal,id:'missing-original',payload:{...withOriginal.payload,attachments:['f'.repeat(64)]}}))
  await queue.enqueue(withOriginal)
  const originalPath=join(root,'objects',`attachment-${attachment}`),ciphertext=await readFile(originalPath),bad=Buffer.from(ciphertext);bad[15]^=1;await writeFile(originalPath,bad)
  let dispatched=false;assert.equal((await queue.drain(async()=>{dispatched=true;throw new Error('Must not send')})).status,'deferred');assert.equal(dispatched,false)
  await writeFile(originalPath,ciphertext)
  await queue.drain(async operation=>({type:'ack',operationId:operation.id,receipt:{sequence:100,digest:'b'.repeat(64)}}));checks++
  // Closing aborts even an uncooperative transport, drains local commits, and retains its operation.
  const closeDirectory=join(root,'close-outbox'),closingQueue=await PendingQueue.open(closeDirectory,key,binding,objects)
  await closingQueue.enqueue(board('close-operation',0,'close-board'))
  let closeEntered!:()=>void,lateClose!:(value:any)=>void
  const closeStarted=new Promise<void>(resolve=>{closeEntered=resolve})
  const closeRun=closingQueue.drain(async()=>{closeEntered();return new Promise(resolve=>{lateClose=resolve})})
  await closeStarted;const closing=closingQueue.close();assert.equal(closing,closingQueue.close());await closing;assert.equal((await closeRun).status,'stopped')
  await assert.rejects(closingQueue.enqueue(board('after-close')),/closed/)
  lateClose({type:'ack',operationId:'close-operation',receipt:{sequence:100,digest:'c'.repeat(64)}})
  const reopenedClose=await PendingQueue.open(closeDirectory,key,binding,objects);assert.equal(reopenedClose.view()[0].status,'pending');await reopenedClose.drain(hostSend);await reopenedClose.close();checks++
  // A host receipt must not clear local work until its local acknowledgement event is durable.
  const ackDirectory=join(root,'ack-outbox');let ackQueue=await PendingQueue.open(ackDirectory,key,binding,objects)
  await ackQueue.enqueue(board('ack-flush',0,'ack-board'))
  const ackFile=(ackQueue as any).journal.file,ackSync=ackFile.sync.bind(ackFile),hostCount=host.replay().length
  await assert.rejects(ackQueue.drain(async(op,signal)=>{const result=await hostSend(op,signal);ackFile.sync=async()=>{throw new Error('Injected ACK flush failure')};return result}),/ACK flush failure/)
  assert.equal(ackQueue.view()[0].status,'pending');assert.equal(host.replay().length,hostCount+1)
  await assert.rejects(ackQueue.drain(hostSend),/recovery/);ackFile.sync=ackSync;await ackQueue.close()
  ackQueue=await PendingQueue.open(ackDirectory,key,binding,objects);await ackQueue.drain(hostSend);assert.equal(ackQueue.view()[0].status,'acknowledged');assert.equal(host.replay().length,hostCount+1);await ackQueue.close();checks++
  // A disk flush failure cannot make a new enqueue dispatchable.
  const file=(queue as any).journal.file, sync=file.sync.bind(file)
  file.sync=async()=>{throw new Error('Injected local flush failure')}
  await assert.rejects(queue.enqueue(board('uncertain-local',6)),/flush failure/)
  assert.ok(!queue.view().some(item=>item.operation.id==='uncertain-local'))
  await assert.rejects(queue.drain(async()=>{throw new Error('Must not dispatch')}),/recovery/)
  file.sync=sync;await queue.close();queue=undefined;checks++
  // Real process kills after enqueue and after a host commit with no client acknowledgement.
  for (const phase of ['pending','host']) {
    const crashRoot=join(root,`crash-${phase}`);await mkdir(crashRoot)
    const child=spawn(process.execPath,['--import','tsx',fileURLToPath(import.meta.url),'child',crashRoot,key.toString('hex'),objectKey.toString('hex'),phase,hostKey.toString('hex')],{stdio:['ignore','pipe','pipe']})
    await new Promise<void>((resolve,reject)=>{
      let text='';const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Queue child timeout'))},15000)
      child.stdout.on('data',chunk=>{text+=chunk;if(text.includes(phase==='pending'?'DURABLE':'HOST_DURABLE')){clearTimeout(timeout);child.kill('SIGKILL');resolve()}})
      child.on('error',error=>{clearTimeout(timeout);reject(error)});child.on('exit',code=>{clearTimeout(timeout);if(!text.includes('DURABLE'))reject(new Error(`Child exited early ${code}`))})
    })
    if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('exit',resolve))
    const childObjects=await TeamObjects.open(join(crashRoot,'objects'),objectKey,binding.team)
    await assert.rejects(PendingQueue.open(join(crashRoot,'outbox'),key,binding,childObjects),/EEXIST/)
    await unlink(join(crashRoot,'outbox','writer.lock')) // Explicit offline lock recovery only.
    const recovered=await PendingQueue.open(join(crashRoot,'outbox'),key,binding,childObjects)
    assert.equal(recovered.view()[0].status,'pending');assert.equal(recovered.view()[0].operation.id,'crash-operation')
    const childHost=await TeamJournal.open(join(crashRoot,'host'),hostKey)
    await recovered.drain(async operation=>({type:'ack',operationId:operation.id,receipt:await childHost.append(operation)}))
    assert.equal(childHost.replay().length,1);assert.equal(recovered.view()[0].status,'acknowledged')
    await recovered.close();await childHost.close()
  }checks++
  console.log(`PASS ${checks} durable pending queue checks: encrypted persist-before-dispatch, clone/idempotence/scope isolation, lost-ACK host deduplication, one concurrent drain, FIFO retained conflicts and explicit replacement, stop/late ACK, malformed receipts, original availability, flush failure/no dispatch, real SIGKILL after enqueue and after host commit before ACK. Fake transport only; no networking.`)
} finally {await queue?.close();await host?.close();key.fill(0);objectKey.fill(0);hostKey.fill(0);await rm(root,{recursive:true,force:true})}
}
