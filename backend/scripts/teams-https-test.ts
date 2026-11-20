import assert from 'node:assert/strict'
import { TeamJoin, resolveClientSession } from '../../shared/teams/client'
import { sealClientCredential, unlockClientCredential } from '../src/teams/client-credential'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { request, type Server } from 'node:https'
import { request as plaintextRequest } from 'node:http'
import { randomBytes } from 'node:crypto'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { TeamHost } from '../src/teams/host'
import { createTeamHttpsServer, startTeamHttps, type TeamHttpsOptions } from '../src/teams/https'
const root=await mkdtemp(join(tmpdir(),'re-team-tls-')),servers:Server[]=[]
let host:TeamHost|undefined,checks=0
try{
 const keyPath=join(root,'tls.key'),certPath=join(root,'tls.crt')
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=team.test','-addext','subjectAltName=DNS:team.test','-keyout',keyPath,'-out',certPath],{stdio:'ignore'})
 const key=await readFile(keyPath),cert=await readFile(certPath),journalKey=randomBytes(32),directory=join(root,'journal')
 const init=await TeamJournal.open(directory,journalKey);await init.close()
 const objects=await TeamObjects.open(join(root,'objects'),randomBytes(32),'team-one'),opened=await TeamHost.open(directory,journalKey,objects,{bootstrap:{owner:'owner',durationMs:86400000}})
 host=opened.host;const owner=opened.session!
 await host.setMember(owner.credential,'viewer','Viewer',true);const viewer=await host.issueSession(owner.credential,'viewer',100000)
 const options:TeamHttpsOptions={confirmNetworkExposure:true,bind:'0.0.0.0',port:0,publicOrigin:'https://team.test',allowedOrigins:['https://app.test'],cert,key,allowNativeClients:false,limits:{controlBytes:4096,activeRequests:20,requestsPerMinute:1000,trackedClients:20,requestTimeoutMs:3000}}
 for(const change of [{confirmNetworkExposure:false},{publicOrigin:'http://team.test'},{publicOrigin:'https://wrong.test'},{allowedOrigins:['*']},{allowedOrigins:['http://app.test']},{bind:'localhost'},{limits:{...options.limits,controlBytes:0}}])assert.throws(()=>createTeamHttpsServer(host!,{...options,...change} as any))
 const start=async(patch:Partial<TeamHttpsOptions>={})=>{const server=await startTeamHttps(host!,{...options,...patch});servers.push(server);return server}
 const server=await start()
 assert.equal(server.maxConnections,20);assert.equal(server.maxRequestsPerSocket,100);checks++
 type Response={status:number;headers:Record<string,any>;value:any;text:string}
 const send=(path:string,settings:{server?:Server;method?:string;token?:string|null;origin?:string|null;host?:string;body?:unknown;raw?:string;headers?:Record<string,string>;trusted?:boolean;chunked?:boolean}={}):Promise<Response>=>new Promise((resolve,reject)=>{
  const selected=settings.server??server,address=selected.address();if(!address||typeof address==='string')throw new Error('No listener')
  const headers:Record<string,string>={Host:settings.host??'team.test',...settings.headers}
  if(settings.origin!==null)headers.Origin=settings.origin??'https://app.test'
  if(settings.token!==null)headers.Authorization='Bearer '+(settings.token??owner.credential)
  let bytes:string|undefined=settings.raw??(settings.body===undefined?undefined:JSON.stringify(settings.body))
  if(bytes!==undefined){headers['Content-Type']??='application/json';if(!settings.chunked)headers['Content-Length']=String(Buffer.byteLength(bytes))}
  const req=request({hostname:'127.0.0.1',port:address.port,servername:'team.test',path,method:settings.method??(bytes===undefined?'GET':'POST'),headers,ca:settings.trusted===false?undefined:cert,agent:false},res=>{
   const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let value:any;try{value=JSON.parse(text)}catch{value=text}resolve({status:res.statusCode!,headers:res.headers,value,text})})
  });req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('Test timeout')))
  if(bytes!==undefined&&settings.chunked){req.write(bytes.slice(0,20));req.end(bytes.slice(20))}else req.end(bytes)
 })
 const scope='/v1/teams/team-one'
 await assert.rejects(send(scope+'/state',{trusted:false}))
 const listener=server.address() as {port:number}
 const plaintext=await new Promise<number|string>(resolve=>{const req=plaintextRequest({hostname:'127.0.0.1',port:listener.port,path:scope+'/state'},res=>{res.resume();resolve(res.statusCode!)});req.on('error',()=>resolve('closed'));req.end()});assert.ok(plaintext==='closed'||Number(plaintext)>=400)
 const state=await send(scope+'/state');assert.equal(state.status,200);assert.equal(state.value.role,'Owner');assert.equal(state.value.member,'owner');assert.equal(state.value.state.access,undefined)
 assert.equal(state.headers['cache-control'],'no-store');assert.equal(state.headers['access-control-allow-origin'],'https://app.test');assert.equal(state.headers['access-control-allow-credentials'],undefined);checks++
 for(const [settings,status]of [[{host:'evil.test'},421],[{origin:'https://evil.test'},403],[{origin:'null'},403],[{origin:null},403],[{token:null},401]] as const){const response=await send(scope+'/state',settings as any);assert.equal(response.status,status);assert.ok(!response.text.includes(owner.credential))}
 assert.equal((await send(scope+'/state?credential=NEVER_ACCEPT',{token:null})).status,400)
 assert.equal((await send('/api/fs')).status,404);assert.equal((await send('/v1/teams/other/state')).status,404);checks++
 const preflight=await send(scope+'/operations',{method:'OPTIONS',token:null,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}})
 assert.equal(preflight.status,204)
 assert.equal((await send(scope+'/operations',{method:'OPTIONS',token:null,origin:'https://evil.test',headers:{'Access-Control-Request-Method':'POST'}})).status,403)
 assert.equal((await send(scope+'/operations',{method:'OPTIONS',token:null,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-unapproved'}})).status,403);checks++
 const operation={id:'one',actor:'owner',kind:'team.board.replace.v1',payload:{boardId:'board',expectedRevision:0,title:'TLS shared Board',items:[]}}
 const accepted=await send(scope+'/operations',{body:{operation}});assert.equal(accepted.status,200);assert.equal(accepted.value.operationId,'one')
 assert.deepEqual((await send(scope+'/operations',{body:{operation}})).value,accepted.value)
 assert.equal((await send(scope+'/operations',{body:{operation:{...operation,id:'stale'}}})).status,409)
 assert.equal((await send(scope+'/operations',{token:viewer.credential,body:{operation:{...operation,id:'viewer',actor:'viewer'}}})).status,403)
 assert.equal((await send(scope+'/operations',{body:{operation:{...operation,id:'spoof',actor:'viewer'}}})).status,403)
 assert.equal((await send(scope+'/access',{token:viewer.credential})).status,403)
 assert.equal((await send(scope+'/operations',{body:{operation:{id:'inject',actor:'owner',kind:'team.access.member.v1',payload:{member:'bad',role:'Admin',active:true}}}})).status,403);checks++
 assert.equal((await send(scope+'/operations',{raw:'{secret-invalid-json'})).status,400)
 assert.equal((await send(scope+'/operations',{body:{operation,extra:'unsupported'}})).status,400)
 assert.equal((await send(scope+'/operations',{raw:'text',headers:{'Content-Type':'text/plain'}})).status,415)
 assert.equal((await send(scope+'/operations',{body:{operation},headers:{'Content-Encoding':'gzip'}})).status,415)
 const limited=await start({limits:{...options.limits,controlBytes:128}})
 assert.equal((await send(scope+'/operations',{server:limited,body:{operation:{...operation,payload:{...operation.payload,title:'x'.repeat(500)}}}})).status,413)
 assert.equal((await send(scope+'/operations',{server:limited,chunked:true,raw:'x'.repeat(500)})).status,413);checks++
 const invitation=await send(scope+'/invites',{body:{role:'Editor',durationMs:10000,sessionDurationMs:10000}});assert.equal(invitation.status,200);assert.equal(invitation.headers['cache-control'],'no-store')
 const joined=await Promise.all([send(scope+'/invites/redeem',{token:null,body:{invitation:invitation.value.invitation}}),send(scope+'/invites/redeem',{token:null,body:{invitation:invitation.value.invitation}})])
 assert.deepEqual(joined.map(value=>value.status).sort(),[200,401]);const member=joined.find(value=>value.status===200)!.value
 assert.equal((await send(scope+'/state',{token:member.credential})).value.role,'Editor')
 await send(scope+'/sessions/revoke',{body:{digest:member.digest}});assert.equal((await send(scope+'/state',{token:member.credential})).status,401)
 const bannedOrigin=await send(scope+'/invites',{origin:'https://evil.test',body:{role:'Editor',durationMs:10000,sessionDurationMs:10000}});assert.equal(bannedOrigin.status,403);assert.equal(bannedOrigin.headers['access-control-allow-origin'],undefined);checks++
 const native=await start({allowNativeClients:true})
 assert.equal((await send(scope+'/state',{server:native,origin:null,headers:{'X-RE-Team-Client':'native-v1'}})).status,200)
 assert.equal((await send(scope+'/state',{server:native,origin:null})).status,403)
 assert.equal((await send(scope+'/state',{server:native,origin:'https://evil.test',headers:{'X-RE-Team-Client':'native-v1'}})).status,403);checks++
 const rate=await start({limits:{...options.limits,requestsPerMinute:2}})
 assert.equal((await send(scope+'/state',{server:rate})).status,200);assert.equal((await send(scope+'/state',{server:rate})).status,200)
 assert.equal((await send(scope+'/state',{server:rate,headers:{'X-Forwarded-For':'different-client'}})).status,429);checks++
 const deadline=await start({limits:{...options.limits,requestTimeoutMs:150}}),address=deadline.address() as {port:number}
 const timed=await new Promise<number>((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:address.port,servername:'team.test',ca:cert,agent:false,path:scope+'/operations',method:'POST',headers:{Host:'team.test',Origin:'https://app.test',Authorization:'Bearer '+owner.credential,'Content-Type':'application/json','Content-Length':'100'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!))})
  req.on('error',reject);req.write('{')
 });assert.ok([408,504].includes(timed));checks++
 // Portable client exercised through the same verified TLS listener. Test-only CA routing;
 // production uses platform trust and never receives a certificate-bypass callback.
 const clientFetch:typeof fetch=async(url,init)=>{
  const response=await send(new URL(String(url)).pathname,{method:init?.method,token:(init?.headers as any)?.Authorization?.slice(7)??null,raw:typeof init?.body==='string'?init.body:undefined})
  return new globalThis.Response(response.text,{status:response.status,headers:{'Content-Type':response.headers['content-type']}})
 }
 const clientConfig={native:false,timeoutMs:3000,responseBytes:65536,fetch:clientFetch}
 const destination={origin:'https://team.test',team:'team-one'}
 const invite=await host!.issueInvite(owner.credential,'Editor',10000,100000)
 const onboarding=TeamJoin.prepare(destination,invite.invitation,clientConfig)
 const client=await onboarding.confirm({reviewedOrigin:destination.origin,reviewedTeam:destination.team,acceptHostTrust:true,acceptSingleUse:true})
 const identity=client.identity();assert.equal((await client.read()).member,identity.member)
 const clientOperation={id:'portable-client',actor:identity.member,kind:'team.board.replace.v1' as const,payload:{boardId:'portable',expectedRevision:0,title:'Client TLS',items:[]}}
 const ack=await client.submit(clientOperation);assert.deepEqual(await client.submit(clientOperation),ack)
 let encrypted:Buffer|undefined;const password=Buffer.from('explicit TLS client persistence test')
 await client.persistCredential(async(endpoint,session)=>{encrypted=await sealClientCredential(endpoint,session,password)})
 client.disconnect();const resumed=await unlockClientCredential(encrypted!,password,destination,clientConfig)
 assert.equal((await resumed.read()).member,identity.member);resumed.disconnect()
 const ownerClient=await resolveClientSession(destination,owner,clientConfig);assert.equal(ownerClient.identity().member,'owner');ownerClient.disconnect();checks++
 console.log(`PASS ${checks} actual local TLS transport checks: explicit exposure/config/certificate gates, certificate verification, host/origin/native policy, CORS preflight, bearer roles/actor isolation and durable retries, strict bounded JSON, single-use invite onboarding/revocation, peer-IP rate limit, slow-body deadline. Generated test certs only; no external calls or private-local routes.`)
}finally{
 for(const server of servers){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
 await host?.close();await rm(root,{recursive:true,force:true})
}
