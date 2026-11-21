/** Explicit encrypted-file custody using platform Web Crypto. No storage/network
 * side effects. This versioned browser format is NOT the Node scrypt artifact. */
import {validateSharedLinks,type SharedLink} from './backchat'
import type { TeamEndpoint } from './client'
export type BackChatDraftFile={text:string;threadId:string;member:string;links?:SharedLink[];attachments?:string[];pending?:{operationId:string;postId:string}}
const format = 're-teams-encrypted-backchat-draft'
const kdf = 'PBKDF2-SHA256-600000'
const enc = new TextEncoder()
function fail(): never { throw new Error('Could not unlock BackChat draft. Check file, passphrase, exact host/team and member.') }
function destination(value: TeamEndpoint) {
  const url = new URL(value.origin)
  if (url.protocol !== 'https:' || url.origin !== value.origin || url.username || url.password || !/^[A-Za-z0-9_-]{1,128}$/.test(value.team)) throw new Error('Use one canonical HTTPS origin and a valid team ID.')
  return { origin: value.origin, team: value.team }
}
function b64(bytes: Uint8Array) { return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) }
function unb64(value: unknown, size?: number) {
  if (typeof value !== 'string') fail()
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))
  if (b64(bytes) !== value || (size !== undefined && bytes.length !== size)) fail()
  return bytes
}
type Envelope = TeamEndpoint & { format: string; version: number; kdf: string; salt: string; iv: string; sealed: string }
function inspect(bytes: Uint8Array): Envelope {
  // Fixed draft schema budget, not an attachment/upload size policy.
  if (bytes.byteLength > 100000) fail()
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!value || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'format,iv,kdf,origin,salt,sealed,team,version' || value.format !== format || value.version !== 1 || value.kdf !== kdf) fail()
  destination(value); unb64(value.salt, 16); unb64(value.iv, 12)
  const sealed = unb64(value.sealed)
  if (sealed.length < 17 || sealed.length > 66000) fail()
  return value
}
/** Unauthenticated file metadata for review only; never establishes host trust. */
export function inspectBackChatDraft(bytes: Uint8Array): TeamEndpoint {
  try { const value = inspect(bytes); return { origin: value.origin, team: value.team } } catch { return fail() }
}
const aad = (value: Omit<Envelope, 'sealed'>) => enc.encode(JSON.stringify([format, 1, kdf, value.origin, value.team, value.salt, value.iv]))
async function key(password: string, salt: Uint8Array) {
  const bytes = enc.encode(password)
  try {
    if (bytes.length < 12 || bytes.length > 1024) throw new Error('Use a strong unique passphrase of 12–1024 UTF-8 bytes.')
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey'])
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  } finally { bytes.fill(0) }
}
function validate(value:unknown):BackChatDraftFile{
 const v=value as BackChatDraftFile
 const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==['member','text','threadId',...('pending'in v?['pending']:[]),...('links'in v?['links']:[]),...('attachments'in v?['attachments']:[])].sort().join(',')||!id(v.member)||!id(v.threadId)||typeof v.text!=='string'||enc.encode(v.text).length>16000)fail()
 if('links'in v)validateSharedLinks(v.links)
 if('attachments'in v&&(!Array.isArray(v.attachments)||v.attachments.length>8||v.attachments.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)||id==='0'.repeat(64))||new Set(v.attachments).size!==v.attachments.length))fail()
 if('pending'in v&&(!v.pending||Object.keys(v.pending).sort().join(',')!=='operationId,postId'||!id(v.pending.operationId)||!id(v.pending.postId)||!v.text.trim()))fail()
 return structuredClone(v)
}
export async function sealBackChatDraft(scope:TeamEndpoint,value:BackChatDraftFile,password:string):Promise<Uint8Array>{
 scope=destination(scope);const clean=validate(value),plaintext=enc.encode(JSON.stringify(clean))
 try{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),envelope={format,version:1,kdf,...scope,salt:b64(salt),iv:b64(iv)}
  const wrapping=await key(password,salt),sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(envelope),tagLength:128},wrapping,plaintext)
  return enc.encode(JSON.stringify({...envelope,sealed:b64(new Uint8Array(sealed))}))
 }finally{plaintext.fill(0)}
}
export async function unlockBackChatDraft(bytes:Uint8Array,password:string,expected:TeamEndpoint,member:string):Promise<BackChatDraftFile>{
 let plaintext:Uint8Array|undefined
 try{
  expected=destination(expected);const value=inspect(bytes)
  if(value.origin!==expected.origin||value.team!==expected.team)fail()
  const wrapping=await key(password,unb64(value.salt,16))
  plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(value.iv,12) as BufferSource,additionalData:aad(value),tagLength:128},wrapping,unb64(value.sealed) as BufferSource))
  const restored=validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext)))
  if(restored.member!==member)fail()
  return restored
 }catch{return fail()}finally{plaintext?.fill(0)}
}
