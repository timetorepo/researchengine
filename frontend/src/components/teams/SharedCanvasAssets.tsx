import {useEffect,useRef,useState} from 'react'
import type {TeamClient} from '@/lib/teams/client'
import type {TeamItem} from '../../../../shared/teams/board'
import {prepareBoardAttachment} from '@/lib/board/attachments'
import {PDFPreview} from '../board/AttachmentPreview'

export function SharedCanvasAssetUpload({client,disabled,isScoped,onBusy,onImported}:{client:TeamClient;disabled:boolean;isScoped:()=>boolean;onBusy:(v:boolean)=>void;onImported:(item:TeamItem,blob:Blob)=>void}){
 const [file,setFile]=useState<File>(),[consent,setConsent]=useState(false),[notice,setNotice]=useState('PDF, PNG, JPEG or WebP; max 1 MiB (host may allow less). File bytes go to the trusted host only after consent. Publishing the Board is a separate reviewed action.')
 const alive=useRef(true),active=useRef<AbortController|undefined>(undefined),scope=useRef(isScoped);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 async function upload(){if(disabled||active.current||!file||!consent||!scope.current())return
  const abort=new AbortController();active.current=abort;onBusy(true);setConsent(false)
  try{
   const prepared=await prepareBoardAttachment(file,abort.signal),bytes=new Uint8Array(await prepared.attachment.blob.arrayBuffer())
   if(!alive.current||!scope.current()||abort.signal.aborted)return
   const attachmentId=await client.uploadAttachment(bytes,abort.signal)
   if(!alive.current||!scope.current()||abort.signal.aborted)return
   onImported({id:crypto.randomUUID(),kind:prepared.kind,text:file.name,x:40,y:40,width:300,height:240,attachmentId,...(prepared.kind==='pdf'?{source:{page:1}}:{})},prepared.attachment.blob)
   setFile(undefined);setNotice('Original uploaded; a canvas item was added to this local draft. Review its filename/title and content before separately publishing. Other members cannot fetch a new unreferenced object until publication.')
  }catch{if(alive.current&&scope.current())setNotice('Import failed: unsupported/damaged file, cancelled decoding, host limit, permissions or lost upload response. Draft unchanged. Bytes may already be on the host; no automatic retry.')}
  finally{active.current=undefined;if(alive.current&&scope.current())onBusy(false)}
 }
 return <fieldset disabled={disabled}><legend>Import shared image or PDF</legend><p role="status">{notice}</p><label>Original file<input type="file" aria-label="Shared canvas original file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{const next=e.target.files?.[0];e.target.value='';setConsent(false);if(next&&next.size>0&&next.size<=1048576)setFile(next);else{setFile(undefined);setNotice('Choose a nonempty original of at most 1 MiB. Nothing uploaded.')}}}/></label>{file&&<p>{file.name} · {file.size} bytes</p>}<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I reviewed this original and consent to upload its bytes to this Team host. Its filename will become editable draft text.</label><button className="bui-button" disabled={!file||!consent} onClick={()=>void upload()}>Upload original into canvas draft</button></fieldset>
}

export function SharedCanvasAssetPreview({client,item,localBlob,isScoped,disabled,onPage}:{client:TeamClient;item:TeamItem;localBlob?:Blob;isScoped:()=>boolean;disabled:boolean;onPage:(page:number)=>void}){
 const [blob,setBlob]=useState<Blob>(),[url,setURL]=useState(''),[notice,setNotice]=useState('Preview is opt-in. No automatic remote fetch or document rendering.'),[busy,setBusy]=useState(false)
 const alive=useRef(true),active=useRef<AbortController|undefined>(undefined),scope=useRef(isScoped);scope.current=isScoped
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 useEffect(()=>{if(!blob)return;const value=URL.createObjectURL(blob);setURL(value);return()=>URL.revokeObjectURL(value)},[blob])
 async function load(){if(active.current||!item.attachmentId||!scope.current())return
  const abort=new AbortController();active.current=abort;setBusy(true)
  try{
   const bytes=localBlob??new Blob([await client.downloadAttachment(item.attachmentId,abort.signal) as BlobPart])
   if(!alive.current||!scope.current()||abort.signal.aborted)return
   const prepared=await prepareBoardAttachment(new File([bytes],'shared-original.bin'),abort.signal)
   if(prepared.kind!==item.kind)throw new Error('Wrong kind')
   if(!alive.current||!scope.current()||abort.signal.aborted)return
   setBlob(prepared.attachment.blob);setNotice('Validated original loaded for local preview. No OCR, model request, HTML frame or PDF scripting. Downloaded originals remain untrusted files.')
  }catch{if(alive.current&&scope.current())setNotice('Preview refused or unavailable. Check published reference, permissions, file type and size limits. Unpublished originals can only use this tab’s uploaded copy. No retry.')}
  finally{active.current=undefined;if(alive.current&&scope.current())setBusy(false)}
 }
 return <section className="re-board-attachment" aria-label="Shared original preview"><p role="status">{notice}</p><button className="bui-button" disabled={busy} onClick={()=>void load()}>Load selected shared original preview</button>{blob&&<>
  {item.kind==='image'?<img className="re-shared-original" src={url} alt={item.text||'Shared image original'} onError={()=>setNotice('Image could not render. No fallback or execution.')}/>:<PDFPreview disabled={disabled} blob={blob} page={item.source?.page??1} onPage={page=>{if(!disabled)onPage(page)}}/>}
  <a href={url} download={item.kind==='pdf'?'shared-original.pdf':'shared-original-image.bin'}>Download validated shared original</a>
  {disabled&&<p>Read-only: linked PDF page changes are disabled.</p>}
 </>}</section>
}
