import {useEffect,useRef,useState} from 'react'
import type {TeamClient} from '@/lib/teams/client'
export function TeamAttachmentUpload({client,disabled,isScoped,onBusy,onUploaded}:{client:TeamClient;disabled:boolean;isScoped:()=>boolean;onBusy:(value:boolean)=>void;onUploaded:(id:string)=>void}){
 const [file,setFile]=useState<File>(),[consent,setConsent]=useState(false),[notice,setNotice]=useState('Upload stores bytes on the trusted host; posting a reference is a separate reviewed action. Max 1 MiB per file; host may impose a lower limit.')
 const alive=useRef(true),active=useRef<AbortController|undefined>(undefined),scope=useRef(isScoped);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 async function upload(){
  if(disabled||active.current||!file||!consent||!scope.current())return
  const abort=new AbortController();active.current=abort;onBusy(true);setConsent(false)
  try{const bytes=new Uint8Array(await file.arrayBuffer());if(abort.signal.aborted||!alive.current||!scope.current())return;const id=await client.uploadAttachment(bytes,abort.signal);if(alive.current&&scope.current()){onUploaded(id);setFile(undefined);setNotice('File uploaded. Review the attachment ID and post text before sending. No post was created.')}}
  catch{if(alive.current&&scope.current())setNotice('Upload failed or response was lost. Bytes may already be stored on the host. No post was created or automatically retried.')}
  finally{active.current=undefined;if(alive.current&&scope.current())onBusy(false)}
 }
 return <fieldset disabled={disabled}><legend>Upload a shared attachment</legend><p role="status">{notice}</p><label>Choose file<input type="file" aria-label="BackChat attachment file" onChange={e=>{const next=e.target.files?.[0];e.target.value='';setConsent(false);if(next&&next.size>0&&next.size<=1048576)setFile(next);else{setFile(undefined);setNotice('Choose a nonempty file of at most 1 MiB. Nothing uploaded.')}}}/></label>{file&&<p>{file.name} · {file.size} bytes</p>}<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I reviewed this file and consent to upload its contents to this Team host.</label><button className="bui-button" disabled={!file||!consent} onClick={()=>void upload()}>Upload reviewed attachment</button></fieldset>
}
export function TeamAttachmentDownload({client,id,isScoped}:{client:TeamClient;id:string;isScoped:()=>boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),alive=useRef(true),active=useRef<AbortController|undefined>(undefined),scope=useRef(isScoped);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 async function download(){if(active.current||!scope.current())return;const abort=new AbortController();active.current=abort;setBusy(true)
  try{const bytes=await client.downloadAttachment(id,abort.signal);if(!alive.current||!scope.current()||abort.signal.aborted)return;const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download='team-attachment-'+id.slice(0,12)+'.bin';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Download requested, not proof of saving. Untrusted file: inspect before opening; no automatic preview or execution.')}
  catch{if(alive.current&&scope.current())setNotice('Download failed. Check membership, referenced attachment and host/client size limits. No retry.')}
  finally{active.current=undefined;if(alive.current&&scope.current())setBusy(false)}
 }
 return <div><button className="bui-button" disabled={busy} onClick={()=>void download()}>Download attachment {id.slice(0,12)}</button><p role="status">{notice}</p></div>
}
