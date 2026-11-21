import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm,access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {initializeOfflineHost,maintainOfflineStorage,backupOfflineHost} from '../src/teams/operator'
import {unlockHostKeyring,clearHostKeys} from '../src/teams/keyring'
import {TeamObjects} from '../src/teams/objects'
import {TeamJournal} from '../src/teams/journal'
import {replayTeam} from '../src/teams/replay'
const parent=await mkdtemp(join(tmpdir(),'re-storage-')),root=join(parent,'host'),password=Buffer.from(randomBytes(24).toString('base64'))
try{
 await initializeOfflineHost(root,'storage-test',password)
 const keys=await unlockHostKeyring(await readFile(join(root,'host.keys')),password)
 try{
 const objects=await TeamObjects.open(join(root,'objects'),keys.keys.objects,keys.team,{create:false}),journal=await TeamJournal.open(join(root,'journal'),keys.keys.journal,{create:false})
 const keep=await objects.putAttachment(Buffer.from('historical original')),orphan=await objects.putAttachment(Buffer.from('orphan upload'))
 try{
 await journal.append({id:'revision-one',actor:'owner',kind:'team.board.replace.v1',payload:{boardId:'board',expectedRevision:0,title:'Original',items:[{id:'image',kind:'image',text:'',x:0,y:0,width:100,height:100,attachmentId:keep}]}})
 await journal.append({id:'revision-two',actor:'owner',kind:'team.board.replace.v1',payload:{boardId:'board',expectedRevision:1,title:'Removed image from current board',items:[]}})
 const state=replayTeam(journal.replay(),new Set([keep,orphan]));await objects.putSnapshot({version:1,checkpoint:journal.checkpoint(),state,attachments:state.requiredAttachments},journal)
 await assert.rejects(maintainOfflineStorage(root,password),/EEXIST/)
 }finally{await journal.close()}
 const report=await maintainOfflineStorage(root,password);assert.deepEqual(report.orphanIds,[orphan]);assert.ok(report.orphanBytes>0);assert.equal(report.pruned,0)
 await assert.rejects(maintainOfflineStorage(root,password,'0'.repeat(64)),/plan changed/);await access(join(root,'objects','attachment-'+orphan))
 const added=await objects.putAttachment(Buffer.from('new upload after review'));await assert.rejects(maintainOfflineStorage(root,password,report.plan),/plan changed/)
 const fresh=await maintainOfflineStorage(root,password),pruned=await maintainOfflineStorage(root,password,fresh.plan);assert.equal(pruned.pruned,2)
 await assert.rejects(access(join(root,'objects','attachment-'+orphan)));await assert.rejects(access(join(root,'objects','attachment-'+added)));assert.equal((await objects.getAttachment(keep)).toString(),'historical original')
 const after=await maintainOfflineStorage(root,password);assert.equal(after.orphanIds.length,0);await backupOfflineHost(root,join(parent,'after-prune.backup'),password)
 // Quota counts encrypted bytes + GCM overhead; identical objects consume no additional budget.
 await assert.rejects(objects.putAttachment(Buffer.alloc(128),after.objectBytes+127+28),/quota/)
 assert.equal(await objects.putAttachment(Buffer.from('historical original'),1),keep)
 await assert.rejects(objects.putAttachment(Buffer.from('new'),0),/Invalid/)
 }finally{clearHostKeys(keys)}
 console.log('PASS storage: locked offline audit, historical/snapshot references retained after current-board removal, exact-inventory reviewed prune, stale-plan/no-write refusal, orphan removal, post-prune validated backup, encrypted-byte admission quota and dedup. Not resumable file streaming or an OS disk quota.')
}finally{password.fill(0);await rm(parent,{recursive:true,force:true})}
