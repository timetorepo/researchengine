import {useEffect,useRef,useState} from 'react'
import {TeamClient,TeamClientError,type ClientOperation} from '@/lib/teams/client'
import {activeNamespace} from '@/lib/security/lock'
import {sealPending,unlockPending,type ContentKind} from '../../../../shared/teams/outbox'
import {readPending,storePending,removePending,type PendingRecord,type OutboxScope} from '@/lib/teams/outbox'

export function useDurableTeamSend({client,kind,disabled,isScoped,canRestore,pendingId,onBusy,onRestore,onResult}:{client:TeamClient;kind:ContentKind;disabled:boolean;isScoped:()=>boolean;canRestore:boolean;pendingId?:string;onBusy:(v:boolean)=>void;onRestore:(op:ClientOperation)=>void;onResult:(op:ClientOperation,rejected:boolean,status?:number)=>void}){
 const [enabled,setEnabled]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[record,setRecord]=useState<PendingRecord>(),[unlocked,setUnlocked]=useState<ClientOperation>(),[consent,setConsent]=useState(false),[notice,setNotice]=useState('Optional encrypted browser outbox. No automatic unlock, reconnect or resend. Browser eviction can still remove data; keep encrypted file backups.')
 const [namespace]=useState(activeNamespace),alive=useRef(true),guard=useRef(isScoped),working=useRef(false);guard.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const current=()=>alive.current&&guard.current()&&activeNamespace()===namespace
 const identity=client.identity(),scope:OutboxScope={namespace,origin:identity.origin,team:identity.team,member:identity.member,kind}
 async function prepare(operation:ClientOperation){
  // Explicit send always checks for a saved head, even if this tab's durable mode
  // is off. Disabling the preference cannot bypass a previously uncertain write.
  const existing=await readPending(scope)
  if(existing)throw new Error('Saved pending operation requires recovery')
  if(!enabled)return
  if(password!==confirm)throw new Error('Confirm the durable-send passphrase')
  let bytes:Uint8Array
  try{bytes=await sealPending(scope,scope.member,operation,password)}finally{if(current()){setPassword('');setConfirm('')}}
  if(!current())throw new Error('Scope changed')
  await storePending(scope,operation.id,bytes)
  if(current()){setRecord({key:'',id:operation.id,bytes});setNotice('Encrypted operation transaction committed before dispatch. Keep the passphrase separately; no credential is stored.')}
 }
 async function settle(operation:ClientOperation){
  try{await removePending(scope,operation.id);if(current()){setRecord(undefined);setUnlocked(undefined);setConsent(false)};return true}
  catch{if(current())setNotice('Host result received, but local outbox cleanup failed. Inspect/recover the saved identity before another send. Never recreate it blindly.');return false}
 }
 async function inspect(){if(disabled||working.current||!current())return;working.current=true;onBusy(true)
  try{const value=await readPending(scope);if(current()){setRecord(value);setUnlocked(undefined);setConsent(false);setNotice(value?'Encrypted pending operation found for this exact host/team/member/lane. Unlock locally; this makes no Team request.':'No saved pending operation for this host/team/member/lane.')}}catch{if(current())setNotice('Outbox could not be read. No operation was dispatched.')}finally{working.current=false;if(current())onBusy(false)}
 }
 async function unlock(){if(disabled||working.current||!record||!current())return;working.current=true;onBusy(true)
  try{const op=await unlockPending(scope,scope.member,kind,record.bytes,password);if(op.id!==record.id)throw new Error('Identity mismatch');if(current()){setUnlocked(op);setConsent(false);setNotice('Operation unlocked locally. Restore its frozen draft before explicitly retrying its exact original identity.')}}catch{if(current())setNotice('Could not unlock saved operation. Check passphrase, scope, file/schema and identity. Saved ciphertext unchanged.')}finally{working.current=false;if(current()){setPassword('');onBusy(false)}}
 }
 async function retry(){if(disabled||working.current||!unlocked||pendingId!==unlocked.id||!consent||!current())return;working.current=true;onBusy(true);setConsent(false)
  try{const saved=await readPending(scope);if(saved?.id!==unlocked.id)throw new Error('Saved head changed');await client.submit(unlocked);await settle(unlocked);if(current()){onResult(unlocked,false);setNotice('Host acknowledged the exact saved identity. No new operation was created; refresh shared state.')}}
  catch(error){if(current()){if(error instanceof TeamClientError&&error.outcome==='rejected'){setNotice('This retry was rejected, but that does not prove the original attempt never committed. Saved identity and frozen draft retained. Refresh to reconcile, reconnect if needed, or export and ask the host to investigate.')}else setNotice('Outcome remains unresolved. Saved identity retained, no automatic retry. Check membership/host, reconnect explicitly and inspect again.')}}
  finally{working.current=false;if(current())onBusy(false)}
 }
 function exportRecord(){if(!record)return;const url=URL.createObjectURL(new Blob([record.bytes as BlobPart],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=kind==='team.board.replace.v1'?'pending-board.reteam-draft':'pending-backchat.reteam-chat-draft';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const panel=<details className="re-teams-card"><summary>Durable {kind==='team.board.replace.v1'?'Board':'BackChat'} send recovery</summary><p role="status">{notice}</p><fieldset disabled={disabled}>
  <label><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);setConsent(false)}}/>Encrypt and save each reviewed operation in this browser before sending. Passphrase needed for every new durable send; enabling does not send anything.</label>
  <label>Outbox passphrase<input className="bui-field" aria-label={kind==='team.board.replace.v1'?'Board outbox passphrase':'BackChat outbox passphrase'} type="password" autoComplete="off" value={password} onChange={e=>{setPassword(e.target.value);setConsent(false)}}/></label>{enabled&&<label>Confirm new-send passphrase<input className="bui-field" aria-label={kind==='team.board.replace.v1'?'Confirm Board outbox passphrase':'Confirm BackChat outbox passphrase'} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}<p>AES-256-GCM / PBKDF2-SHA256 600,000 iterations; strong unique 12–1024 UTF-8-byte passphrase. Only operations are saved, never Team credentials. Exact host/team/member and browser namespace bound. One pending operation per lane; no background delivery.</p>
  <button className="bui-button" onClick={()=>void inspect()}>Inspect saved pending operation</button>
  {record&&<><p>Saved operation {record.id}</p><button className="bui-button" onClick={exportRecord}>Export saved encrypted operation</button><button className="bui-button" disabled={!password} onClick={()=>void unlock()}>Unlock saved operation locally</button></>}
  {unlocked&&<><pre className="re-team-post-text">{JSON.stringify(unlocked,null,2)}</pre><button className="bui-button" disabled={!canRestore} onClick={()=>{onRestore(structuredClone(unlocked));setConsent(false)}}>Restore frozen pending draft</button><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I reviewed this exact saved operation and consent to retry its original identity against this host. It may already have committed.</label><button className="bui-button" disabled={!consent||pendingId!==unlocked.id} onClick={()=>void retry()}>Retry exact saved operation</button></>}
 </fieldset></details>
 return{prepare,settle,panel}
}
