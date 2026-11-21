import {useDurableTeamSend} from './useDurableTeamSend'
import {mergeSharedBoard} from '../../../../shared/teams/board-merge'
import {SharedBoardCanvas} from './SharedBoardCanvas'
import {BoardDraftRecovery} from './BoardDraftRecovery'
import {useEffect,useRef,useState} from 'react'
import {TeamClient,TeamClientError,type ClientOperation} from '@/lib/teams/client'
import {sharedBoards,type TeamBoard} from '../../../../shared/teams/board'

/** Shared draft canvas with explicit whole-document compare-and-swap publication.
 * Local Board storage is never opened. Attachment transport is separate work. */
export function TeamBoards({client,isScoped}:{client:TeamClient;isScoped:()=>boolean}){
 const [boards,setBoards]=useState<TeamBoard[]>([]),[draft,setDraft]=useState<TeamBoard>(),[loaded,setLoaded]=useState(false),[role,setRole]=useState('Viewer'),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[pending,setPending]=useState<ClientOperation>(),[notice,setNotice]=useState('Load shared Boards explicitly. Local Boards are never read or imported.'),[conflict,setConflict]=useState(false)
 const mergeBase=useRef<TeamBoard|undefined>(undefined)
 const active=useRef<AbortController|undefined>(undefined),alive=useRef(true),scope=useRef(isScoped),sequence=useRef(-1);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 const current=()=>alive.current&&scope.current()
 const editable=!!draft
 const bytes=draft?new TextEncoder().encode(JSON.stringify(draft)).length:0
 const latest=draft?boards.find(b=>b.id===draft.id):undefined
 const durable=useDurableTeamSend({client,kind:'team.board.replace.v1',disabled:busy,isScoped,canRestore:!draft&&!pending,pendingId:pending?.id,onBusy:setBusy,onRestore:operation=>{
  const p=operation.payload as {boardId:string;expectedRevision:number;title:string;items:TeamBoard['items']}
  mergeBase.current=undefined;setDraft({id:p.boardId,revision:p.expectedRevision,title:p.title,items:p.items});setPending(operation);setLoaded(false);setConsent(false);setConflict(false);setNotice('Saved operation restored as a frozen draft. Read shared state to reconcile or explicitly retry the exact saved identity.')
 },onResult:(_operation,rejected,status)=>{setPending(undefined);setLoaded(false);setConsent(false);if(!rejected)setDraft(undefined);setConflict(rejected&&status===409);setNotice(rejected?'Saved operation rejected. Draft retained; refresh and review conflicts.':'Saved operation acknowledged. Refresh shared Boards.')}})
 async function load(){
  if(active.current||!current())return
  const abort=new AbortController();active.current=abort;setBusy(true);setConsent(false)
  try{
   const result=await client.read(abort.signal),next=sharedBoards(result.state.boards,result.state.sequence)
   if(result.state.sequence<sequence.current)throw new Error('Regressing snapshot')
   if(!current())return
   sequence.current=result.state.sequence;setBoards(next);setRole(result.role);setLoaded(true)
   if(pending){
    const p=pending.payload as {boardId:string;expectedRevision:number;title:string;items:TeamBoard['items']},found=next.find(b=>b.id===p.boardId)
    if(found&&found.revision===p.expectedRevision+1&&found.title===p.title&&JSON.stringify(found.items)===JSON.stringify(p.items)){await durable.settle(pending);if(!current())return;setPending(undefined);setDraft(found);setConflict(false);setNotice('Exact pending Board revision found in the host snapshot. Nothing was resent.')}
    else setNotice('Board send is unresolved. A later revision or absence cannot prove whether it committed. Keep the operation ID/draft and contact the host; no automatic retry.')
   }else if(draft){const found=next.find(b=>b.id===draft.id);const changed=(found?.revision??0)!==draft.revision;setConflict(changed);setNotice(changed?'Host revision changed. Draft retained; compare below. No merge or overwrite occurred.':'Shared snapshot refreshed. Your draft was not replaced.')}
   else setNotice('Shared Boards loaded. Select a snapshot or create a new shared note Board.')
  }catch{if(current()){setLoaded(false);setNotice('Could not verify shared Boards. Old snapshots are stale; drafts retained. No automatic retry.')}}
  finally{active.current=undefined;if(current())setBusy(false)}
 }
 function edit(value:TeamBoard){setDraft(value);setConsent(false)}
 async function send(){
  if(active.current||!current()||!draft||!editable||!loaded||role==='Viewer'||!consent||pending||conflict||bytes>64000)return
  const operation:ClientOperation={id:crypto.randomUUID(),actor:client.identity().member,kind:'team.board.replace.v1',payload:{boardId:draft.id,expectedRevision:draft.revision,title:draft.title,items:structuredClone(draft.items)}}
  const abort=new AbortController();active.current=abort;setBusy(true);setConsent(false);setPending(operation)
  let dispatched=false
  try{await durable.prepare(operation);if(!current()||abort.signal.aborted)return;dispatched=true;await client.submit(operation,abort.signal);await durable.settle(operation);if(current()){setPending(undefined);setLoaded(false);setDraft(undefined);setNotice('Host acknowledged the Board revision. Refresh to load it; no optimistic shared snapshot was fabricated.')}}
  catch(error){if(current()){
   setLoaded(false)
   if(!dispatched){setPending(undefined);setNotice('Operation was not dispatched. Check outbox passphrase/storage or inspect an existing saved pending operation. Draft retained.')}
   else if(error instanceof TeamClientError&&error.outcome==='rejected'){await durable.settle(operation);if(!current())return;setPending(undefined);setConflict(error.status===409);setNotice(error.status===409?'Revision conflict: draft retained, nothing overwritten. Refresh and compare the latest revision.':'Host rejected the Board edit. Draft retained; refresh permissions/state before another review.')}
   else setNotice('Board send outcome uncertain. Draft frozen with stable operation ID; refresh to reconcile, never blindly resend.')
  }}finally{active.current=undefined;if(current())setBusy(false)}
 }
 function saveDraft(){if(!draft)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'re-team-board-draft',team:client.identity().team,origin:client.identity().origin,operationId:pending?.id,board:draft},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='shared-board-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="re-teams-card" aria-label="Shared Team Boards"><h2>Shared Team Boards</h2>
  <p>Explicit snapshots, not live cursors or automatic sync. Shared canvas edits use reviewed whole-Board revisions, not live per-item merging. Private local Boards stay separate. Drafts and unresolved sends are memory-only: export before leaving.</p>
  <p role="status">{notice}</p><button className="bui-button" disabled={busy} onClick={()=>void load()}>Load / refresh shared Boards</button>
  <ul>{boards.map(board=><li key={board.id}><button className="bui-button" disabled={busy||!!pending||!!draft} onClick={()=>{mergeBase.current=structuredClone(board);edit(structuredClone(board));setConflict(false)}}>{board.title||'Untitled Board'} · revision {board.revision}</button></li>)}</ul>
  <button className="bui-button" disabled={busy||!!pending||!!draft||!loaded||role==='Viewer'} onClick={()=>edit({id:crypto.randomUUID(),revision:0,title:'New shared Board',items:[]})}>New shared note Board</button>
  {pending&&<p role="alert">Unresolved Board operation: {pending.id}. Export this draft and identity before leaving. Use encrypted draft recovery below to preserve the draft and unresolved identity.</p>}
  {durable.panel}
  <BoardDraftRecovery destination={client.identity()} member={client.identity().member} draft={draft?{board:draft,member:client.identity().member,...(pending?{operationId:pending.id}:{})}:undefined} blocked={busy} isScoped={isScoped} onBusy={setBusy} onRestore={value=>{
   mergeBase.current=undefined;setDraft(value.board);setConsent(false);setLoaded(false);setConflict(false)
   setPending(value.operationId?{id:value.operationId,actor:value.member,kind:'team.board.replace.v1',payload:{boardId:value.board.id,expectedRevision:value.board.revision,title:value.board.title,items:value.board.items}}:undefined)
   setNotice('Imported draft is local only. Explicitly load shared Boards to check current revision and permissions before any new publication.')
  }}/>
  {draft&&<>
   <div className="re-teams-actions"><button className="bui-button" onClick={saveDraft}>Export plaintext Board draft</button><button className="bui-button" disabled={busy||!!pending} onClick={()=>{if(window.confirm('Discard this in-memory draft? Export it first if needed.')){setDraft(undefined);setConsent(false);setConflict(false)}}}>Discard Board draft</button></div>
   <p>Board {draft.id} · expected revision {draft.revision} · {bytes} / 64000 UTF-8 draft bytes. No truncation.</p>
   {conflict&&<aside aria-label="Board conflict comparison"><h3>Latest host snapshot</h3><p>Your draft below has not changed. To adopt this snapshot, export your draft first, discard it, then select the Board again and manually reapply reviewed edits. No force overwrite. If the original base is still held in this tab, you can explicitly preview a conservative whole-item merge. Same-item edits and invalid relationships require manual resolution.</p>
    <button className="bui-button" disabled={busy||!!pending||!loaded||!latest||!mergeBase.current||role==='Viewer'} onClick={()=>{
     if(!latest||!mergeBase.current)return
     const result=mergeSharedBoard(mergeBase.current,draft,latest)
     if(!result.board){setConsent(false);setNotice(`Merge not applied; draft retained. Conflicts: ${result.conflicts.join(', ')}`);return}
     mergeBase.current=structuredClone(latest);setDraft(result.board);setConflict(false);setConsent(false);setNotice('Disjoint changes merged into a local preview at the latest loaded revision. Nothing published. Review every item before consenting to publish.')
    }}>Preview disjoint canvas merge</button><pre className="re-team-post-text">{JSON.stringify(latest??{notice:'No matching Board in the last loaded snapshot'},null,2)}</pre></aside>}
   <SharedBoardCanvas key={`${draft.id}:${draft.revision}`} board={draft} client={client} isScoped={isScoped} onBusy={setBusy} disabled={busy||!!pending||role==='Viewer'} onChange={edit}/>
   <fieldset disabled={busy||!!pending||!editable||role==='Viewer'}><legend>Shared Board draft</legend>
    <label>Title<input className="bui-field" aria-label="Shared Board title" value={draft.title} onChange={e=>edit({...draft,title:e.target.value})}/></label>
    {draft.items.map((item,index)=><label key={item.id}>{item.kind} {index+1}<textarea className="bui-field" aria-label={`Shared ${item.kind} ${index+1}`} value={item.text} rows={4} onChange={e=>edit({...draft,items:draft.items.map((v,i)=>i===index?{...v,text:e.target.value}:v)})}/></label>)}
    <button className="bui-button" onClick={()=>edit({...draft,items:[...draft.items,{id:crypto.randomUUID(),kind:'note',text:'',x:24,y:24+draft.items.length*200,width:260,height:180}]})}>Add shared note</button>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I reviewed the entire shared Board draft and expected revision and consent to publish it to this Team.</label>
    <button className="bui-button" disabled={!loaded||!consent||conflict||bytes>64000} onClick={()=>void send()}>Publish shared Board revision</button>
   </fieldset>
   {!editable&&<p>This Board contains non-note items. Editing is disabled to preserve unsupported content, geometry and attachment references. Text shown above is a read-only projection, not the full canvas.</p>}
  </>}
 </section>
}
