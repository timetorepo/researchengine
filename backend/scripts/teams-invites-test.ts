import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { TeamHost } from '../src/teams/host'
import { replayTeam } from '../src/teams/replay'
import { exportRecovery, restoreRecovery } from '../src/teams/recovery'
const root=await mkdtemp(join(tmpdir(),'re-invites-')),keys={journal:randomBytes(32),objects:randomBytes(32),backup:randomBytes(32)}
let host:TeamHost|undefined,now=1000000,checks=0
try{
 const directory=join(root,'journal'),initial=await TeamJournal.open(directory,keys.journal);await initial.close()
 const objects=await TeamObjects.open(join(root,'objects'),keys.objects,'team-one')
 const opened=await TeamHost.open(directory,keys.journal,objects,{bootstrap:{owner:'owner',durationMs:86400000},clock:()=>now});host=opened.host;const owner=opened.session!
 for(const [member,role]of [['admin','Admin'],['editor','Editor'],['viewer','Viewer']] as const)await host.setMember(owner.credential,member,role,true)
 const admin=await host.issueSession(owner.credential,'admin',86400000),editor=await host.issueSession(owner.credential,'editor',86400000),viewer=await host.issueSession(owner.credential,'viewer',86400000)
 const before=(await host.read(owner.credential)).state.sequence
 await assert.rejects(host.issueInvite(editor.credential,'Editor',10000,10000),/Insufficient/)
 await assert.rejects(host.issueInvite(viewer.credential,'Viewer',10000,10000),/Insufficient/)
 await assert.rejects(host.issueInvite(admin.credential,'Admin',10000,10000),/Insufficient/)
 await assert.rejects(host.issueInvite(owner.credential,'Owner' as any,10000,10000),/scope/)
 for(const duration of [0,-1,NaN,86400001])await assert.rejects(host.issueInvite(owner.credential,'Viewer',duration,10000))
 await assert.rejects(host.issueInvite(owner.credential,'Viewer',10000,86400001))
 assert.equal((await host.read(owner.credential)).state.sequence,before);checks++
 const invite=await host.issueInvite(admin.credential,'Viewer',10000,5000)
 assert.equal(invite.role,'Viewer');assert.notEqual(invite.member,'admin');assert.equal((await host.access(owner.credential)).members.some(member=>member.id===invite.member),false)
 await assert.rejects(host.read(invite.invitation));await assert.rejects(host.redeemInvite(owner.credential))
 const races=await Promise.allSettled([host.redeemInvite(invite.invitation),host.redeemInvite(invite.invitation)])
 assert.equal(races.filter(value=>value.status==='fulfilled').length,1);assert.equal(races.filter(value=>value.status==='rejected').length,1)
 const joined=(races.find(value=>value.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<TeamHost['redeemInvite']>>>).value
 assert.equal(joined.member,invite.member);assert.equal((await host.read(joined.credential)).role,'Viewer')
 await assert.rejects(host.putAttachment(joined.credential,Buffer.from('forbidden')),/Viewer/)
 assert.equal((await host.access(owner.credential)).members.filter(member=>member.id===invite.member).length,1);checks++
 const adminInvite=await host.issueInvite(owner.credential,'Admin',10000,5000),newAdmin=await host.redeemInvite(adminInvite.invitation)
 assert.equal((await host.read(newAdmin.credential)).role,'Admin')
 await host.revokeInvite(owner.credential,adminInvite.digest);assert.equal((await host.read(newAdmin.credential)).role,'Admin') // Revoking a spent invite is not member/session revocation.
 await assert.rejects(host.revokeInvite(admin.credential,adminInvite.digest),/revocation/)
 const pending=await host.issueInvite(admin.credential,'Editor',10000,10000)
 await host.revokeInvite(owner.credential,pending.digest);await assert.rejects(host.redeemInvite(pending.invitation),/revoked/)
 const own=await host.issueInvite(admin.credential,'Viewer',10000,10000);await host.revokeInvite(admin.credential,own.digest);await assert.rejects(host.redeemInvite(own.invitation))
 await assert.rejects(host.revokeInvite(editor.credential,own.digest),/role/);checks++
 const expires=await host.issueInvite(owner.credential,'Viewer',10,10000)
 now+=10;await assert.rejects(host.redeemInvite(expires.invitation),/expired/);now-=11;await assert.rejects(host.redeemInvite(expires.invitation),/expired/);now+=1
 const sequence=(await host.read(owner.credential)).state.sequence,precommit=await host.issueInvite(owner.credential,'Viewer',10,10000)
 const originalExport=objects.exportArchive.bind(objects);objects.exportArchive=async()=>{const archive=await originalExport();now+=10;return archive}
 await assert.rejects(host.redeemInvite(precommit.invitation),/expired/);objects.exportArchive=originalExport
 assert.equal((await host.read(owner.credential)).state.sequence,sequence+1);checks++
 const demoted=await host.issueInvite(admin.credential,'Editor',10000,10000)
 await host.setMember(owner.credential,'admin','Editor',true);await host.setMember(owner.credential,'admin','Admin',true)
 await assert.rejects(host.redeemInvite(demoted.invitation),/revoked/)
 const deactivated=await host.issueInvite(admin.credential,'Viewer',10000,10000)
 await host.setMember(owner.credential,'admin','Admin',false);await host.setMember(owner.credential,'admin','Admin',true)
 await assert.rejects(host.redeemInvite(deactivated.invitation),/revoked/)
 const occupied=await host.issueInvite(owner.credential,'Viewer',10000,10000);await host.setMember(owner.credential,occupied.member,'Editor',true)
 await assert.rejects(host.redeemInvite(occupied.invitation),/already exists/);checks++
 const restartInvite=await host.issueInvite(owner.credential,'Editor',10000,10000)
 await host.close();host=undefined
 const journal=await TeamJournal.open(directory,keys.journal),history=journal.replay()
 for(const secret of [invite.invitation,joined.credential,adminInvite.invitation,restartInvite.invitation])assert.ok(!JSON.stringify(history).includes(secret))
 const last=journal.checkpoint(),forged={id:'forged',actor:'owner',kind:'team.access.invite.v1',payload:{digest:'a'.repeat(64),member:'owner',role:'Viewer',issuedAt:now,expiresAt:now+10000,sessionDurationMs:10000}}
 assert.throws(()=>replayTeam([...history,{version:1,sequence:last.sequence+1,previous:last.digest,operation:forged}],new Set()),/Owner/)
 const bundle=await exportRecovery(journal,objects,keys,'team-one','team-state-v1');await journal.close()
 host=(await TeamHost.open(directory,keys.journal,objects,{clock:()=>now})).host
 await assert.rejects(host.redeemInvite(invite.invitation),/consumed/);await assert.rejects(host.redeemInvite(pending.invitation),/revoked/)
 const restarted=await host.redeemInvite(restartInvite.invitation);assert.equal((await host.read(restarted.credential)).role,'Editor');checks++
 // Every recovery invalidates unused invitations, not just bearer sessions.
 const recoveryInvite=await host.issueInvite(owner.credential,'Viewer',10000,10000);await host.close();host=undefined
 const inspect=await TeamJournal.open(directory,keys.journal),expected=inspect.checkpoint();await inspect.close()
 const recovered=await TeamHost.recoverOwner(directory,keys.journal,objects,{owner:'owner',durationMs:10000,expectedCheckpoint:expected,confirmInvalidateAll:true},{clock:()=>now});host=recovered.host
 await assert.rejects(host.redeemInvite(recoveryInvite.invitation),/revoked/);await host.close();host=undefined
 const restored=join(root,'restored');await restoreRecovery(bundle,restored,keys,'team-one','team-state-v1')
 const restoredObjects=await TeamObjects.open(join(restored,'objects'),keys.objects,'team-one')
 const activated=await TeamHost.recoverOwner(join(restored,'journal'),keys.journal,restoredObjects,{owner:'owner',durationMs:10000,expectedCheckpoint:last,confirmInvalidateAll:true},{clock:()=>now,restoreKey:keys.backup});host=activated.host
 await assert.rejects(host.redeemInvite(restartInvite.invitation),/revoked/);await host.close();host=undefined;checks++
 const otherDir=join(root,'other-journal'),otherKey=randomBytes(32),otherInit=await TeamJournal.open(otherDir,otherKey);await otherInit.close()
 const otherObjects=await TeamObjects.open(join(root,'other-objects'),randomBytes(32),'team-two'),other=await TeamHost.open(otherDir,otherKey,otherObjects,{bootstrap:{owner:'owner',durationMs:10000},clock:()=>now})
 await assert.rejects(other.host.redeemInvite(restartInvite.invitation),/unknown/);await other.host.close();checks++
 // Lost onboarding response consumes the invite once; it must not mint a second session on retry.
 host=(await TeamHost.open(directory,keys.journal,objects,{clock:()=>now})).host
 const lost=await host.issueInvite(recovered.session!.credential,'Editor',10000,10000)
 const file=(host as any).journal.file,sync=file.sync.bind(file)
 file.sync=async()=>{await sync();throw new Error('Injected lost onboarding response')}
 await assert.rejects(host.redeemInvite(lost.invitation),/lost onboarding/);file.sync=sync;await host.close();host=undefined
 host=(await TeamHost.open(directory,keys.journal,objects,{clock:()=>now})).host
 await assert.rejects(host.redeemInvite(lost.invitation),/consumed/)
 const accessState=await host.access(recovered.session!.credential)
 assert.equal(accessState.sessions.filter(session=>session.member===lost.member).length,1)
 const stranded=accessState.sessions.find(session=>session.member===lost.member)!
 await host.revokeSession(recovered.session!.credential,stranded.digest)
 const replacement=await host.issueSession(recovered.session!.credential,lost.member,10000)
 assert.equal((await host.read(replacement.credential)).role,'Editor');checks++
 console.log(`PASS ${checks} offline invitation checks: role/TTL boundaries, scoped single-use concurrent redemption, Admin revocation limits, clock/precommit expiry, issuer demotion/deactivation and member reservation, secret-free history/restart, recovery/restore invalidation, cross-team isolation, durable lost-response single-consumption with explicit onboarding recovery. No networking.`)
}finally{await host?.close();Object.values(keys).forEach(key=>key.fill(0));await rm(root,{recursive:true,force:true})}
