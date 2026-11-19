/** Deterministic access-control records. Raw bearer credentials never enter history. */
import type { TeamOperation } from './journal'
export type TeamRole = 'Owner'|'Admin'|'Editor'|'Viewer'
export type AccessState = { owner: string; members: {id:string;role:TeamRole;active:boolean}[]; sessions: {digest:string;member:string;issuedAt:number;expiresAt:number;revoked:boolean}[] }
export type AccessOperation = TeamOperation & (
  {kind:'team.access.bootstrap.v1';payload:{owner:string;digest:string;issuedAt:number;expiresAt:number}} |
  {kind:'team.access.member.v1';payload:{member:string;role:TeamRole;active:boolean}} |
  {kind:'team.access.session.v1';payload:{member:string;digest:string;issuedAt:number;expiresAt:number}} |
  {kind:'team.access.revoke.v1';payload:{digest:string}}
)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const roles:TeamRole[]=['Owner','Admin','Editor','Viewer']
function fields(value:unknown,names:string[]):asserts value is Record<string,any>{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==names.length||names.some(name=>!Object.hasOwn(value,name)||!Object.getOwnPropertyDescriptor(value,name)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,name)!,'value')))throw new Error('Invalid access record')
}
function times(value:{issuedAt:number;expiresAt:number}){
 if(!Number.isSafeInteger(value.issuedAt)||value.issuedAt<0||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=value.issuedAt||value.expiresAt-value.issuedAt>86400000)throw new Error('Session duration must be positive and at most 24 hours')
}
export function isAccessKind(kind:unknown){return typeof kind==='string'&&kind.startsWith('team.access.')}
export function validateAccessOperation(value:unknown):asserts value is AccessOperation{
 fields(value,['id','actor','kind','payload']);if(!id(value.id)||!id(value.actor))throw new Error('Invalid access identity')
 const p=value.payload
 if(value.kind==='team.access.bootstrap.v1'){fields(p,['owner','digest','issuedAt','expiresAt']);if(!id(p.owner)||p.owner!==value.actor||!digest(p.digest))throw new Error('Invalid bootstrap');times({issuedAt:p.issuedAt,expiresAt:p.expiresAt})}
 else if(value.kind==='team.access.member.v1'){fields(p,['member','role','active']);if(!id(p.member)||!roles.includes(p.role)||typeof p.active!=='boolean')throw new Error('Invalid member')}
 else if(value.kind==='team.access.session.v1'){fields(p,['member','digest','issuedAt','expiresAt']);if(!id(p.member)||!digest(p.digest))throw new Error('Invalid session');times({issuedAt:p.issuedAt,expiresAt:p.expiresAt})}
 else if(value.kind==='team.access.revoke.v1'){fields(p,['digest']);if(!digest(p.digest))throw new Error('Invalid session identity')}
 else throw new Error('Unsupported access operation/version')
}
export function memberRole(state:AccessState,actor:string):TeamRole{
 const member=state.members.find(value=>value.id===actor&&value.active);if(!member)throw new Error('Member is inactive or absent');return member.role
}
export function requireEditor(state:AccessState,actor:string){if(memberRole(state,actor)==='Viewer')throw new Error('Viewer cannot write team content')}
function canManage(state:AccessState,actor:string,target:string,newRole?:TeamRole){
 const role=memberRole(state,actor),old=state.members.find(value=>value.id===target)
 if(target===state.owner||newRole==='Owner')throw new Error('Owner transfer/removal is not enabled')
 if(role!=='Owner'&&(role!=='Admin'||old?.role==='Admin'||newRole==='Admin'))throw new Error('Insufficient member-management role')
}
export function reduceAccess(state:AccessState|undefined,operation:AccessOperation,sequence:number):AccessState{
 validateAccessOperation(operation)
 if(operation.kind==='team.access.bootstrap.v1'){
  if(state||sequence!==1)throw new Error('Bootstrap is only permitted as the first operation')
  const p=operation.payload;return{owner:p.owner,members:[{id:p.owner,role:'Owner',active:true}],sessions:[{digest:p.digest,member:p.owner,issuedAt:p.issuedAt,expiresAt:p.expiresAt,revoked:false}]}
 }
 if(!state)throw new Error('Access control must be bootstrapped first')
 const next=structuredClone(state)
 if(operation.kind==='team.access.member.v1'){
  const value=operation.payload;canManage(next,operation.actor,value.member,value.role)
  const member=next.members.find(member=>member.id===value.member)
  if(member){member.role=value.role;member.active=value.active}else next.members.push({id:value.member,role:value.role,active:value.active})
  next.members.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
  // A deactivated member's old credentials never reactivate when membership is restored.
  if(!value.active)next.sessions.filter(session=>session.member===value.member).forEach(session=>session.revoked=true)
 }else if(operation.kind==='team.access.session.v1'){
  const value=operation.payload,role=memberRole(next,operation.actor),target=memberRole(next,value.member)
  if(role!=='Owner'&&role!=='Admin')throw new Error('Only Owner/Admin may issue sessions')
  if(operation.actor!==value.member&&(role!=='Owner'&&(role!=='Admin'||target==='Owner'||target==='Admin')))throw new Error('Insufficient credential-issuance role')
  if(next.sessions.some(session=>session.digest===value.digest))throw new Error('Session identity already used')
  next.sessions.push({...value,revoked:false})
 }else{
  const value=operation.payload,session=next.sessions.find(session=>session.digest===value.digest)
  if(!session)throw new Error('Unknown session')
  const role=memberRole(next,operation.actor),target=next.members.find(member=>member.id===session.member)!
  if(operation.actor!==session.member&&(role!=='Owner'&&(role!=='Admin'||target.role==='Owner'||target.role==='Admin')))throw new Error('Insufficient revocation role')
  session.revoked=true
 }
 return next
}
