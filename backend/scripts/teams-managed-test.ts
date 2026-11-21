import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile,chmod,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync,spawn} from 'node:child_process'
import {request} from 'node:https'
import {initializeOfflineHost,bootstrapOfflineOwner,issueOfflineInvite,exportPortableOwner,openManagedTeam} from '../src/teams/operator'
import {parseManagedTeamConfig,startManagedTeam} from '../src/teams/managed-server'
import {sharedBoards} from '../../shared/teams/board'
import {sharedPosts} from '../../shared/teams/backchat'
import {TeamJoin} from '../../shared/teams/client'
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
 const config={keyRoot:data,dataRoot:data,certFile:certPath,keyFile:keyPath,confirmNetworkExposure:true as const,bind:'127.0.0.1',port:0,publicOrigin:'https://team.test',allowedOrigins:['https://app.test'],allowNativeClients:false,limits:{controlBytes:8192,activeRequests:20,requestsPerMinute:1000,trackedClients:20,requestTimeoutMs:1000}}
 assert.throws(()=>parseManagedTeamConfig(Buffer.from(JSON.stringify({...config,extra:true}))))
 await assert.rejects(startManagedTeam(config,password,false))
 running=await startManagedTeam(config,password,true)
 await assert.rejects(openManagedTeam(data,data,password),'Exclusive writer must prevent offline edits while serving')
 const ca=await readFile(certPath);let requests=0
 const transport:typeof fetch=async(url,init)=>{requests++;const address=running!.server.address();if(!address||typeof address==='string')throw new Error('No listener');return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:address.port,servername:'team.test',path:new URL(String(url)).pathname,method:init?.method,ca,agent:false,headers:{...init?.headers,Host:'team.test',Origin:'https://app.test'}},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:{'Content-Type':'application/json'}})))});req.on('error',reject);init?.signal?.addEventListener('abort',()=>req.destroy(new Error('aborted')),{once:true});req.end(init?.body)})}
 const clientConfig={native:false,timeoutMs:2000,responseBytes:8192,fetch:transport}
 const owner=await unlockPortableCredential(new Uint8Array(await readFile(portableFile)),password.toString(),{origin:'https://team.test',team:'managed-team'},clientConfig)
 assert.equal(requests,0);assert.equal((await owner.read()).role,'Owner')
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
