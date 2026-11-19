import { newBoard, validateBoard, type BoardDocument, type BoardAttachment } from './storage'
import { prepareBoardAttachment } from './attachments'

// Uncompressed container: eight-byte magic, uint32 BE manifest length, UTF-8 JSON, raw originals.
// No archive paths, executable content, decompression or base64 expansion.
const MAGIC = 'REBOARD1'
const check = (signal?:AbortSignal) => { if(signal?.aborted) throw new DOMException('Backup cancelled','AbortError') }
const hash = async(blob:Blob,signal?:AbortSignal) => { check(signal);const bytes=await blob.arrayBuffer();check(signal);const digest=await crypto.subtle.digest('SHA-256',bytes);check(signal);return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('') }
type Entry = {id:string;name:string;size:number;sha256:string}
type Manifest = {format:'research-engine-board';version:1;document:BoardDocument;attachments:Entry[]}
export async function exportBoardBackup(document:BoardDocument, load:(id:string)=>Promise<BoardAttachment|undefined>,signal?:AbortSignal):Promise<Blob> {
  validateBoard(document)
  const files:Blob[]=[], entries:Entry[]=[]
  for(const id of new Set(document.items.flatMap(item=>item.attachmentId?[item.attachmentId]:[]))) {
    check(signal);const file=await load(id);if(!file)throw new Error('A linked original is missing. Backup was not created.')
    entries.push({id,name:file.name,size:file.blob.size,sha256:await hash(file.blob,signal)});files.push(file.blob)
  }
  const manifest:Manifest={format:'research-engine-board',version:1,document,attachments:entries}
  const json=new TextEncoder().encode(JSON.stringify(manifest));if(json.length>0xffffffff)throw new Error('Backup manifest exceeds the format limit.')
  const prefix=new Uint8Array(12);prefix.set(new TextEncoder().encode(MAGIC));new DataView(prefix.buffer).setUint32(8,json.length)
  check(signal);return new Blob([prefix,json,...files],{type:'application/octet-stream'})
}
/** Fully validate before returning a fresh identity; caller atomically saves with expectedRevision 0. */
export async function importBoardBackup(file:Blob,signal?:AbortSignal):Promise<{document:BoardDocument;attachments:BoardAttachment[]}> {
  check(signal)
  const prefix=new Uint8Array(await file.slice(0,12).arrayBuffer());check(signal)
  if(prefix.length!==12||new TextDecoder().decode(prefix.slice(0,8))!==MAGIC)throw new Error('Not a supported Board backup. Choose a .reboard file, not draft JSON.')
  const length=new DataView(prefix.buffer).getUint32(8);let offset=12+length
  if(offset>file.size)throw new Error('Truncated Board backup manifest.')
  const raw:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.slice(12,offset).arrayBuffer()));check(signal)
  if(!raw||typeof raw!=='object')throw new Error('Invalid Board backup manifest.')
  const manifest=raw as Manifest
  if(manifest.format!=='research-engine-board'||manifest.version!==1||!Array.isArray(manifest.attachments))throw new Error('Unsupported Board backup version.')
  validateBoard(manifest.document)
  const ids=new Set<string>(), needed=new Set(manifest.document.items.flatMap(item=>item.attachmentId?[item.attachmentId]:[]))
  // Check all lengths before reading payloads, without trusting names as paths or MIME types.
  for(const entry of manifest.attachments) {
    if(!entry||typeof entry.id!=='string'||!needed.has(entry.id)||ids.has(entry.id)||typeof entry.name!=='string'||!Number.isSafeInteger(entry.size)||entry.size<=0||typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256))throw new Error('Invalid or duplicate backup attachment.')
    ids.add(entry.id);offset+=entry.size;if(!Number.isSafeInteger(offset)||offset>file.size)throw new Error('Truncated Board backup original.')
  }
  if(ids.size!==needed.size||offset!==file.size)throw new Error('Backup has missing originals or unexpected trailing bytes.')
  offset=12+length
  const attachments:BoardAttachment[]=[], remap=new Map<string,{id:string;kind:'image'|'pdf';pages?:number}>()
  for(const entry of manifest.attachments) {
    check(signal);const blob=file.slice(offset,offset+entry.size);offset+=entry.size
    if(await hash(blob,signal)!==entry.sha256)throw new Error(`Original integrity check failed: ${entry.name}`)
    const prepared=await prepareBoardAttachment(new File([blob],entry.name),signal)
    attachments.push(prepared.attachment);remap.set(entry.id,{id:prepared.attachment.id,kind:prepared.kind,pages:prepared.pages})
  }
  const document:BoardDocument={...manifest.document,...newBoard(manifest.document.title),items:manifest.document.items,viewport:manifest.document.viewport}
  const itemIds=new Map(document.items.map(item=>[item.id,crypto.randomUUID()]))
  document.items=document.items.map(item=>{
    const original=item.attachmentId?remap.get(item.attachmentId):undefined
    if(original&&(original.kind!==item.kind||(item.source?.page!==undefined&&(original.kind!=='pdf'||item.source.page>(original.pages??0)))))throw new Error('Backup card kind or PDF page does not match its original.')
    return {...item,id:itemIds.get(item.id)!,attachmentId:original?.id,parentId:item.parentId?itemIds.get(item.parentId):undefined,fromId:item.fromId?itemIds.get(item.fromId):undefined,toId:item.toId?itemIds.get(item.toId):undefined}
  })
  validateBoard(document);check(signal);return {document,attachments}
}
