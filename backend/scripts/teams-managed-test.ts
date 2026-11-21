import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile,chmod,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync,spawn} from 'node:child_process'
import {request} from 'node:https'
import {initializeOfflineHost,bootstrapOfflineOwner,issueOfflineInvite,exportPortableOwner,openManagedTeam} from '../src/teams/operator'
import {parseManagedTeamConfig,startManagedTeam} from '../src/teams/managed-server'
import {mergeSharedBoard} from '../../shared/teams/board-merge'
import {sharedBoards} from '../../shared/teams/board'
import {sharedPosts} from '../../shared/teams/backchat'
import {TeamJoin,TeamClient} from '../../shared/teams/client'
import {unlockPortableCredential} from '../../shared/teams/portable-credential'
const root=await mkdtemp(join(tmpdir(),'re-managed-team-')),data=join(root,'host'),password=Buffer.from('test-only managed host passphrase')
let running:Awaited<ReturnType<typeof startManagedTeam>>|undefined
try{
 await chmod(root,0o700)
 const keyPath=join(root,'tls.key'),certPath=join(root,'tls.crt'),ownerFile=join(root,'owner.enc'),portableFile=join(root,'owner.reteam-client'),inviteFile=join(root,'invite.private'),configFile=join(root,'host.json')
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=team.test','-addext','subjectAltName=DNS:team.test','-keyout',keyPath,'-out',certPath],{stdio:'ignore'});await chmod(keyPath,0o600)
 await initializeOfflineHost(data,'managed-team',password)
 const bootstrap=await bootstrapOfflineOwner(data,'owner',86400000,ownerFile,password)
 assert.equal(bootstrap.encryptedCredentialPublished,true);assert.equal((await stat(ownerFile)).mode&0o077,0)
 await assert.rejects(bootstrapOfflineOwner(data,'owner',86400000,ownerFile,password))
 await exportPortableOwner(data,ownerFile,'https://team.test',portableFile,password)
 await issueOfflineInvite(data,ownerFile,'https://team.test','Editor',60000,100000,inviteFile,password)
 const invite=JSON.parse(await readFile(inviteFile,'utf8'));assert.equal((await stat(inviteFile)).mode&0o077,0)
 const config={keyRoot:data,dataRoot:data,certFile:certPath,keyFile:keyPath,confirmNetworkExposure:true as const,bind:'127.0.0.1',port:0,publicOrigin:'https://team.test',allowedOrigins:['https://app.test'],allowNativeClients:false,limits:{attachmentStoreBytes:4096,controlBytes:8192,activeRequests:20,requestsPerMinute:1000,trackedClients:20,requestTimeoutMs:1000}}
 assert.throws(()=>parseManagedTeamConfig(Buffer.from(JSON.stringify({...config,extra:true}))))
 await assert.rejects(startManagedTeam(config,password,false))
 running=await startManagedTeam(config,password,true)
 await assert.rejects(openManagedTeam(data,data,password),'Exclusive writer must prevent offline edits while serving')
 const ca=await readFile(certPath);let requests=0
 const transport:typeof fetch=async(url,init)=>{requests++;const address=running!.server.address();if(!address||typeof address==='string')throw new Error('No listener');return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:address.port,servername:'team.test',path:new URL(String(url)).pathname,method:init?.method,ca,agent:false,headers:{...init?.headers,Host:'team.test',Origin:'https://app.test'}},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:{'Content-Type':String(res.headers['content-type']??'')}})))});req.on('error',reject);init?.signal?.addEventListener('abort',()=>req.destroy(new Error('aborted')),{once:true});req.end(init?.body)})}
 const clientConfig={native:false,timeoutMs:2000,responseBytes:8192,fetch:transport}
 const owner=await unlockPortableCredential(new Uint8Array(await readFile(portableFile)),password.toString(),{origin:'https://team.test',team:'managed-team'},clientConfig)
 assert.equal(requests,0);assert.equal((await owner.read()).role,'Owner')
 assert.deepEqual((await owner.presence(false)).members,[]);assert.equal((await owner.presence(true)).members[0].member,owner.identity().member)
 const joiner=TeamJoin.prepare({origin:'https://team.test',team:'managed-team'},invite.invitation,clientConfig)
 const editor=await joiner.confirm({reviewedOrigin:'https://team.test',reviewedTeam:'managed-team',acceptHostTrust:true,acceptSingleUse:true})
 const state=await editor.read();assert.equal(state.role,'Editor');assert.equal(state.state.boards.length,0)
 const operation={id:'post-operation',actor:editor.identity().member,kind:'team.backchat.post.v1' as const,payload:{id:'post-one',threadId:'general',text:'Explicit shared evidence\nQualification preserved.',attachments:[],links:[]}}
 const ack=await editor.submit(operation);assert.equal(ack.operationId,operation.id)
 // Identical operation replay must not create a duplicate durable post.
 await editor.submit(operation)
 const after=await owner.read(),posts=sharedPosts(after.state.posts,after.state.sequence);assert.equal(posts.length,1);assert.equal(posts[0].text,operation.payload.text)
 for(const invalid of [[{...posts[0],sequence:after.state.sequence+1}],[posts[0],posts[0]],[{...posts[0],actor:'invalid actor'}],[{...posts[0],attachments:['not-a-digest']}],[{...posts[0],links:[{boardId:'board',revision:0}]}],[{...posts[0],extra:true}]])assert.throws(()=>sharedPosts(invalid,after.state.sequence))
 const boardOp={id:'board-create',actor:editor.identity().member,kind:'team.board.replace.v1' as const,payload:{boardId:'shared-board',expectedRevision:0,title:'Shared TLS Board',items:[{id:'note-one',kind:'note',x:20,y:20,width:260,height:180,text:'Exact note evidence'}]}}
 await editor.submit(boardOp)
 const loadedBoard=await owner.read(),projection=sharedBoards(loadedBoard.state.boards,loadedBoard.state.sequence);assert.equal(projection[0].revision,1)
 await owner.submit({...boardOp,id:'owner-update',actor:owner.identity().member,payload:{...boardOp.payload,expectedRevision:1,title:'Other member committed'}})
 await assert.rejects(editor.submit({...boardOp,id:'stale-editor-update',payload:{...boardOp.payload,expectedRevision:1,title:'Must not overwrite'}}))
 const finalBoard=await editor.read();assert.equal(sharedBoards(finalBoard.state.boards,finalBoard.state.sequence)[0].title,'Other member committed')
 for(const invalid of [[{...projection[0],revision:0}],[projection[0],projection[0]],[{...projection[0],items:[{...projection[0].items[0],width:0}]}],[{...projection[0],items:[{...projection[0].items[0],attachmentId:'invalid'}]}]])assert.throws(()=>sharedBoards(invalid,loadedBoard.state.sequence))
 const linkedPost={id:'linked-post-operation',actor:editor.identity().member,kind:'team.backchat.post.v1' as const,payload:{id:'linked-post',threadId:'general',text:'Reviewed linked evidence',attachments:[],links:[{boardId:'shared-board',revision:2,itemId:'note-one'}]}}
 await editor.submit(linkedPost)
 const linked=await owner.read();assert.deepEqual(sharedPosts(linked.state.posts,linked.state.sequence).at(-1)!.links,linkedPost.payload.links)
 await assert.rejects(editor.submit({...linkedPost,id:'stale-link-operation',payload:{...linkedPost.payload,id:'stale-linked-post',links:[{boardId:'shared-board',revision:1}]}}),(error:any)=>error.status===409&&error.outcome==='rejected')
 // Two independent principals repeatedly race on the same loaded canvas revision.
 const durations:number[]=[];let acknowledged=0,conflicts=0
 for(let round=0;round<10;round++){
  const snapshot=await owner.read(),base=sharedBoards(snapshot.state.boards,snapshot.state.sequence)[0],started=performance.now()
  const contenders=[owner,editor].map((client,index)=>client.submit({id:`race-${round}-${index}`,actor:client.identity().member,kind:'team.board.replace.v1',payload:{boardId:base.id,expectedRevision:base.revision,title:`member-${index}-round-${round}`,items:base.items.map(i=>({...i,x:i.x+index+1,text:`round-${round}-member-${index}`}))}}))
  const results=await Promise.allSettled(contenders);durations.push(performance.now()-started)
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);acknowledged++;conflicts++
  const converged=await Promise.all([owner.read(),editor.read()]);assert.deepEqual(converged[0].state.boards,converged[1].state.boards)
 }
 const mergeSeed={id:'merge-board',revision:0,title:'Merge evidence',items:[{id:'merge-one',kind:'note' as const,x:0,y:0,width:200,height:100,text:'A'},{id:'merge-two',kind:'note' as const,x:300,y:0,width:200,height:100,text:'B'}]}
 await owner.submit({id:'merge-create',actor:owner.identity().member,kind:'team.board.replace.v1',payload:{boardId:mergeSeed.id,expectedRevision:0,title:mergeSeed.title,items:mergeSeed.items}})
 const mergeBase={...mergeSeed,revision:1},ours={...structuredClone(mergeBase),items:mergeBase.items.map(i=>({...i,text:i.id==='merge-two'?'Editor edit':i.text}))}
 await owner.submit({id:'merge-other',actor:owner.identity().member,kind:'team.board.replace.v1',payload:{boardId:mergeSeed.id,expectedRevision:1,title:mergeSeed.title,items:mergeBase.items.map(i=>({...i,text:i.id==='merge-one'?'Owner edit':i.text}))}})
 const mergeState=await editor.read(),latestMerge=sharedBoards(mergeState.state.boards,mergeState.state.sequence).find(b=>b.id===mergeSeed.id)!,preview=mergeSharedBoard(mergeBase,ours,latestMerge)
 assert.deepEqual(preview.conflicts,[]);assert.deepEqual(preview.board!.items.map(i=>i.text),['Owner edit','Editor edit'])
 await editor.submit({id:'merge-publish',actor:editor.identity().member,kind:'team.board.replace.v1',payload:{boardId:mergeSeed.id,expectedRevision:preview.board!.revision,title:preview.board!.title,items:preview.board!.items}})
 let lostClient:TeamClient|undefined
 await editor.persistCredential(async(destination,session)=>{lostClient=await TeamClient.fromSession(destination,session,{...clientConfig,fetch:async(url,init)=>{const response=await transport(url,init);if(String(url).endsWith('/operations'))throw new Error('Injected response loss after commit');return response}})})
 const beforeLoss=await owner.read(),baseLoss=sharedBoards(beforeLoss.state.boards,beforeLoss.state.sequence)[0]
 await assert.rejects(lostClient!.submit({id:'lost-canvas-response',actor:editor.identity().member,kind:'team.board.replace.v1',payload:{boardId:baseLoss.id,expectedRevision:baseLoss.revision,title:'Committed despite response loss',items:baseLoss.items}}))
 const recovered=await editor.read();assert.equal(sharedBoards(recovered.state.boards,recovered.state.sequence)[0].revision,baseLoss.revision+1)
 let delayedClient:TeamClient|undefined
 const delayed:typeof fetch=async(url,init)=>{await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(new Error('Injected delayed-link abort'))},timer=setTimeout(()=>{init?.signal?.removeEventListener('abort',stop);resolve()},120);init?.signal?.addEventListener('abort',stop,{once:true});if(init?.signal?.aborted)stop()});return transport(url,init)}
 await editor.persistCredential(async(destination,session)=>{delayedClient=await TeamClient.fromSession(destination,session,{...clientConfig,fetch:delayed})})
 const delayedStart=performance.now();await delayedClient!.read();assert.ok(performance.now()-delayedStart>=100);delayedClient!.disconnect()
 await editor.persistCredential(async(destination,session)=>{delayedClient=await TeamClient.fromSession(destination,session,{...clientConfig,timeoutMs:30,fetch:delayed})})
 await assert.rejects(delayedClient!.read(),(error:any)=>error.code==='stopped_or_timed_out');delayedClient!.disconnect()
 let offlineClient:TeamClient|undefined
 await editor.persistCredential(async(destination,session)=>{offlineClient=await TeamClient.fromSession(destination,session,{...clientConfig,fetch:async()=>{throw new Error('Injected disconnect')}})})
 await assert.rejects(offlineClient!.read());offlineClient!.disconnect();lostClient!.disconnect()
 assert.deepEqual((await owner.read()).state.boards,(await editor.read()).state.boards)
 console.log(JSON.stringify({scenario:'local TLS concurrent canvas stress',principals:2,rounds:10,acknowledged,conflicts,converged:true,responseLossReconciled:true,disconnectRecovered:true,injectedDelayMs:120,timeoutMs:30,timeoutAborted:true,roundMs:durations.map(v=>Math.round(v)),scope:'loopback disposable CA; not WAN throughput/uptime certification'}))
 const attachmentBytes=new TextEncoder().encode('Untrusted shared file contents\n<script>not executable</script>'),attachmentId=await editor.uploadAttachment(attachmentBytes)
 await assert.rejects(owner.downloadAttachment(attachmentId),'Unreferenced uploads must not be downloadable')
 await editor.submit({id:'attachment-post-op',actor:editor.identity().member,kind:'team.backchat.post.v1',payload:{id:'attachment-post',threadId:'general',text:'Reviewed attachment',attachments:[attachmentId],links:[]}})
 assert.deepEqual(await owner.downloadAttachment(attachmentId),attachmentBytes)
 await assert.rejects(editor.uploadAttachment(new Uint8Array(1048577)))
 await assert.rejects(editor.uploadAttachment(new Uint8Array(5000)),(error:any)=>error.status===507)
 await assert.rejects(editor.uploadAttachment(new Uint8Array(9000)),'Host controlBytes=8192 must bound binary uploads')
 const viewerInvite=await owner.createInvite('Viewer',60000,60000)
 assert.equal((await owner.readAccess()).invites?.some(i=>i.digest===viewerInvite.digest),true)
 await assert.rejects(editor.readAccess(),(error:any)=>error.status===403)
 const viewer=await TeamJoin.prepare({origin:'https://team.test',team:'managed-team'},viewerInvite.invitation,clientConfig).confirm({reviewedOrigin:'https://team.test',reviewedTeam:'managed-team',acceptHostTrust:true,acceptSingleUse:true})
 await assert.rejects(viewer.uploadAttachment(attachmentBytes),(error:any)=>error.status===403)
 assert.deepEqual(await viewer.downloadAttachment(attachmentId),attachmentBytes)
 await owner.changeMember(viewer.identity().member,'Viewer',false)
 await assert.rejects(viewer.read(),(error:any)=>error.status===401)
 await owner.changeMember(viewer.identity().member,'Viewer',true)
 await assert.rejects(viewer.read(),(error:any)=>error.status===401,'Reactivation must not resurrect revoked sessions')
 const access=await owner.readAccess(),viewerSession=access.sessions.find(s=>s.member===viewer.identity().member)!
 await owner.revokeAccess('session',viewerSession.digest)
 await assert.rejects(viewer.read(),(error:any)=>error.status===401);viewer.disconnect()
 const unused=await owner.createInvite('Viewer',60000,60000)
 await owner.revokeAccess('invitation',unused.digest)
 await assert.rejects(TeamJoin.prepare({origin:'https://team.test',team:'managed-team'},unused.invitation,clientConfig).confirm({reviewedOrigin:'https://team.test',reviewedTeam:'managed-team',acceptHostTrust:true,acceptSingleUse:true}),(error:any)=>error.status===401)

 const pngBytes=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1sAAAAASUVORK5CYII=','base64')),pngId=await editor.uploadAttachment(pngBytes)
 await editor.submit({id:'canvas-asset-create',actor:editor.identity().member,kind:'team.board.replace.v1',payload:{boardId:'canvas-asset-board',expectedRevision:0,title:'Shared original',items:[{id:'shared-image',kind:'image',text:'Reviewed image',x:40,y:40,width:300,height:240,attachmentId:pngId}]}})
 assert.deepEqual(await owner.downloadAttachment(pngId),pngBytes)
 owner.disconnect();editor.disconnect();await Promise.all([running.close(),running.close()]);running=undefined
 const reopened=await openManagedTeam(data,data,password);await reopened.close()
 await writeFile(configFile,JSON.stringify(config),{mode:0o600})
 // Exercise the built CLI dispatcher and actual SIGTERM drain, not an in-process mock.
 for(let i=0;i<2;i++){
  const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/research-engine.mjs',import.meta.url)),'teams','serve',configFile,'--confirm-network-exposure'],{stdio:['pipe','pipe','pipe']})
  let stdout='',stderr=''
  child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk});child.stdin.end(password)
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('CLI startup timeout'))},10000);child.stdout.on('data',()=>{if(stdout.includes('"listening":true')){clearTimeout(timer);resolve()}});child.once('exit',code=>{clearTimeout(timer);if(!stdout.includes('"listening":true'))reject(new Error(`CLI failed ${code}: ${stderr}`))})})
  child.kill('SIGTERM');const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,0);assert.ok(stdout.includes('"drained":true'));assert.ok(!stdout.includes(password.toString())&&!stdout.includes(invite.invitation));assert.equal(stderr,'')
 }
 console.log('PASS managed host: private encrypted bootstrap/Owner conversion/invitation files, explicit exposure/schema/writer gates, actual trusted local TLS Owner and Editor join/read/post, idempotent post replay, Board revision conflict/no overwrite and projection validation, idempotent drain/reopen, built CLI startup/SIGTERM/restart with no credentials in logs; disposable test CA only')
}finally{await running?.close();password.fill(0);await rm(root,{recursive:true,force:true})}
