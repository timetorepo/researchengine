import {useEffect,useRef,useState} from 'react'
import {inspectBoardDraft,sealBoardDraft,unlockBoardDraft,type BoardDraftFile} from '../../../../shared/teams/board-draft'
import type {TeamEndpoint} from '@/lib/teams/client'

export function BoardDraftRecovery({destination,member,draft,blocked,isScoped,onBusy,onRestore}:{destination:TeamEndpoint;member:string;draft?:BoardDraftFile;blocked:boolean;isScoped:()=>boolean;onBusy:(busy:boolean)=>void;onRestore:(value:BoardDraftFile)=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[file,setFile]=useState<Uint8Array>(),[consent,setConsent]=useState(false),[notice,setNotice]=useState('Encrypted draft files contain Board text and any unresolved operation identity, never session credentials.'),[working,setWorking]=useState(false)
 const alive=useRef(true),scope=useRef(isScoped),lock=useRef(false);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const current=()=>alive.current&&scope.current()
 async function readFile(selected?:File){
  if(!selected||blocked||draft||lock.current||!current())return
  lock.current=true;setWorking(true);onBusy(true);setFile(undefined);setConsent(false);setPassword('');setConfirm('')
  try{if(selected.size>100000)throw new Error();const bytes=new Uint8Array(await selected.arrayBuffer()),metadata=inspectBoardDraft(bytes);if(metadata.origin!==destination.origin||metadata.team!==destination.team)throw new Error();if(current()){setFile(bytes);setNotice('File destination matches this connection, but metadata is unauthenticated until unlock. Review host/team/member below. No network request was made.')}}
  catch{if(current())setNotice('Draft file refused: unsupported, damaged, too large or for another host/team. Existing work was not changed.')}
  finally{lock.current=false;if(current()){setWorking(false);onBusy(false)}}
 }
 async function run(action:'export'|'import'){
  if(blocked||lock.current||!current()||!password||(action==='export'?(!draft||password!==confirm):(!file||!consent||!!draft)))return
  lock.current=true;setWorking(true);onBusy(true)
  try{
   if(action==='export'){
    const bytes=await sealBoardDraft(destination,draft!,password);if(!current())return
    const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='shared-board.reteam-draft';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Encrypted draft download requested. Verify it was saved and test restore before discarding work. The passphrase is not included.')
   }else{
    const value=await unlockBoardDraft(file!,password,destination,member);if(!current())return
    onRestore(value);setFile(undefined);setConsent(false);setNotice('Draft restored locally. Nothing was published. Load shared Boards to check the expected revision; unresolved operations remain frozen until reconciliation.')
   }
  }catch{if(current())setNotice('Encrypted draft action failed. Check file, passphrase, member, destination and size. Nothing was published or overwritten.')}
  finally{lock.current=false;if(current()){setWorking(false);onBusy(false);setPassword('');setConfirm('')}}
 }
 return <details className="re-teams-card"><summary>Encrypted Board draft recovery</summary><p role="status">{notice}</p><p>Host: {destination.origin} · Team: {destination.team} · Member: {member}. AES-256-GCM, PBKDF2-SHA256 (600,000 iterations); use a strong unique 12–1024 UTF-8-byte passphrase kept separately. No browser storage or automatic restore. Files do not grant Team access or prove a send committed.</p>
  <fieldset disabled={blocked||working}><legend>Explicit encrypted file custody</legend>
   {!draft&&<label>Import encrypted Board draft<input type="file" aria-label="Import encrypted Board draft" accept=".reteam-draft,application/json" onChange={e=>{const selected=e.target.files?.[0];e.target.value='';void readFile(selected)}}/></label>}
   <label>Draft file passphrase<input className="bui-field" aria-label="Draft file passphrase" type="password" autoComplete="off" value={password} onChange={e=>{setPassword(e.target.value);setConsent(false)}}/></label>
   {draft?<><label>Confirm draft file passphrase<input className="bui-field" aria-label="Confirm draft file passphrase" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="bui-button" disabled={!password||password!==confirm} onClick={()=>void run('export')}>Export encrypted Board draft</button></>:file&&<><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I verified this host, team and member and want to restore this draft locally, not publish it.</label><button className="bui-button" disabled={!password||!consent} onClick={()=>void run('import')}>Unlock and restore Board draft</button><button className="bui-button" onClick={()=>{setFile(undefined);setPassword('');setConsent(false)}}>Discard imported draft file</button></>}
  </fieldset>
 </details>
}
