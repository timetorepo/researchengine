/** Portable control-plane client. Memory-only credentials, no automatic connections/retries/storage. */
export type TeamEndpoint={origin:string;team:string}
export type ClientOptions={timeoutMs:number;responseBytes:number;native:boolean;fetch?:typeof fetch;now?:()=>number}
export type TeamAccessView={owner:string;members:{id:string;role:ClientSession['role'];active:boolean}[];sessions:{digest:string;member:string;issuedAt:number;expiresAt:number;revoked:boolean}[];invites?:{digest:string;member:string;role:'Admin'|'Editor'|'Viewer';issuer:string;issuedAt:number;expiresAt:number;sessionDurationMs:number;revoked:boolean;redeemedAt?:number}[]}
export type ClientReceipt={sequence:number;digest:string}
export type ClientOperation={id:string;actor:string;kind:'team.board.replace.v1'|'team.backchat.post.v1';payload:unknown}
export type ClientSession={credential:string;digest:string;expiresAt:number;receipt:ClientReceipt;member:string;role:'Admin'|'Editor'|'Viewer'|'Owner'}
export class TeamClientError extends Error{
 constructor(public code:string,public status:number,public outcome:'unknown'|'rejected'='unknown'){super(`Teams request failed: ${code}`)}
}
function fail(code:string):never{throw new TeamClientError(code,0,'rejected')}
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)&&value!=='0'.repeat(64)
function endpoint(value:TeamEndpoint):TeamEndpoint{
 let parsed:URL;try{parsed=new URL(value.origin)}catch{return fail('invalid_endpoint')}
 if(parsed.protocol!=='https:'||parsed.origin!==value.origin||parsed.username||parsed.password||!id(value.team))fail('invalid_endpoint')
 return{origin:value.origin,team:value.team}
}
function options(value:ClientOptions):ClientOptions{
 if(!Number.isSafeInteger(value.timeoutMs)||value.timeoutMs<1||value.timeoutMs>2147483647||!Number.isSafeInteger(value.responseBytes)||value.responseBytes<1||typeof value.native!=='boolean')fail('invalid_client_budget')
 return{...value,fetch:value.fetch??globalThis.fetch.bind(globalThis),now:value.now??Date.now}
}
function record(value:unknown):value is Record<string,any>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
function receipt(value:unknown):asserts value is ClientReceipt{
 if(!record(value)||Object.keys(value).sort().join(',')!=='digest,sequence'||!Number.isSafeInteger(value.sequence)||value.sequence<1||!digest(value.digest))throw new TeamClientError('invalid_receipt',0)
}
async function validateSession(value:unknown,destination:TeamEndpoint,now:number):Promise<ClientSession>{
 if(!record(value)||!id(value.member)||!['Owner','Admin','Editor','Viewer'].includes(value.role)||typeof value.credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value.credential)||!digest(value.digest)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>8640000000000000)throw new TeamClientError('invalid_session',0)
 receipt(value.receipt)
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(destination.team+'\0'+value.credential))
 const expected=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
 if(expected!==value.digest)throw new TeamClientError('session_scope_mismatch',0)
 return{credential:value.credential,digest:value.digest,expiresAt:value.expiresAt,receipt:{...value.receipt},member:value.member,role:value.role}
}
async function request(destination:TeamEndpoint,config:ClientOptions,path:string,value:unknown,credential:string|undefined,signal?:AbortSignal,binaryResponse=false):Promise<unknown>{
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,config.timeoutMs)
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
 try{
  if(controller.signal.aborted)throw new TeamClientError('stopped',0)
  let serialized:string|Uint8Array|undefined
  try{serialized=value instanceof Uint8Array?value:value===undefined?undefined:JSON.stringify(value)}catch{fail('invalid_payload')}
  const url=destination.origin+`/v1/teams/${destination.team}`+path,headers:Record<string,string>={Accept:'application/json'}
  if(credential)headers.Authorization='Bearer '+credential
  if(serialized!==undefined)headers['Content-Type']=value instanceof Uint8Array?'application/octet-stream':'application/json'
  if(config.native)headers['X-RE-Team-Client']='native-v1'
  const response=await config.fetch!(url,{method:serialized===undefined?'GET':'POST',headers,body:serialized as BodyInit,signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',mode:'cors'})
  if(response.redirected||response.type==='opaqueredirect'||(response.url&&response.url!==url))throw new TeamClientError('redirect_forbidden',0)
  const length=response.headers.get('content-length')
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>config.responseBytes))throw new TeamClientError('response_budget_exceeded',response.status)
  if(!(binaryResponse&&response.ok?/^application\/octet-stream(?:\s*;|$)/i:/^application\/json(?:\s*;|$)/i).test(response.headers.get('content-type')??''))throw new TeamClientError('invalid_response',response.status)
  reader=response.body?.getReader();if(!reader)throw new TeamClientError('invalid_response',response.status)
  const chunks:Uint8Array[]=[];let total=0
  while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>config.responseBytes)throw new TeamClientError('response_budget_exceeded',response.status);chunks.push(chunk.value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  if(binaryResponse&&response.ok)return bytes
  let parsed:unknown;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new TeamClientError('invalid_response',response.status)}
  if(!response.ok){const code=record(parsed)&&typeof parsed.error==='string'&&/^[a-z_]{1,60}$/.test(parsed.error)?parsed.error:'request_rejected';throw new TeamClientError(code,response.status,response.status>=500?'unknown':'rejected')}
  return parsed
 }catch(error){if(error instanceof TeamClientError)throw error;throw new TeamClientError(controller.signal.aborted?'stopped_or_timed_out':'transport_unavailable',0)}
 finally{try{await reader?.cancel()}catch{}clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export class TeamClient{
 private session:ClientSession|undefined
 private active=new Set<AbortController>()
 private constructor(private destination:TeamEndpoint,private config:ClientOptions,session:ClientSession){this.session=session}
 static async fromSession(destination:TeamEndpoint,session:ClientSession,config:ClientOptions):Promise<TeamClient>{
  destination=endpoint(destination);config=options(config)
  return new TeamClient(destination,config,await validateSession(session,destination,config.now!()))
 }
 identity(){const session=this.session;if(!session)fail('client_disconnected');return{...this.destination,member:session.member,role:session.role,expiresAt:session.expiresAt}}
 private async call(path:string,value:unknown,signal?:AbortSignal,binaryResponse=false){
  const session=this.session;if(!session)fail('client_disconnected');if(session.expiresAt<=this.config.now!())fail('session_expired')
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();this.active.add(controller)
  try{return await request(this.destination,this.config,path,value,session.credential,controller.signal,binaryResponse)}finally{this.active.delete(controller);signal?.removeEventListener('abort',abort)}
 }
 async read(signal?:AbortSignal){
  const value=await this.call('/state',undefined,signal)
  if(!record(value)||!record(value.state)||value.state.schemaVersion!==1||!Number.isSafeInteger(value.state.sequence)||value.state.sequence<0||!Array.isArray(value.state.boards)||!Array.isArray(value.state.posts)||!Array.isArray(value.state.requiredAttachments)||Object.prototype.hasOwnProperty.call(value.state,'access')||value.member!==this.session?.member||!['Owner','Admin','Editor','Viewer'].includes(value.role))throw new TeamClientError('invalid_state_response',0)
  if(this.session)this.session.role=value.role
  return value as {state:Record<string,any>;member:string;role:ClientSession['role']}
 }
 async submit(operation:ClientOperation,signal?:AbortSignal){
  const identity=this.identity()
  if(!record(operation)||Object.keys(operation).sort().join(',')!=='actor,id,kind,payload'||!id(operation.id)||operation.actor!==identity.member||!['team.board.replace.v1','team.backchat.post.v1'].includes(operation.kind))fail('invalid_content_operation')
  const value=await this.call('/operations',{operation},signal)
  if(!record(value)||value.operationId!==operation.id)throw new TeamClientError('operation_identity_mismatch',0)
  receipt(value.receipt);return{operationId:operation.id,receipt:{...value.receipt}}
 }
 async presence(announce:boolean,signal?:AbortSignal){
  if(typeof announce!=='boolean')fail('invalid_presence_request')
  const value=await this.call('/presence',announce?{announce:true}:undefined,signal)
  if(!record(value)||!Number.isSafeInteger(value.observedAt)||value.observedAt<0||!Array.isArray(value.members)||value.members.some((m:any)=>!record(m)||!id(m.member)||!Number.isSafeInteger(m.expiresAt)||m.expiresAt<=value.observedAt||m.expiresAt>value.observedAt+30000))throw new TeamClientError('invalid_presence_response',0)
  return{observedAt:Number(value.observedAt),members:value.members.map((m:any)=>({member:String(m.member),expiresAt:Number(m.expiresAt)}))}
 }
 async readAccess(signal?:AbortSignal):Promise<TeamAccessView>{
  const value=await this.call('/access',undefined,signal)
  const time=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=8640000000000000
  if(!record(value)||!id(value.owner)||!Array.isArray(value.members)||!Array.isArray(value.sessions)||(value.invites!==undefined&&!Array.isArray(value.invites))||value.members.some((m:any)=>!record(m)||!id(m.id)||!['Owner','Admin','Editor','Viewer'].includes(m.role)||typeof m.active!=='boolean')||value.sessions.some((s:any)=>!record(s)||!digest(s.digest)||!id(s.member)||!time(s.issuedAt)||!time(s.expiresAt)||s.expiresAt<=s.issuedAt||typeof s.revoked!=='boolean')||(value.invites??[]).some((i:any)=>!record(i)||!digest(i.digest)||!id(i.member)||!id(i.issuer)||!['Admin','Editor','Viewer'].includes(i.role)||!time(i.issuedAt)||!time(i.expiresAt)||i.expiresAt<=i.issuedAt||!Number.isSafeInteger(i.sessionDurationMs)||i.sessionDurationMs<1||i.sessionDurationMs>86400000||typeof i.revoked!=='boolean'||(i.redeemedAt!==undefined&&!time(i.redeemedAt))))throw new TeamClientError('invalid_access_response',0)
  // Whitelist fields: no bearer values/raw provider payloads reach the UI.
  return {owner:value.owner,members:value.members.map((m:any)=>({id:m.id,role:m.role,active:m.active})),sessions:value.sessions.map((s:any)=>({digest:s.digest,member:s.member,issuedAt:s.issuedAt,expiresAt:s.expiresAt,revoked:s.revoked})),invites:(value.invites??[]).map((i:any)=>({digest:i.digest,member:i.member,role:i.role,issuer:i.issuer,issuedAt:i.issuedAt,expiresAt:i.expiresAt,sessionDurationMs:i.sessionDurationMs,revoked:i.revoked,...(i.redeemedAt===undefined?{}:{redeemedAt:i.redeemedAt})}))}
 }
 async createInvite(role:'Admin'|'Editor'|'Viewer',durationMs:number,sessionDurationMs:number,signal?:AbortSignal){
  if(!['Admin','Editor','Viewer'].includes(role)||[durationMs,sessionDurationMs].some(n=>!Number.isSafeInteger(n)||n<1||n>86400000))fail('invalid_invitation_scope')
  const value=await this.call('/invites',{role,durationMs,sessionDurationMs},signal)
  if(!record(value)||typeof value.invitation!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value.invitation)||!digest(value.digest)||!id(value.member)||value.role!==role||!Number.isSafeInteger(value.expiresAt)||(value.expiresAt<=this.config.now!()||value.expiresAt>8640000000000000))throw new TeamClientError('invalid_invitation_response',0)
  receipt(value.receipt)
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(this.destination.team+'\0invite\0'+value.invitation)),expected=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
  if(expected!==value.digest)throw new TeamClientError('invitation_scope_mismatch',0)
  return {invitation:value.invitation,digest:value.digest,member:value.member,role,expiresAt:value.expiresAt}
 }
 async revokeAccess(kind:'invitation'|'session',target:string,signal?:AbortSignal){
  if(!['invitation','session'].includes(kind)||!digest(target))fail('invalid_access_target')
  const value=await this.call(kind==='invitation'?'/invites/revoke':'/sessions/revoke',{digest:target},signal)
  if(!record(value))throw new TeamClientError('invalid_access_receipt',0);receipt(value.receipt);return {receipt:{...value.receipt}}
 }
 async changeMember(member:string,role:'Admin'|'Editor'|'Viewer',active:boolean,signal?:AbortSignal){
  if(!id(member)||!['Admin','Editor','Viewer'].includes(role)||typeof active!=='boolean')fail('invalid_member')
  const value=await this.call('/members',{member,role,active},signal)
  if(!record(value))throw new TeamClientError('invalid_access_receipt',0);receipt(value.receipt);return {receipt:{...value.receipt}}
 }
 async uploadAttachment(bytes:Uint8Array,signal?:AbortSignal){
  if(!bytes.length||bytes.length>1048576)fail('attachment_budget_exceeded')
  const value=await this.call('/attachments',bytes.slice(),signal)
  if(!record(value)||Object.keys(value).join(',')!=='attachmentId'||!digest(value.attachmentId))throw new TeamClientError('invalid_attachment_response',0)
  return value.attachmentId as string
 }
 async downloadAttachment(attachmentId:string,signal?:AbortSignal){
  if(!digest(attachmentId))fail('invalid_attachment_id')
  return await this.call('/attachments/'+attachmentId,undefined,signal,true) as Uint8Array
 }
 queueTransport(){return async(operation:{id:string;actor:string;kind:string;payload:unknown},signal:AbortSignal)=>{
  try{const result=await this.submit(operation as ClientOperation,signal);return{type:'ack' as const,...result}}
  catch(error){if(error instanceof TeamClientError&&error.status===409)return{type:'conflict' as const,operationId:operation.id,message:'Host rejected this operation as a conflict. Review shared state before explicitly replacing it.'};throw error}
 }}
 /** Explicit handoff to a reviewed encrypted custody adapter; never called automatically. */
 async persistCredential(writer:(destination:TeamEndpoint,session:ClientSession)=>Promise<void>){
  if(!this.session)fail('client_disconnected')
  await writer({...this.destination},{...this.session,receipt:{...this.session.receipt}})
 }
 disconnect(){this.session=undefined;this.active.forEach(controller=>controller.abort());this.active.clear()}
}
export type JoinConsent={reviewedOrigin:string;reviewedTeam:string;acceptHostTrust:true;acceptSingleUse:true}
export class TeamJoin{
 private phase:'review'|'sending'|'joined'|'uncertain'='review'
 private constructor(private destination:TeamEndpoint,private invitation:string|undefined,private config:ClientOptions){}
 static prepare(destination:TeamEndpoint,invitation:string,config:ClientOptions){
  if(typeof invitation!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(invitation))fail('invalid_invitation')
  return new TeamJoin(endpoint(destination),invitation,options(config))
 }
 review(){return{...this.destination,phase:this.phase,hostCanReadSharedData:true,singleUse:true,notice:'Only shared Team data is sent. The authorized host can read it. No private local chats, memories or Boards are imported. A lost join response may consume this invitation.'}}
 async confirm(consent:JoinConsent,signal?:AbortSignal):Promise<TeamClient>{
  if(this.phase!=='review'||!this.invitation)fail('join_not_ready')
  if(consent.reviewedOrigin!==this.destination.origin||consent.reviewedTeam!==this.destination.team||consent.acceptHostTrust!==true||consent.acceptSingleUse!==true)fail('join_confirmation_required')
  this.phase='sending';const invitation=this.invitation;this.invitation=undefined
  try{
   const value=await request(this.destination,this.config,'/invites/redeem',{invitation},undefined,signal)
   const session=await validateSession(value,this.destination,this.config.now!());if(session.role==='Owner')throw new TeamClientError('invalid_invited_role',0)
   const client=await TeamClient.fromSession(this.destination,session,this.config);this.phase='joined';return client
  }catch(error){this.phase='uncertain';throw error}
 }
 cancel(){if(this.phase!=='review')fail('join_already_dispatched');this.invitation=undefined;this.phase='uncertain'}
}

/** Resolve an imported session's identity against the explicitly reviewed trusted host. */
export async function resolveClientSession(destination:TeamEndpoint,session:Omit<ClientSession,'member'|'role'>,config:ClientOptions,signal?:AbortSignal):Promise<TeamClient>{
 destination=endpoint(destination);config=options(config)
 // Validate credential/digest before putting a bearer on the network.
 await validateSession({...session,member:'unresolved',role:'Viewer'},destination,config.now!())
 const value=await request(destination,config,'/state',undefined,session.credential,signal)
 if(!record(value)||!id(value.member)||!['Owner','Admin','Editor','Viewer'].includes(value.role))throw new TeamClientError('invalid_identity_response',0)
 return TeamClient.fromSession(destination,{...session,member:value.member,role:value.role},config)
}
