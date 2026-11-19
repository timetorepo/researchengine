import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { TeamHost } from '../src/teams/host'
import { replayTeam, type TypedTeamOperation } from '../src/teams/replay'
import { exportRecovery, restoreRecovery } from '../src/teams/recovery'
import { PendingQueue } from '../src/teams/pending'
const root=await mkdtemp(join(tmpdir(),'re-host-')),keys={journal:randomBytes(32),objects:randomBytes(32),backup:randomBytes(32)}
let now=1000000,host:TeamHost|undefined,checks=0
const board=(id:string,actor:string,revision=0,boardId='board'):TypedTeamOperation=>({id,actor,kind:'team.board.replace.v1',payload:{boardId,expectedRevision:revision,title:'Shared evidence',items:[]}})
try{
 const directory=join(root,'journal'),init=await TeamJournal.open(directory,keys.journal);await init.close()
 const objects=await TeamObjects.open(join(root,'objects'),keys.objects,'team-one')
 await assert.rejects(TeamHost.open(directory,keys.journal,objects),/bootstrap/)
 const opened=await TeamHost.open(directory,keys.journal,objects,{bootstrap:{owner:'owner',durationMs:86400000},clock:()=>now});host=opened.host
 const owner=opened.session!;assert.equal((await host.read(owner.credential)).role,'Owner')
 assert.equal((await host.read(owner.credential)).state.access,undefined)
 await host.setMember(owner.credential,'admin','Admin',true);await host.setMember(owner.credential,'editor','Editor',true);await host.setMember(owner.credential,'viewer','Viewer',true)
 const admin=await host.issueSession(owner.credential,'admin',100000),editor=await host.issueSession(owner.credential,'editor',100000),viewer=await host.issueSession(owner.credential,'viewer',100000)
 assert.equal((await host.read(viewer.credential)).role,'Viewer');checks++
 const sequence=(await host.read(owner.credential)).state.sequence
 await assert.rejects(host.submit(viewer.credential,board('viewer-write','viewer')),/Viewer/)
 await assert.rejects(host.putAttachment(viewer.credential,Buffer.from('forbidden')),/Viewer/)
 await assert.rejects(host.setMember(editor.credential,'new','Viewer',true),/Insufficient/)
 await assert.rejects(host.issueSession(viewer.credential,'viewer',5000),/Owner\/Admin/)
 await assert.rejects(host.access(viewer.credential),/Owner\/Admin/)
 await assert.rejects(host.submit(editor.credential,board('spoof','owner')),/actor/)
 await assert.rejects(host.submit(editor.credential,{id:'injected-access',actor:'editor',kind:'team.access.member.v1',payload:{member:'editor',role:'Owner',active:true}} as any),/dedicated/)
 await assert.rejects(host.read('unknown-token'))
 assert.equal((await host.read(owner.credential)).state.sequence,sequence);checks++
 await host.setMember(admin.credential,'managed','Editor',true)
 await assert.rejects(host.setMember(admin.credential,'owner','Viewer',false),/Owner/)
 await assert.rejects(host.setMember(admin.credential,'another-admin','Admin',true),/Insufficient/)
 await assert.rejects(host.setMember(admin.credential,'admin','Editor',true),/Insufficient/)
 await assert.rejects(host.issueSession(admin.credential,'owner',10000),/Insufficient/)
 await assert.rejects(host.revokeSession(admin.credential,owner.digest),/Insufficient/)
 await assert.rejects(host.setMember(owner.credential,'owner','Viewer',false),/Owner/)
 await assert.rejects(host.setMember(owner.credential,'second-owner','Owner',true),/Owner/)
 const managed=await host.issueSession(admin.credential,'managed',10000);await host.revokeSession(admin.credential,managed.digest);await assert.rejects(host.read(managed.credential),/revoked/);checks++
 const first=board('race-a','editor'),second=board('race-b','editor')
 const raced=await Promise.allSettled([host.submit(editor.credential,first),host.submit(editor.credential,second)])
 assert.equal(raced.filter(result=>result.status==='fulfilled').length,1);assert.equal(raced.filter(result=>result.status==='rejected').length,1)
 assert.equal((await host.read(owner.credential)).state.boards[0].revision,1)
 const receipt=await host.submit(editor.credential,first),prior=(await host.read(owner.credential)).state.sequence
 assert.deepEqual(await host.submit(editor.credential,first),receipt);assert.equal((await host.read(owner.credential)).state.sequence,prior)
 await assert.rejects(host.submit(editor.credential,{...first,payload:{...first.payload,title:'Changed content'}} as any),/different content/);checks++
 const demotion=host.setMember(owner.credential,'editor','Viewer',true),queued=host.submit(editor.credential,board('after-demote','editor',1))
 await demotion;await assert.rejects(queued,/Viewer/)
 await host.setMember(owner.credential,'editor','Editor',true)
 await host.setMember(owner.credential,'viewer','Viewer',false);await assert.rejects(host.read(viewer.credential),/revoked|inactive/)
 await host.setMember(owner.credential,'viewer','Viewer',true);await assert.rejects(host.read(viewer.credential),/revoked/)
 const replacementViewer=await host.issueSession(owner.credential,'viewer',10000);assert.equal((await host.read(replacementViewer.credential)).role,'Viewer');checks++
 const expiring=await host.issueSession(owner.credential,'editor',10)
 now+=10;await assert.rejects(host.read(expiring.credential),/expired/);now-=20;await assert.rejects(host.read(expiring.credential),/expired/);now+=10
 await assert.rejects(host.issueSession(owner.credential,'editor',86400001),/24 hours/)
 await host.revokeSession(editor.credential,editor.digest);await assert.rejects(host.read(editor.credential),/revoked/)
 const currentEditor=await host.issueSession(owner.credential,'editor',100000);checks++
 const original=await host.putAttachment(currentEditor.credential,Buffer.from('Team original'))
 await assert.rejects(host.getAttachment(replacementViewer.credential,original),/not referenced/)
 const withImage=board('with-image','editor',1);(withImage.payload as any).items=[{id:'image',kind:'image',x:0,y:0,width:160,height:120,text:'Original',attachmentId:original}]
 await host.submit(currentEditor.credential,withImage)
 assert.equal((await host.getAttachment(replacementViewer.credential,original)).toString(),'Team original')
 await assert.rejects(host.getAttachment(replacementViewer.credential,'f'.repeat(64)),/not referenced/)
 const missing=board('missing-original','editor',2);(missing.payload as any).items=[{id:'missing',kind:'pdf',x:0,y:0,width:160,height:120,text:'Missing',attachmentId:'f'.repeat(64)}]
 await assert.rejects(host.submit(currentEditor.credential,missing),/missing attachment/);checks++
 const queue=await PendingQueue.open(join(root,'outbox'),randomBytes(32),{team:'team-one',client:'client',actor:'editor'},objects)
 await queue.enqueue(board('lost-ack','editor',2));let requests=0
 const hostBefore=(await host.read(owner.credential)).state.sequence
 assert.equal((await queue.drain(async operation=>{requests++;await host!.submit(currentEditor.credential,operation as any);throw new Error('Lost response')})).status,'deferred')
 await queue.drain(async operation=>{requests++;return{type:'ack',operationId:operation.id,receipt:await host!.submit(currentEditor.credential,operation as any)}})
 assert.equal(requests,2);assert.equal((await host.read(owner.credential)).state.sequence,hostBefore+1)
 assert.equal(queue.view()[0].status,'acknowledged');await queue.close();checks++
 await host.close();host=undefined
 const journal=await TeamJournal.open(directory,keys.journal),history=journal.replay()
 assert.ok(!JSON.stringify(history).includes(owner.credential));assert.ok(!JSON.stringify(history).includes(currentEditor.credential))
 const forged=board('forged-viewer-write','viewer',3)
 assert.throws(()=>replayTeam([...history,{version:1,sequence:history.length+1,previous:journal.checkpoint().digest,operation:forged}],new Set([original])),/Viewer/)
 const secondBootstrap={id:'second-bootstrap',actor:'owner',kind:'team.access.bootstrap.v1',payload:{owner:'owner',digest:'a'.repeat(64),issuedAt:now,expiresAt:now+10000}}
 assert.throws(()=>replayTeam([...history,{version:1,sequence:history.length+1,previous:journal.checkpoint().digest,operation:secondBootstrap}],new Set([original])),/first operation/)
 const archive=await objects.exportArchive(),available=new Set(archive.objects.filter(value=>value.kind==='attachment').map(value=>value.id))
 assert.equal(replayTeam(history,available).access!.owner,'owner')
 const backupCheckpoint=journal.checkpoint(),bundle=await exportRecovery(journal,objects,keys,'team-one','team-state-v1');await journal.close()
 host=(await TeamHost.open(directory,keys.journal,objects,{clock:()=>now})).host
 assert.equal((await host.read(owner.credential)).role,'Owner');await assert.rejects(host.read(editor.credential),/revoked/)
 await host.close();host=undefined
 await assert.rejects(TeamHost.open(directory,keys.journal,objects,{bootstrap:{owner:'attacker',durationMs:10000}}),/bootstrap/)
 const restored=join(root,'restored');await restoreRecovery(bundle,restored,keys,'team-one','team-state-v1')
 const restoredObjects=await TeamObjects.open(join(restored,'objects'),keys.objects,'team-one')
 await assert.rejects(TeamHost.open(join(restored,'journal'),keys.journal,restoredObjects,{clock:()=>now}),/Restored data/)
 const activated=await TeamHost.recoverOwner(join(restored,'journal'),keys.journal,restoredObjects,{owner:'owner',expectedCheckpoint:backupCheckpoint,durationMs:100000,confirmInvalidateAll:true},{clock:()=>now,restoreKey:keys.backup})
 host=activated.host
 await assert.rejects(host.read(editor.credential),/revoked/);await assert.rejects(host.read(owner.credential),/revoked/);assert.equal((await host.read(activated.session!.credential)).role,'Owner');checks++
 // Separate team credentials are not interchangeable, even with the same recorded member name.
 const otherDirectory=join(root,'other-journal'),otherKey=randomBytes(32),otherJournal=await TeamJournal.open(otherDirectory,otherKey);await otherJournal.close()
 const otherObjects=await TeamObjects.open(join(root,'other-objects'),randomBytes(32),'team-two')
 const other=await TeamHost.open(otherDirectory,otherKey,otherObjects,{bootstrap:{owner:'owner',durationMs:10000},clock:()=>now})
 await assert.rejects(other.host.read(owner.credential),/unknown/);await assert.rejects(host.read(other.session!.credential),/unknown/);await other.host.close();checks++
 // Failed durable append cannot publish state or accept subsequent work.
 const afterActivation=await host.issueSession(activated.session!.credential,'editor',100000)
 const handle=(host as any).journal.file,originalSync=handle.sync.bind(handle),stateBefore=(await host.read(activated.session!.credential)).state
 handle.sync=async()=>{throw new Error('Injected host flush failure')}
 await assert.rejects(host.submit(afterActivation.credential,board('uncertain-host','editor',3)),/flush failure/)
 assert.equal((host as any).state.sequence,stateBefore.sequence)
 await assert.rejects(host.read(owner.credential),/recovery/);handle.sync=originalSync;await host.close();host=undefined;checks++
 console.log(`PASS ${checks} local Teams host checks: durable Owner bootstrap, all role gates and actor binding, Admin boundaries, serialized revision race/idempotence, queued demotion/revocation, expiry/clock bounds, attachment scope, real outbox lost-ACK retry, restart/typed recovery preserving revocations, cross-team credential isolation, flush failure/no ACK/state publication. No listeners or networking.`)
}finally{await host?.close();Object.values(keys).forEach(key=>key.fill(0));await rm(root,{recursive:true,force:true})}
