/** Explicit local encrypted client custody. No networking, file IO, or automatic persistence. */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { deriveKeyringKey } from './keyring'
import { TeamClient } from '../../../shared/teams/client'
import type { ClientSession, TeamEndpoint, ClientOptions } from '../../../shared/teams/client'
const validEndpoint=(endpoint:TeamEndpoint)=>{const url=new URL(endpoint.origin);if(url.protocol!=='https:'||url.origin!==endpoint.origin||! /^[A-Za-z0-9_-]{1,128}$/.test(endpoint.team))throw new Error('Invalid client destination')}
const aad=(endpoint:TeamEndpoint,salt:string)=>Buffer.from(JSON.stringify(['re-teams-client-credential',1,endpoint.origin,endpoint.team,salt]))
const checkOptions:ClientOptions={native:true,timeoutMs:1000,responseBytes:4096}
export async function sealClientCredential(endpoint:TeamEndpoint,session:ClientSession,passphrase:Buffer):Promise<Buffer>{
 validEndpoint(endpoint);const checked=await TeamClient.fromSession(endpoint,session,checkOptions);checked.disconnect()
 const password=Buffer.from(passphrase),salt=randomBytes(16).toString('base64'),nonce=randomBytes(12),plaintext=Buffer.from(JSON.stringify(session));let key:Buffer|undefined
 try{key=await deriveKeyringKey(password,Buffer.from(salt,'base64'));const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad(endpoint,salt));return Buffer.from(JSON.stringify({version:1,kdf:'scrypt-N32768-r8-p1',...endpoint,salt,sealed:Buffer.concat([nonce,cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]).toString('base64')}))}
 finally{password.fill(0);plaintext.fill(0);key?.fill(0)}
}
export async function unlockClientCredential(bytes:Buffer,passphrase:Buffer,expected:TeamEndpoint,config:ClientOptions):Promise<TeamClient>{
 let password:Buffer|undefined,key:Buffer|undefined,plaintext:Buffer|undefined
 try{
  validEndpoint(expected);if(bytes.length>8192)throw new Error()
  const value=JSON.parse(bytes.toString('utf8'))
  if(!value||Object.keys(value).sort().join(',')!=='kdf,origin,salt,sealed,team,version'||value.version!==1||value.kdf!=='scrypt-N32768-r8-p1'||value.origin!==expected.origin||value.team!==expected.team||typeof value.salt!=='string'||typeof value.sealed!=='string')throw new Error()
  const salt=Buffer.from(value.salt,'base64'),sealed=Buffer.from(value.sealed,'base64')
  if(salt.length!==16||salt.toString('base64')!==value.salt||sealed.length<28||sealed.toString('base64')!==value.sealed)throw new Error()
  password=Buffer.from(passphrase);key=await deriveKeyringKey(password,salt)
  const cipher=createDecipheriv('aes-256-gcm',key,sealed.subarray(0,12));cipher.setAAD(aad(expected,value.salt));cipher.setAuthTag(sealed.subarray(-16))
  plaintext=Buffer.concat([cipher.update(sealed.subarray(12,-16)),cipher.final()]);return await TeamClient.fromSession(expected,JSON.parse(plaintext.toString('utf8')),config)
 }catch{throw new Error('Could not unlock client credential artifact')}
 finally{password?.fill(0);key?.fill(0);plaintext?.fill(0)}
}
/** Owner artifact identity is verified by a host state read before use; no member supplied by the importer. */
export async function importOwnerClient(bytes:Buffer,passphrase:Buffer,endpoint:TeamEndpoint,config:ClientOptions,signal?:AbortSignal):Promise<TeamClient>{
 validEndpoint(endpoint)
 const {unlockOwnerCredential}=await import('./credential')
 const session=await unlockOwnerCredential(bytes,passphrase,endpoint.team)
 // The trusted HTTPS host resolves the actor. Never guess or embed an Owner member name.
 const { resolveClientSession }=await import('../../../shared/teams/client')
 return resolveClientSession(endpoint,session,config,signal)
}
