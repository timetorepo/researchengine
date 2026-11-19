import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, stat, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { initializeOfflineHost, backupOfflineHost, restoreOfflinePackage, recoverOfflineOwner } from '../src/teams/operator'
import { unlockHostKeyring, clearHostKeys } from '../src/teams/keyring'
import { unlockOwnerCredential } from '../src/teams/credential'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { TeamHost } from '../src/teams/host'
import { exportRecovery, restoreRecovery } from '../src/teams/recovery'
const root=await mkdtemp(join(tmpdir(),'re-owner-recovery-')),password=Buffer.from(randomBytes(24).toString('base64')),wrong=Buffer.from(randomBytes(24).toString('base64'))
let checks=0,host:TeamHost|undefined
const checkpoint=async(directory:string,key:Buffer)=>{const journal=await TeamJournal.open(join(directory,'journal'),key,{create:false,recoverTail:false});try{return journal.checkpoint()}finally{await journal.close()}}
try{
 const source=join(root,'source');await initializeOfflineHost(source,'team-one',password)
 const originalKeyring=await readFile(join(source,'host.keys')),keys=await unlockHostKeyring(originalKeyring,password)
 try{
  const objects=await TeamObjects.open(join(source,'objects'),keys.keys.objects,keys.team)
  const started=await TeamHost.open(join(source,'journal'),keys.keys.journal,objects,{bootstrap:{owner:'owner',durationMs:86400000}});host=started.host
  const owner=started.session!;await host.setMember(owner.credential,'editor','Editor',true);const editor=await host.issueSession(owner.credential,'editor',86400000)
  await host.submit(editor.credential,{id:'board-one',actor:'editor',kind:'team.board.replace.v1',payload:{boardId:'board',expectedRevision:0,title:'Retained shared Board',items:[]}})
  await host.close();host=undefined
  const originalCheckpoint=await checkpoint(source,keys.keys.journal),oldPackage=join(root,'old.reteam');await backupOfflineHost(source,oldPackage,password)
  const artifact=join(root,'owner.credential')
  await assert.rejects(recoverOfflineOwner(source,source,'owner',originalCheckpoint,artifact,password,false),/confirmation/)
  await assert.rejects(recoverOfflineOwner(source,source,'not-owner',originalCheckpoint,artifact,password,true),/Owner\/checkpoint/)
  await assert.rejects(recoverOfflineOwner(source,source,'owner',{...originalCheckpoint,digest:'f'.repeat(64)},artifact,password,true),/Owner\/checkpoint/)
  await assert.rejects(recoverOfflineOwner(source,source,'owner',originalCheckpoint,artifact,wrong,true))
  await writeFile(artifact,'KEEP');await assert.rejects(recoverOfflineOwner(source,source,'owner',originalCheckpoint,artifact,password,true),/already exists/);assert.equal((await readFile(artifact)).toString(),'KEEP');await rm(artifact)
  assert.deepEqual(await checkpoint(source,keys.keys.journal),originalCheckpoint);checks++
  // Subprocess CLI must deliver only encrypted ciphertext, never a raw bearer in output/arguments.
  const cli=await new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx',new URL('./teams-offline.ts',import.meta.url).pathname,'recover-owner',source,source,'owner',String(originalCheckpoint.sequence),originalCheckpoint.digest,artifact,'--confirm-invalidate-all'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr=''
   child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',code=>resolve({code,stdout,stderr}));child.stdin.end(password)
  })
  assert.equal(cli.code,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).result.encryptedCredentialPublished,true)
  const encrypted=await readFile(artifact),fresh=await unlockOwnerCredential(encrypted,password,keys.team)
  assert.equal((await stat(artifact)).mode&0o777,0o600);assert.ok(!encrypted.includes(fresh.credential));assert.ok(!encrypted.includes(password));assert.ok(!cli.stdout.includes(fresh.credential));assert.ok(!cli.stderr.includes(fresh.credential))
  await assert.rejects(unlockOwnerCredential(encrypted,wrong,keys.team));await assert.rejects(unlockOwnerCredential(encrypted,password,'team-two'))
  const damaged=Buffer.from(encrypted);damaged[damaged.length-10]^=1;await assert.rejects(unlockOwnerCredential(damaged,password,keys.team));checks++
  host=(await TeamHost.open(join(source,'journal'),keys.keys.journal,objects)).host
  await assert.rejects(host.read(owner.credential),/revoked/);await assert.rejects(host.read(editor.credential),/revoked/)
  assert.equal((await host.read(fresh.credential)).state.boards[0].title,'Retained shared Board')
  const accessState=await host.access(fresh.credential);assert.equal(accessState.members.find(member=>member.id==='editor')?.role,'Editor');assert.equal(accessState.sessions.filter(session=>!session.revoked).length,1)
  await host.close();host=undefined
  await assert.rejects(recoverOfflineOwner(source,source,'owner',originalCheckpoint,join(root,'stale.credential'),password,true),/checkpoint/)
  assert.deepEqual(await readFile(join(source,'host.keys')),originalKeyring);checks++
  // Restoring an older valid package cannot make its still-unexpired tokens usable at this host core.
  const restored=join(root,'restored');await restoreOfflinePackage(source,oldPackage,restored,password)
  const restoredObjects=await TeamObjects.open(join(restored,'objects'),keys.keys.objects,keys.team)
  await assert.rejects(TeamHost.open(join(restored,'journal'),keys.keys.journal,restoredObjects),/Restored data/)
  await assert.rejects(TeamHost.open(join(restored,'journal'),keys.keys.journal,restoredObjects,{restoreKey:keys.keys.backup}),/explicit session/)
  await assert.rejects(TeamHost.open(join(restored,'journal'),keys.keys.journal,restoredObjects,{restoreKey:randomBytes(32)}))
  const activatedFile=join(root,'activated.credential');await recoverOfflineOwner(source,restored,'owner',originalCheckpoint,activatedFile,password,true)
  const activated=await unlockOwnerCredential(await readFile(activatedFile),password,keys.team)
  host=(await TeamHost.open(join(restored,'journal'),keys.keys.journal,restoredObjects,{restoreKey:keys.keys.backup})).host
  await assert.rejects(host.read(owner.credential),/revoked/);await assert.rejects(host.read(editor.credential),/revoked/);await assert.rejects(host.read(fresh.credential),/unknown/)
  assert.equal((await host.read(activated.credential)).role,'Owner');assert.equal((await host.access(activated.credential)).lastRecovery?.reason,'restore-activation')
  await host.close();host=undefined;checks++
  // A backup of an activated host still requires a NEW invalidation when restored again.
  const journal=await TeamJournal.open(join(restored,'journal'),keys.keys.journal),afterActivation=journal.checkpoint(),againBundle=await exportRecovery(journal,restoredObjects,keys.keys,keys.team,'team-state-v1');await journal.close()
  const again=join(root,'again');await restoreRecovery(againBundle,again,keys.keys,keys.team,'team-state-v1')
  const againObjects=await TeamObjects.open(join(again,'objects'),keys.keys.objects,keys.team)
  await assert.rejects(TeamHost.open(join(again,'journal'),keys.keys.journal,againObjects,{restoreKey:keys.keys.backup}),/explicit session/)
  await recoverOfflineOwner(source,again,'owner',afterActivation,join(root,'again.credential'),password,true)
  host=(await TeamHost.open(join(again,'journal'),keys.keys.journal,againObjects,{restoreKey:keys.keys.backup})).host;await assert.rejects(host.read(activated.credential),/revoked/);await host.close();host=undefined;checks++
  // Recovery remains available when every bearer has expired; it needs trusted-local key access, not a bearer.
  const expired=join(root,'expired');await initializeOfflineHost(expired,'expired-team',password)
  const expiredKeys=await unlockHostKeyring(await readFile(join(expired,'host.keys')),password)
  try{
   const expiredObjects=await TeamObjects.open(join(expired,'objects'),expiredKeys.keys.objects,expiredKeys.team)
   const old=await TeamHost.open(join(expired,'journal'),expiredKeys.keys.journal,expiredObjects,{bootstrap:{owner:'owner',durationMs:10},clock:()=>1000});await old.host.close()
   const expected=await checkpoint(expired,expiredKeys.keys.journal)
   const recovered=await TeamHost.recoverOwner(join(expired,'journal'),expiredKeys.keys.journal,expiredObjects,{owner:'owner',durationMs:10000,expectedCheckpoint:expected,confirmInvalidateAll:true},{clock:()=>1011});host=recovered.host
   await assert.rejects(host.read(old.session!.credential),/revoked|expired/);assert.equal((await host.read(recovered.session!.credential)).role,'Owner');await host.close();host=undefined
  }finally{clearHostKeys(expiredKeys)}checks++
  // A durable recovery followed by a lost response may revoke everything without delivering the new token.
  const beforeLost=await checkpoint(source,keys.keys.journal),append=TeamJournal.prototype.append
  TeamJournal.prototype.append=async function(operation){const result=await append.call(this,operation);if(operation.kind==='team.access.recover.v1')throw new Error('Injected lost recovery response');return result}
  try{await assert.rejects(TeamHost.recoverOwner(join(source,'journal'),keys.keys.journal,objects,{owner:'owner',durationMs:10000,expectedCheckpoint:beforeLost,confirmInvalidateAll:true}),/lost recovery/)}finally{TeamJournal.prototype.append=append}
  const afterLost=await checkpoint(source,keys.keys.journal);assert.equal(afterLost.sequence,beforeLost.sequence+1)
  host=(await TeamHost.open(join(source,'journal'),keys.keys.journal,objects)).host;await assert.rejects(host.read(fresh.credential),/revoked/);await host.close();host=undefined
  const retried=await TeamHost.recoverOwner(join(source,'journal'),keys.keys.journal,objects,{owner:'owner',durationMs:10000,expectedCheckpoint:afterLost,confirmInvalidateAll:true});host=retried.host
  assert.equal((await host.read(retried.session!.credential)).role,'Owner');await host.close();host=undefined;checks++
  // Incomplete restore markers cannot be bypassed by bootstrapping an empty journal.
  const incomplete=join(root,'incomplete');await initializeOfflineHost(incomplete,'team-one',password);await writeFile(join(incomplete,'INCOMPLETE'),'Interrupted')
  const incompleteKeys=await unlockHostKeyring(await readFile(join(incomplete,'host.keys')),password)
  try{const incompleteObjects=await TeamObjects.open(join(incomplete,'objects'),incompleteKeys.keys.objects,'team-one');await assert.rejects(TeamHost.open(join(incomplete,'journal'),incompleteKeys.keys.journal,incompleteObjects,{bootstrap:{owner:'owner',durationMs:10000}}),/restored or incomplete/)}finally{clearHostKeys(incompleteKeys)}
  await assert.rejects(access(join(root,'stale.credential')));checks++
 }finally{clearHostKeys(keys)}
 console.log(`PASS ${checks} trusted-local Owner recovery checks: explicit confirmation/checkpoint/no overwrite, encrypted CLI credential delivery, all-session invalidation with content/roles preserved, authenticated restore activation, repeat-restore reset, all-expired credential recovery, durable commit/lost response recovery, incomplete-restore bootstrap refusal. No networking.`)
}finally{await host?.close();password.fill(0);wrong.fill(0);await rm(root,{recursive:true,force:true})}
