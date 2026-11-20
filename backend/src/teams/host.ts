/** Local-only serialized host core. No routes/listeners or private-local resources. */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readRestoreMarker } from './recovery'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { TeamJournal, type Receipt, type JournalEntry } from './journal'
import { TeamObjects } from './objects'
import { replayTeam, validateTeamHistory, validateTeamOperation, type TeamState, type TypedTeamOperation } from './replay'
import { memberRole, requireEditor, type TeamRole, type InviteRole, type AccessOperation } from './access'
export type HostSession = { credential: string; digest: string; expiresAt: number; receipt: Receipt }
export type HostInvitation = {invitation:string;digest:string;member:string;role:InviteRole;expiresAt:number;receipt:Receipt}
type OpenOptions = {bootstrap?:{owner:string;durationMs:number};clock?:()=>number;restoreKey?:Buffer}
export type OwnerRecovery = {owner:string;durationMs:number;expectedCheckpoint:Receipt;confirmInvalidateAll:true}
type ContentOperation = Exclude<TypedTeamOperation,AccessOperation>
function credentialDigest(team:string,credential:string,domain='session'){
 if(typeof credential!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(credential)||Buffer.from(credential,'base64url').toString('base64url')!==credential)throw new Error('Invalid credential')
 return createHash('sha256').update(team+(domain==='session'?'\0':'\0invite\0')+credential).digest('hex')
}
export class TeamHost {
 private serial:Promise<unknown>=Promise.resolve()
 private closing=false
 private poisoned=false
 private closed?:Promise<void>
 private constructor(private journal:TeamJournal,private objects:TeamObjects,private state:TeamState,private clock:()=>number){}
 /** Existing encrypted storage only. Bootstrap is an explicit trusted-local action on an empty log. */
 static open(directory:string,key:Buffer,objects:TeamObjects,options:OpenOptions={}){
  return this.begin(directory,key,objects,{...options,bootstrap:options.bootstrap?{...options.bootstrap}:undefined})
 }
 /** Trusted-local only: possession of host storage key plus explicit checkpoint/Owner confirmation. Never expose as a bearer request. */
 static recoverOwner(directory:string,key:Buffer,objects:TeamObjects,recovery:OwnerRecovery,options:Omit<OpenOptions,'bootstrap'>={}){
  if(recovery.confirmInvalidateAll!==true)return Promise.reject(new Error('Explicit all-session invalidation confirmation required'))
  return this.begin(directory,key,objects,{...options},{...recovery,expectedCheckpoint:{...recovery.expectedCheckpoint}})
 }
 private static async begin(directory:string,key:Buffer,objects:TeamObjects,options:OpenOptions,recovery?:OwnerRecovery):Promise<{host:TeamHost;session?:HostSession}>{
  const clock=options.clock??Date.now,journal=await TeamJournal.open(directory,key,{create:false,recoverTail:false})
  try{
   const archive=await objects.exportArchive(),available=new Set(archive.objects.filter(value=>value.kind==='attachment').map(value=>value.id))
   const snapshots=await Promise.all(archive.objects.filter(value=>value.kind==='snapshot').map(value=>objects.getSnapshot(value.id)))
   const state=validateTeamHistory(journal.replay(),snapshots,available),host=new TeamHost(journal,objects,state,clock)
   if(!journal.replay().length){
    for(const name of ['READY','INCOMPLETE']){const exists=await readFile(join(dirname(directory),name)).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error});if(exists)throw new Error('Cannot bootstrap restored or incomplete data')}
    if(!options.bootstrap)throw new Error('Empty host requires explicit trusted-local Owner bootstrap')
    const credential=randomBytes(32).toString('base64url'),digest=credentialDigest(objects.teamId,credential),issuedAt=host.now(),expiresAt=issuedAt+options.bootstrap.durationMs
    const receipt=await host.persist({id:randomUUID(),actor:options.bootstrap.owner,kind:'team.access.bootstrap.v1',payload:{owner:options.bootstrap.owner,digest,issuedAt,expiresAt}})
    return{host,session:{credential,digest,expiresAt,receipt}}
   }
   if(options.bootstrap||!state.access||journal.replay()[0].operation.kind!=='team.access.bootstrap.v1')throw new Error('Cannot bootstrap or activate legacy content-only history implicitly')
   const history=journal.replay(),root=dirname(directory)
   const markerBytes=await readFile(join(root,'READY')).catch(error=>{if(error.code==='ENOENT')return undefined;throw error})
   let markerDigest:string|null=null,activationPending=false
   if(markerBytes){
    if(!options.restoreKey)throw new Error('Restored data requires authenticated marker verification and explicit activation')
    const marker=await readRestoreMarker(root,options.restoreKey,objects.teamId)
    if(journal.checkpoint(marker.checkpoint.sequence).digest!==marker.checkpoint.digest)throw new Error('Restored journal prefix differs from marker')
    const inventory=new Set(archive.objects.map(value=>`${value.kind}-${value.id}`))
    if(marker.identities.some(id=>!inventory.has(id)))throw new Error('Restored object inventory missing')
    markerDigest=createHash('sha256').update(markerBytes).digest('hex')
    const operation=history[marker.checkpoint.sequence]?.operation
    const activated=operation?.kind==='team.access.recover.v1'&&(operation.payload as any).reason==='restore-activation'&&(operation.payload as any).restoreMarkerDigest===markerDigest
    activationPending=!activated
    if(activationPending&&(history.length!==marker.checkpoint.sequence||!recovery))throw new Error('Restored data requires explicit session invalidation before activation')
   }else{
    const incomplete=await readFile(join(root,'INCOMPLETE')).catch(error=>{if(error.code==='ENOENT')return undefined;throw error})
    if(incomplete)throw new Error('Incomplete restore cannot be activated')
   }
   if(recovery){
    const checkpoint=journal.checkpoint()
    if(recovery.owner!==state.access.owner||checkpoint.sequence!==recovery.expectedCheckpoint.sequence||checkpoint.digest!==recovery.expectedCheckpoint.digest)throw new Error('Recovery Owner/checkpoint confirmation differs from current history')
    const credential=randomBytes(32).toString('base64url'),digest=credentialDigest(objects.teamId,credential),issuedAt=host.now(),expiresAt=issuedAt+recovery.durationMs
    const receipt=await host.persist({id:randomUUID(),actor:state.access.owner,kind:'team.access.recover.v1',payload:{owner:state.access.owner,digest,issuedAt,expiresAt,checkpoint,reason:activationPending?'restore-activation':'credential-recovery',restoreMarkerDigest:activationPending?markerDigest:null}})
    return{host,session:{credential,digest,expiresAt,receipt}}
   }
   return{host}
  }catch(error){await journal.close();throw error}
 }
 private now(){const value=this.clock();if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid host clock');return value}
 private actor(credential:string):string{
  const digest=Buffer.from(credentialDigest(this.objects.teamId,credential),'hex'),access=this.state.access
  const session=access?.sessions.find(value=>timingSafeEqual(Buffer.from(value.digest,'hex'),digest))
  const now=this.now()
  if(!session||session.revoked||now<session.issuedAt||now>=session.expiresAt)throw new Error('Credential expired, revoked or unknown')
  memberRole(access!,session.member);return session.member
 }
 private ordered<T>(work:()=>Promise<T>):Promise<T>{
  if(this.closing)return Promise.reject(new Error('Host closed'))
  const result=this.serial.then(()=>{if(this.poisoned)throw new Error('Host requires recovery');return work()})
  this.serial=result.catch(()=>undefined);return result
 }
 private async persist(operation:TypedTeamOperation,credential?:string,guard?:()=>void):Promise<Receipt>{
  validateTeamOperation(operation)
  const history=this.journal.replay(),existing=history.find(entry=>entry.operation.id===operation.id)
  if(existing){if(JSON.stringify(existing.operation)!==JSON.stringify(operation))throw new Error('Operation ID reused with different content');return this.journal.checkpoint(existing.sequence)}
  const archive=await this.objects.exportArchive(),available=new Set(archive.objects.filter(value=>value.kind==='attachment').map(value=>value.id))
  const entry:JournalEntry={version:1,sequence:history.length+1,previous:this.journal.checkpoint().digest,operation}
  const next=replayTeam([...history,entry],available) // Preflight before durable append. Invalid work is never ACKed.
  if(credential!==undefined&&this.actor(credential)!==operation.actor)throw new Error('Credential actor changed before commit')
  guard?.()
  let receipt:Receipt
  try{receipt=await this.journal.append(operation)}catch(error){this.poisoned=true;throw error}
  this.state=next;return receipt
 }
 submit(credential:string,operation:ContentOperation):Promise<Receipt>{
  try{validateTeamOperation(operation);if(!['team.board.replace.v1','team.backchat.post.v1'].includes(operation.kind))throw new Error('Use dedicated access-management controls');operation=structuredClone(operation)}catch(error){return Promise.reject(error)}
  return this.ordered(async()=>{const actor=this.actor(credential);requireEditor(this.state.access!,actor);if(operation.actor!==actor)throw new Error('Operation actor does not match authenticated credential');return this.persist(operation,credential)})
 }
 read(credential:string){return this.ordered(async()=>{const actor=this.actor(credential),state=structuredClone(this.state),role=memberRole(state.access!,actor);delete state.access;return{state,role}})}
 access(credential:string){return this.ordered(async()=>{const actor=this.actor(credential),role=memberRole(this.state.access!,actor);if(role!=='Owner'&&role!=='Admin')throw new Error('Only Owner/Admin may inspect access records');return structuredClone(this.state.access!)})}
 setMember(credential:string,member:string,role:TeamRole,active:boolean){return this.ordered(async()=>{const actor=this.actor(credential);return this.persist({id:randomUUID(),actor,kind:'team.access.member.v1',payload:{member,role,active}},credential)})}
 issueSession(credential:string,member:string,durationMs:number):Promise<HostSession>{return this.ordered(async()=>{
  const actor=this.actor(credential),token=randomBytes(32).toString('base64url'),digest=credentialDigest(this.objects.teamId,token),issuedAt=this.now(),expiresAt=issuedAt+durationMs
  const receipt=await this.persist({id:randomUUID(),actor,kind:'team.access.session.v1',payload:{member,digest,issuedAt,expiresAt}},credential)
  return{credential:token,digest,expiresAt,receipt}
 })}
 revokeSession(credential:string,digest:string){return this.ordered(async()=>{const actor=this.actor(credential);return this.persist({id:randomUUID(),actor,kind:'team.access.revoke.v1',payload:{digest}},credential)})}
 issueInvite(credential:string,role:InviteRole,durationMs:number,sessionDurationMs:number):Promise<HostInvitation>{return this.ordered(async()=>{
  const actor=this.actor(credential),invitation=randomBytes(32).toString('base64url'),digest=credentialDigest(this.objects.teamId,invitation,'invite'),member=randomUUID(),issuedAt=this.now(),expiresAt=issuedAt+durationMs
  const receipt=await this.persist({id:randomUUID(),actor,kind:'team.access.invite.v1',payload:{digest,member,role,issuedAt,expiresAt,sessionDurationMs}},credential,()=>{if(this.now()>=expiresAt)throw new Error('Invitation expired before commit')})
  return{invitation,digest,member,role,expiresAt,receipt}
 })}
 revokeInvite(credential:string,digest:string){return this.ordered(async()=>{
  const actor=this.actor(credential)
  return this.persist({id:randomUUID(),actor,kind:'team.access.invite-revoke.v1',payload:{digest}},credential)
 })}
 /** Possession of a team-bound invite grants only its preselected role/new member. No target or role supplied by redeemer. */
 redeemInvite(invitation:string):Promise<HostSession&{member:string;role:InviteRole}>{return this.ordered(async()=>{
  const digest=credentialDigest(this.objects.teamId,invitation,'invite'),invite=this.state.access?.invites?.find(value=>timingSafeEqual(Buffer.from(value.digest,'hex'),Buffer.from(digest,'hex')))
  const check=()=>{const now=this.now();if(!invite||invite.revoked||invite.redeemedAt!==undefined||now<invite.issuedAt||now>=invite.expiresAt)throw new Error('Invitation expired, revoked, consumed or unknown')}
  check()
  const selected=invite!,credential=randomBytes(32).toString('base64url'),sessionDigest=credentialDigest(this.objects.teamId,credential),issuedAt=this.now(),expiresAt=issuedAt+selected.sessionDurationMs
  const receipt=await this.persist({id:randomUUID(),actor:selected.member,kind:'team.access.invite-redeem.v1',payload:{inviteDigest:digest,sessionDigest,issuedAt,expiresAt}},undefined,()=>{check();if(this.now()>=expiresAt)throw new Error('Onboarding session expired before commit')})
  return{credential,digest:sessionDigest,expiresAt,receipt,member:selected.member,role:selected.role}
 })}
 putAttachment(credential:string,bytes:Buffer){bytes=Buffer.from(bytes);return this.ordered(async()=>{const actor=this.actor(credential);requireEditor(this.state.access!,actor);return this.objects.putAttachment(bytes)})}
 getAttachment(credential:string,id:string){return this.ordered(async()=>{this.actor(credential);if(!this.state.requiredAttachments.includes(id))throw new Error('Attachment not referenced by team history');return this.objects.getAttachment(id)})}
 close():Promise<void>{if(this.closed)return this.closed;this.closing=true;this.closed=(async()=>{await this.serial;await this.journal.close()})();return this.closed}
}
