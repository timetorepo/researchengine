/** Dedicated opt-in HTTPS API. Never mounted on the app's private-local backend. */
import { createServer, type Server } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { X509Certificate } from 'node:crypto'
import { TeamHost } from './host'
import { validateTeamOperation } from './replay'
export type TeamHttpsOptions = {
 confirmNetworkExposure:true; bind:string; port:number; publicOrigin:string; allowedOrigins:string[]
 cert:Buffer; key:Buffer; allowNativeClients:boolean
 limits:{controlBytes:number;activeRequests:number;requestsPerMinute:number;trackedClients:number;requestTimeoutMs:number}
}
class Rejection extends Error { constructor(public status:number,public code:string){super(code)} }
function reject(status:number,code:string):never{throw new Rejection(status,code)}
function origin(value:string){
 let url:URL;try{url=new URL(value)}catch{return reject(400,'invalid_configuration')}
 if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.hostname==='*')reject(400,'invalid_configuration')
 return url
}
function fields(value:unknown,names:string[]):asserts value is Record<string,any>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==names.length||names.some(name=>!Object.hasOwn(value,name)))reject(400,'invalid_request')
}
function duration(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>86400000)reject(400,'invalid_duration');return Number(value)}
function bearer(req:IncomingMessage){const value=req.headers.authorization;if(typeof value!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(value))reject(401,'unauthorized');return value.slice(7)}
function domain(error:unknown):Rejection{
 if(error instanceof Rejection)return error
 const message=error instanceof Error?error.message:''
 if(/Credential expired|Invalid credential|Member is inactive/.test(message))return new Rejection(401,'unauthorized')
 if(/Host requires recovery|Host closed/.test(message))return new Rejection(503,'host_unavailable')
 if(/Insufficient|Only Owner|Viewer cannot|Owner transfer|actor does not match/.test(message))return new Rejection(403,'forbidden')
 if(/revision conflict|different content|already exists|already used|fresh reserved|missing attachment|not referenced/.test(message))return new Rejection(409,'conflict')
 if(/Invalid |Unsupported |Empty BackChat|Connector |Board link|Cyclic |Parent must|Image\/PDF|Drawing points|Endpoints on/.test(message))return new Rejection(400,'invalid_request')
 return new Rejection(500,'host_failure') // Never reflect arbitrary crypto/parser/path/secret error strings.
}
function body(req:IncomingMessage,limit:number,timeout:number):Promise<unknown>{
 if(req.headers['content-type']!=='application/json'||req.headers['content-encoding']!==undefined)reject(415,'json_required')
 const length=req.headers['content-length']
 if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>limit))reject(413,'control_body_too_large')
 return new Promise((resolve,rejectBody)=>{
  const chunks:Buffer[]=[];let size=0
  const clean=()=>{clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',error);req.off('aborted',aborted)}
  const fail=(value:Error)=>{clean();req.pause();rejectBody(value)}
  const data=(chunk:Buffer)=>{size+=chunk.length;if(size>limit){fail(new Rejection(413,'control_body_too_large'));return}chunks.push(chunk)}
  const end=()=>{clean();try{resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))))}catch{rejectBody(new Rejection(400,'invalid_json'))}}
  const error=()=>fail(new Rejection(400,'request_incomplete')),aborted=()=>fail(new Rejection(400,'request_incomplete'))
  const timer=setTimeout(()=>fail(new Rejection(408,'request_timeout')),timeout)
  req.on('data',data);req.once('end',end);req.once('error',error);req.once('aborted',aborted)
 })
}
/** Construction does not listen; configuration has no implicit bind, cert, origin or budget defaults. */
export function createTeamHttpsServer(host:TeamHost,options:TeamHttpsOptions):Server{
 if(options.confirmNetworkExposure!==true||!isIP(options.bind)||!Number.isSafeInteger(options.port)||options.port<0||options.port>65535||typeof options.allowNativeClients!=='boolean')throw new Error('Explicit HTTPS exposure/bind/port/client policy required')
 const advertised=origin(options.publicOrigin)
 if(!Array.isArray(options.allowedOrigins)||!options.allowedOrigins.length)throw new Error('Explicit HTTPS UI origin allowlist required')
 const origins=new Set(options.allowedOrigins.map(value=>origin(value).origin)),limits={...options.limits}
 if(['controlBytes','activeRequests','requestsPerMinute','trackedClients','requestTimeoutMs'].some(key=>!Number.isSafeInteger(limits[key as keyof typeof limits])||limits[key as keyof typeof limits]<1)||limits.requestTimeoutMs>2147483647)throw new Error('Explicit positive whole-number transport budgets required')
 const certificate=new X509Certificate(options.cert),now=Date.now(),certificateHost=advertised.hostname.replace(/^\[|\]$/g,'')
 if((isIP(certificateHost)?!certificate.checkIP(certificateHost):!certificate.checkHost(certificateHost))||Date.parse(certificate.validFrom)>now||Date.parse(certificate.validTo)<=now)throw new Error('Certificate must be currently valid for the advertised HTTPS host')
 const native=options.allowNativeClients,scope=`/v1/teams/${host.teamId}`,clients=new Map<string,{start:number;count:number}>();let active=0
 const server=createServer({cert:Buffer.from(options.cert),key:Buffer.from(options.key),minVersion:'TLSv1.2',maxHeaderSize:8192,headersTimeout:Math.min(10000,limits.requestTimeoutMs),requestTimeout:limits.requestTimeoutMs,keepAliveTimeout:5000},(req,res)=>{
  req.on('error',()=>undefined)
  void handle(req,res)
 })
 server.maxConnections=limits.activeRequests
 server.maxRequestsPerSocket=100
 server.setTimeout(limits.requestTimeoutMs,socket=>socket.destroy())
 const json=(res:ServerResponse,status:number,value:unknown)=>{if(res.destroyed||res.writableEnded)return;res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))}
 const handle=async(req:IncomingMessage,res:ServerResponse)=>{
  let admitted=false,deadline:ReturnType<typeof setTimeout>|undefined
  res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Vary','Origin')
  try{
   // Direct TLS only. Forwarded host/proto/client IP are never trusted.
   if(req.headers.host!==advertised.host)reject(421,'untrusted_host')
   const supplied=req.headers.origin
   if(supplied!==undefined){if(typeof supplied!=='string'||!origins.has(supplied))reject(403,'untrusted_origin');res.setHeader('Access-Control-Allow-Origin',supplied)}
   else if(!native||req.headers['x-re-team-client']!=='native-v1')reject(403,'origin_required')
   const url=req.url??''
   if(url.includes('?')||url.includes('#'))reject(400,'query_credentials_forbidden')
   if(!url.startsWith(scope+'/'))reject(404,'not_found')
   const address=req.socket.remoteAddress??'unknown',now=Date.now()
   for(const [id,window]of clients)if(now-window.start>=60000)clients.delete(id)
   let window=clients.get(address)
   if(!window){if(clients.size>=limits.trackedClients)reject(429,'client_budget_exhausted');window={start:now,count:0};clients.set(address,window)}
   if(++window.count>limits.requestsPerMinute)reject(429,'rate_limited')
   if(active>=limits.activeRequests)reject(503,'request_budget_exhausted')
   active++;admitted=true
   deadline=setTimeout(()=>{if(res.destroyed||res.writableEnded)return;if(!res.headersSent){res.setHeader('Connection','close');json(res,504,{error:'request_deadline'});res.once('finish',()=>req.destroy())}else res.destroy()},limits.requestTimeoutMs)
   if(req.method==='OPTIONS'){
    if(!supplied||!['GET','POST'].includes(String(req.headers['access-control-request-method'])))reject(403,'preflight_rejected')
    const headers=String(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(value=>value.trim()).filter(Boolean)
    if(headers.some(value=>!['authorization','content-type','x-re-team-client'].includes(value)))reject(403,'preflight_rejected')
    res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-RE-Team-Client');res.statusCode=204;res.end();return
   }
   const route=url.slice(scope.length)
   if(!['GET','POST'].includes(req.method??''))reject(405,'method_not_allowed')
   if(req.method==='GET'&&(req.headers['transfer-encoding']!==undefined||Number(req.headers['content-length']??0)!==0))reject(400,'unexpected_body')
   if(req.method==='POST'&&route==='/invites/redeem'){
    const value=await body(req,limits.controlBytes,limits.requestTimeoutMs);fields(value,['invitation'])
    if(typeof value.invitation!=='string')reject(400,'invalid_request')
    try{json(res,200,await host.redeemInvite(value.invitation))}catch(error){if(/Invitation expired|Invalid credential|Invitation is unavailable|Insufficient member-management|already exists|Onboarding session expired/.test(error instanceof Error?error.message:''))reject(401,'invitation_unavailable');throw error}
    return
   }
   const credential=bearer(req)
   // Authenticate before parsing privileged payloads; core rechecks inside its serialized queue.
   const principal=await host.read(credential)
   if(req.method==='GET'&&route==='/state'){json(res,200,principal);return}
   if(req.method==='GET'&&route==='/access'){json(res,200,await host.access(credential));return}
   if(req.method!=='POST')reject(404,'not_found')
   const value=await body(req,limits.controlBytes,limits.requestTimeoutMs)
   if(route==='/operations'){
    fields(value,['operation']);try{validateTeamOperation(value.operation)}catch{reject(400,'invalid_operation')}
    if(!['team.board.replace.v1','team.backchat.post.v1'].includes(value.operation.kind))reject(403,'privileged_operation_forbidden')
    if(principal.role==='Viewer'||value.operation.actor!==principal.member)reject(403,'forbidden')
    json(res,200,{operationId:value.operation.id,receipt:await host.submit(credential,value.operation as any)});return
   }
   if(route==='/invites'){
    fields(value,['role','durationMs','sessionDurationMs']);if(!['Admin','Editor','Viewer'].includes(value.role))reject(400,'invalid_role')
    json(res,200,await host.issueInvite(credential,value.role,duration(value.durationMs),duration(value.sessionDurationMs)));return
   }
   if(route==='/invites/revoke'){fields(value,['digest']);json(res,200,{receipt:await host.revokeInvite(credential,value.digest)});return}
   if(route==='/members'){
    fields(value,['member','role','active']);if(typeof value.member!=='string'||!['Admin','Editor','Viewer'].includes(value.role)||typeof value.active!=='boolean')reject(400,'invalid_member')
    json(res,200,{receipt:await host.setMember(credential,value.member,value.role,value.active)});return
   }
   if(route==='/sessions/issue'){fields(value,['member','durationMs']);if(typeof value.member!=='string')reject(400,'invalid_member');json(res,200,await host.issueSession(credential,value.member,duration(value.durationMs)));return}
   if(route==='/sessions/revoke'){fields(value,['digest']);json(res,200,{receipt:await host.revokeSession(credential,value.digest)});return}
   reject(404,'not_found')
  }catch(error){
   const failure=domain(error)
   if(!res.headersSent&&!res.writableEnded&&!res.destroyed){res.setHeader('Connection','close');json(res,failure.status,{error:failure.code});res.once('finish',()=>req.destroy())}else res.destroy()
  }finally{if(deadline)clearTimeout(deadline);if(admitted)active--}
 }
 return server
}
/** Explicit call only; no bootstrap/credential recovery is exposed through the listener. */
export async function startTeamHttps(host:TeamHost,options:TeamHttpsOptions):Promise<Server>{
 const server=createTeamHttpsServer(host,options)
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port,options.bind,()=>{server.off('error',reject);resolve()})})
 return server
}
