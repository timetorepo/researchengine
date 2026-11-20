/** Portable control-plane client. Memory-only credentials, no automatic connections/retries/storage. */
export type TeamEndpoint={origin:string;team:string}
export type ClientOptions={timeoutMs:number;responseBytes:number;native:boolean;fetch?:typeof fetch;now?:()=>number}
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
 if(!record(value)||!id(value.member)||!['Owner','Admin','Editor','Viewer'].includes(value.role)||typeof value.credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value.credential)||!digest(value.digest)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now)throw new TeamClientError('invalid_session',0)
 receipt(value.receipt)
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(destination.team+'\0'+value.credential))
 const expected=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
 if(expected!==value.digest)throw new TeamClientError('session_scope_mismatch',0)
 return{credential:value.credential,digest:value.digest,expiresAt:value.expiresAt,receipt:{...value.receipt},member:value.member,role:value.role}
}
async function request(destination:TeamEndpoint,config:ClientOptions,path:string,value:unknown,credential:string|undefined,signal?:AbortSignal):Promise<unknown>{
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,config.timeoutMs)
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
 try{
  if(controller.signal.aborted)throw new TeamClientError('stopped',0)
  let serialized:string|undefined
  try{serialized=value===undefined?undefined:JSON.stringify(value)}catch{fail('invalid_payload')}
  const url=destination.origin+`/v1/teams/${destination.team}`+path,headers:Record<string,string>={Accept:'application/json'}
  if(credential)headers.Authorization='Bearer '+credential
  if(serialized!==undefined)headers['Content-Type']='application/json'
  if(config.native)headers['X-RE-Team-Client']='native-v1'
  const response=await config.fetch!(url,{method:serialized===undefined?'GET':'POST',headers,body:serialized,signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',mode:'cors'})
  if(response.redirected||response.type==='opaqueredirect'||(response.url&&response.url!==url))throw new TeamClientError('redirect_forbidden',0)
  const length=response.headers.get('content-length')
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>config.responseBytes))throw new TeamClientError('response_budget_exceeded',response.status)
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw new TeamClientError('invalid_response',response.status)
  reader=response.body?.getReader();if(!reader)throw new TeamClientError('invalid_response',response.status)
  const chunks:Uint8Array[]=[];let total=0
  while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>config.responseBytes)throw new TeamClientError('response_budget_exceeded',response.status);chunks.push(chunk.value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
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
 private async call(path:string,value:unknown,signal?:AbortSignal){
  const session=this.session;if(!session)fail('client_disconnected');if(session.expiresAt<=this.config.now!())fail('session_expired')
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();this.active.add(controller)
  try{return await request(this.destination,this.config,path,value,session.credential,controller.signal)}finally{this.active.delete(controller);signal?.removeEventListener('abort',abort)}
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
