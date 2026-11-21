import {BackChatDraftRecovery} from './BackChatDraftRecovery'
import {useEffect,useRef,useState} from 'react'
import {TeamClient,TeamClientError,type ClientOperation} from '@/lib/teams/client'
import {sharedPosts,type SharedPost} from '../../../../shared/teams/backchat'

type Props={client:TeamClient;isScoped:()=>boolean}
export function TeamBackChat({client,isScoped}:Props){
 const [posts,setPosts]=useState<SharedPost[]>([]),[loaded,setLoaded]=useState(false),[role,setRole]=useState('Viewer'),[draft,setDraft]=useState(''),[thread,setThread]=useState('general'),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Load shared posts explicitly. Nothing is sent automatically.'),[pending,setPending]=useState<ClientOperation>(),[reviewed,setReviewed]=useState(false)
 const alive=useRef(true),active=useRef<AbortController|undefined>(undefined),lastSequence=useRef(-1),scope=useRef(isScoped);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 const current=()=>alive.current&&scope.current()
 async function load(){
  if(active.current||!current())return
  const abort=new AbortController();active.current=abort;setBusy(true);setConsent(false)
  try{
   const result=await client.read(abort.signal),next=sharedPosts(result.state.posts,result.state.sequence)
   if(result.state.sequence<lastSequence.current)throw new Error('Shared state moved backwards')
   if(!current())return
   lastSequence.current=result.state.sequence;setPosts(next);setRole(result.role);setLoaded(true);setReviewed(true)
   if(pending){
    const payload=pending.payload as {id:string;threadId:string;text:string},found=next.find(p=>p.id===payload.id)
    if(found&&found.actor===pending.actor&&found.text===payload.text&&found.threadId===payload.threadId&&found.attachments.length===0&&found.links.length===0){setPending(undefined);setDraft('');setNotice('The host snapshot contains the exact pending post. It was not resent.')}
    else setNotice('Pending send is still unresolved. Absence from this snapshot is not proof of rejection. No automatic retry; preserve the text and ask the host to investigate.')
   }else setNotice('Shared posts loaded. This is a snapshot; refresh explicitly for new posts.')
  }catch{if(current()){setLoaded(false);setReviewed(false);setNotice('Shared posts could not be verified. Previous posts are stale. Check connection, session and host; no automatic retry.')}}
  finally{active.current=undefined;if(current())setBusy(false)}
 }
 async function send(){
  if(active.current||!current()||!loaded||role==='Viewer'||pending||!consent||!draft.trim()||new TextEncoder().encode(draft).length>16000||!/^[A-Za-z0-9_-]{1,128}$/.test(thread))return
  const operation:ClientOperation={id:crypto.randomUUID(),actor:client.identity().member,kind:'team.backchat.post.v1',payload:{id:crypto.randomUUID(),threadId:thread,text:draft,attachments:[],links:[]}}
  const abort=new AbortController();active.current=abort;setBusy(true);setConsent(false);setPending(operation);setReviewed(false)
  try{
   await client.submit(operation,abort.signal)
   if(current()){setPending(undefined);setDraft('');setLoaded(false);setNotice('Host acknowledged the post. Refresh shared posts to see the durable snapshot. No model was called.')}
  }catch(error){if(current()){
   setLoaded(false)
   if(error instanceof TeamClientError&&error.outcome==='rejected'){setPending(undefined);setNotice('Host rejected the send. Draft retained; refresh permissions/state before reviewing another send.')}
   else setNotice('Send outcome is uncertain: it may already be committed. Draft and post identity are held in memory. Refresh to reconcile; do not copy and resend blindly.')
  }}finally{active.current=undefined;if(current())setBusy(false)}
 }
 return <section className="re-teams-card" aria-label="Teams BackChat"><h2>Teams BackChat</h2>
  <p>Shared with this Team and its authorized host—not a private chat or an AI session. Plain text only; attachments and Board-link creation are not available yet. Posts and unsent drafts are memory-only here and disappear when you leave.</p>
  <p role="status">{notice}</p>
  <button className="bui-button" disabled={busy} onClick={()=>void load()}>Load / refresh shared posts</button>
  {pending&&<p role="alert">Unresolved post: {(pending.payload as {id:string}).id}. Keep this identity when contacting the host. {reviewed?'A refreshed snapshot has not resolved it.':''}</p>}
  <BackChatDraftRecovery destination={client.identity()} member={client.identity().member} draft={draft||pending?{text:draft,threadId:thread,member:client.identity().member,...(pending?{pending:{operationId:pending.id,postId:(pending.payload as {id:string}).id}}:{})}:undefined} blocked={busy} isScoped={isScoped} onBusy={setBusy} onRestore={value=>{
   setDraft(value.text);setThread(value.threadId);setConsent(false);setLoaded(false);setReviewed(false)
   setPending(value.pending?{id:value.pending.operationId,actor:value.member,kind:'team.backchat.post.v1',payload:{id:value.pending.postId,threadId:value.threadId,text:value.text,attachments:[],links:[]}}:undefined)
   setNotice('BackChat draft restored locally. Nothing was posted. Explicitly load shared posts before reviewing a send or reconciling its original identity.')
  }}/>
  <ol className="re-team-posts" aria-label="Shared BackChat posts">{posts.map(post=><li key={post.id}><article><h3>{post.actor} · {post.threadId} · sequence {post.sequence}</h3><p className="re-team-post-text">{post.text}</p>{post.attachments.length>0&&<p>{post.attachments.length} attachment references (download unavailable)</p>}{post.links.map((link,i)=><p key={i}>Board {link.boardId} · revision {link.revision}{link.itemId?` · item ${link.itemId}`:''} (snapshot reference)</p>)}</article></li>)}</ol>
  {loaded&&posts.length===0&&<p>No shared posts in this snapshot.</p>}
  <fieldset disabled={busy||!!pending}><legend>Compose shared post</legend>
   <label>Thread ID<input className="bui-field" aria-label="BackChat thread ID" value={thread} onChange={e=>{setThread(e.target.value);setConsent(false)}} /></label>
   <label>Post text<textarea className="bui-field" aria-label="Shared BackChat post text" rows={5} value={draft} onChange={e=>{setDraft(e.target.value);setConsent(false)}} /></label>
   <p>{new TextEncoder().encode(draft).length} / 16000 UTF-8 bytes. Nothing is truncated. Load current state first; Viewer sessions cannot post.</p>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />I reviewed this exact text and thread and want to share it with this Team.</label>
   <button className="bui-button" disabled={!loaded||role==='Viewer'||!consent||!draft.trim()||new TextEncoder().encode(draft).length>16000||!/^[A-Za-z0-9_-]{1,128}$/.test(thread)} onClick={()=>void send()}>Send shared post</button>
  </fieldset>
 </section>
}
