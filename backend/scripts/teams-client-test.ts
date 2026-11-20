import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {TeamClient,TeamJoin,TeamClientError,resolveClientSession,type ClientOptions} from '../../shared/teams/client'
import {sealClientCredential,unlockClientCredential} from '../src/teams/client-credential'
import type {QueueTransport} from '../src/teams/pending'
const endpoint={origin:'https://team.test',team:'team-one'},credential=randomBytes(32).toString('base64url')
const session={credential,digest:createHash('sha256').update(endpoint.team+'\0'+credential).digest('hex'),expiresAt:Date.now()+100000,receipt:{sequence:1,digest:'a'.repeat(64)},member:'editor',role:'Editor' as const}
let calls=0,last:RequestInit|undefined,reply:()=>Response=()=>Response.json(session)
const config:ClientOptions={native:true,timeoutMs:1000,responseBytes:4096,fetch:async(_url,init)=>{calls++;last=init;return reply()}}
let checks=0
for(const origin of ['http://team.test','https://team.test/','https://a:b@team.test','https://team.test?q=secret'])assert.throws(()=>TeamJoin.prepare({...endpoint,origin},credential,config));checks++
const join=TeamJoin.prepare(endpoint,credential,config);assert.equal(calls,0);assert.equal(join.review().hostCanReadSharedData,true)
await assert.rejects(join.confirm({reviewedOrigin:'https://wrong.test',reviewedTeam:endpoint.team,acceptHostTrust:true,acceptSingleUse:true}));assert.equal(calls,0)
const client=await join.confirm({reviewedOrigin:endpoint.origin,reviewedTeam:endpoint.team,acceptHostTrust:true,acceptSingleUse:true});assert.equal(join.review().phase,'joined');assert.equal(calls,1)
assert.equal(last?.credentials,'omit');assert.equal(last?.redirect,'error');assert.equal((last?.headers as any)['X-RE-Team-Client'],'native-v1');assert.equal((last?.headers as any).Authorization,undefined)
await assert.rejects(join.confirm({reviewedOrigin:endpoint.origin,reviewedTeam:endpoint.team,acceptHostTrust:true,acceptSingleUse:true}));checks++
reply=()=>Response.json({state:{schemaVersion:1,sequence:1,boards:[],posts:[],requiredAttachments:[]},member:'editor',role:'Viewer'})
await client.read();assert.equal(client.identity().role,'Viewer');assert.equal((last?.headers as any).Authorization,'Bearer '+credential);checks++
const operation={id:'one',actor:'editor',kind:'team.board.replace.v1' as const,payload:{boardId:'board',expectedRevision:0,title:'Shared',items:[]}}
reply=()=>Response.json({operationId:'one',receipt:session.receipt})
const transport:QueueTransport=client.queueTransport();assert.equal((await transport(operation,new AbortController().signal)).type,'ack')
reply=()=>Response.json({error:'conflict'},{status:409});assert.equal((await transport(operation,new AbortController().signal)).type,'conflict');checks++
reply=()=>Response.json({operationId:'other',receipt:session.receipt});await assert.rejects(client.submit(operation),/operation_identity_mismatch/)
await assert.rejects(client.submit({...operation,actor:'spoof'}),/invalid_content_operation/);checks++
reply=()=>new Response('x'.repeat(4100),{headers:{'Content-Type':'application/json'}});await assert.rejects(client.read(),/response_budget_exceeded/)
reply=()=>new Response('bad',{headers:{'Content-Type':'text/plain'}});await assert.rejects(client.read(),/invalid_response/)
reply=()=>Response.json({error:'sensitive text must not leak'},{status:500});await assert.rejects(client.read(),error=>error instanceof TeamClientError&&error.code==='request_rejected'&&error.outcome==='unknown');checks++
const broken=TeamJoin.prepare(endpoint,credential,{...config,fetch:async()=>{throw new Error('secret')}})
await assert.rejects(broken.confirm({reviewedOrigin:endpoint.origin,reviewedTeam:endpoint.team,acceptHostTrust:true,acceptSingleUse:true}),/transport_unavailable/);assert.equal(broken.review().phase,'uncertain');checks++
await assert.rejects(TeamClient.fromSession({...endpoint,team:'other'},session,config),/session_scope_mismatch/)
await assert.rejects(TeamClient.fromSession(endpoint,{...session,expiresAt:1},config),/invalid_session/);checks++
const password=Buffer.from('explicit client custody passphrase'),sealed=await sealClientCredential(endpoint,session,password)
assert.equal(sealed.includes(credential),false);const restored=await unlockClientCredential(sealed,password,endpoint,config);assert.equal(restored.identity().member,session.member)
await assert.rejects(unlockClientCredential(sealed,Buffer.from('incorrect passphrase'),endpoint,config));await assert.rejects(unlockClientCredential(sealed,password,{...endpoint,origin:'https://other.test'},config))
const tampered=JSON.parse(sealed.toString());tampered.team='other';await assert.rejects(unlockClientCredential(Buffer.from(JSON.stringify(tampered)),password,{...endpoint,team:'other'},config));checks++
let persisted=false;await client.persistCredential(async(scope,value)=>{assert.deepEqual(scope,endpoint);assert.equal(value.credential,credential);persisted=true});assert.equal(persisted,true)
client.disconnect();await assert.rejects(client.read(),/client_disconnected/);restored.disconnect();checks++
reply=()=>Response.json({member:'owner',role:'Owner'});const resolved=await resolveClientSession(endpoint,session,config);assert.equal(resolved.identity().member,'owner');resolved.disconnect();checks++
const abortableFetch:typeof fetch=async(_url,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('abort')),{once:true})})
const timed=await TeamClient.fromSession(endpoint,session,{...config,timeoutMs:10,fetch:abortableFetch})
await assert.rejects(timed.read(),/stopped_or_timed_out/);timed.disconnect();checks++
const stoppable=await TeamClient.fromSession(endpoint,session,{...config,fetch:abortableFetch});const inFlight=stoppable.read();stoppable.disconnect();await assert.rejects(inFlight,/stopped_or_timed_out/);checks++
const redirected=await TeamClient.fromSession(endpoint,session,{...config,fetch:async()=>{const response=Response.json({});Object.defineProperty(response,'redirected',{value:true});return response}})
await assert.rejects(redirected.read(),/redirect_forbidden/);redirected.disconnect();checks++
console.log(`Teams client: ${checks} grouped checks passed`)
