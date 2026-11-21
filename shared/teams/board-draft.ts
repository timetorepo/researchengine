/** Explicit encrypted-file custody using platform Web Crypto. No storage/network
 * side effects. This versioned browser format is NOT the Node scrypt artifact. */
import type { TeamEndpoint } from './client'
import {validateSharedBoardItems,type TeamBoard} from './board'
export type BoardDraftFile={board:TeamBoard;member:string;operationId?:string}
const format = 're-teams-encrypted-board-draft'
const kdf = 'PBKDF2-SHA256-600000'
const enc = new TextEncoder()
function fail(): never { throw new Error('Could not unlock Board draft. Check file, passphrase, exact host/team and member.') }
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
export function inspectBoardDraft(bytes: Uint8Array): TeamEndpoint {
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
function validate(value:unknown):BoardDraftFile{
 const v=value as BoardDraftFile
 const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
 if(!v||Array.isArray(v)||Object.keys(v).sort().join(',')!==('operationId'in v?'board,member,operationId':'board,member')||!id(v.member)||('operationId'in v&&!id(v.operationId)))fail()
 const b=v.board
 if(!b||Object.keys(b).sort().join(',')!=='id,items,revision,title'||!id(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0||b.revision>=Number.MAX_SAFE_INTEGER||typeof b.title!=='string')fail()
 validateSharedBoardItems(b.items)
 if(enc.encode(JSON.stringify(b)).length>64000)fail()
 return structuredClone(v)
}
export async function sealBoardDraft(scope:TeamEndpoint,value:BoardDraftFile,password:string):Promise<Uint8Array>{
 scope=destination(scope);const clean=validate(value),plaintext=enc.encode(JSON.stringify(clean))
 try{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),envelope={format,version:1,kdf,...scope,salt:b64(salt),iv:b64(iv)}
  const wrapping=await key(password,salt),sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(envelope),tagLength:128},wrapping,plaintext)
  return enc.encode(JSON.stringify({...envelope,sealed:b64(new Uint8Array(sealed))}))
 }finally{plaintext.fill(0)}
}
export async function unlockBoardDraft(bytes:Uint8Array,password:string,expected:TeamEndpoint,member:string):Promise<BoardDraftFile>{
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
