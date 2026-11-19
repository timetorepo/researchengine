/** Owner-only encrypted credential delivery artifact; never print its decrypted contents. */
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import { deriveKeyringKey } from './keyring'
import type { HostSession } from './host'
const context=(team:string,salt:string)=>Buffer.from(JSON.stringify(['re-teams-owner-credential',1,team,salt]))
function validate(team:string,value:HostSession){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(team)||!value||typeof value.credential!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.credential)||Buffer.from(value.credential,'base64url').toString('base64url')!==value.credential||createHash('sha256').update(team+'\0'+value.credential).digest('hex')!==value.digest||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<0||!value.receipt||!Number.isSafeInteger(value.receipt.sequence)||value.receipt.sequence<1||!/^[a-f0-9]{64}$/.test(value.receipt.digest))throw new Error('Invalid Owner credential artifact')
}
export async function sealOwnerCredential(team:string,session:HostSession,passphrase:Buffer):Promise<Buffer>{
 validate(team,session)
 const salt=randomBytes(16).toString('base64'),nonce=randomBytes(12),password=Buffer.from(passphrase),plaintext=Buffer.from(JSON.stringify(session));let key:Buffer|undefined
 try{
  key=await deriveKeyringKey(password,Buffer.from(salt,'base64'))
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(context(team,salt))
  return Buffer.from(JSON.stringify({version:1,kdf:'scrypt-N32768-r8-p1',team,salt,sealed:Buffer.concat([nonce,cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]).toString('base64')}))
 }finally{password.fill(0);plaintext.fill(0);key?.fill(0)}
}
export async function unlockOwnerCredential(bytes:Buffer,passphrase:Buffer,team:string):Promise<HostSession>{
 if(bytes.length>4096)throw new Error('Invalid credential artifact size')
 const value=JSON.parse(bytes.toString('utf8'))
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='kdf,salt,sealed,team,version'||value.version!==1||value.kdf!=='scrypt-N32768-r8-p1'||value.team!==team||typeof value.salt!=='string'||typeof value.sealed!=='string')throw new Error('Unsupported credential artifact')
 const salt=Buffer.from(value.salt,'base64'),sealed=Buffer.from(value.sealed,'base64'),password=Buffer.from(passphrase);let key:Buffer|undefined,plaintext:Buffer|undefined
 try{
  if(salt.length!==16||salt.toString('base64')!==value.salt||sealed.length<28||sealed.toString('base64')!==value.sealed)throw new Error('Invalid credential artifact encoding')
  key=await deriveKeyringKey(password,salt)
  const cipher=createDecipheriv('aes-256-gcm',key,sealed.subarray(0,12));cipher.setAAD(context(team,value.salt));cipher.setAuthTag(sealed.subarray(-16))
  plaintext=Buffer.concat([cipher.update(sealed.subarray(12,-16)),cipher.final()]);const session=JSON.parse(plaintext.toString('utf8')) as HostSession
  validate(team,session);return session
 }catch{throw new Error('Could not unlock Owner credential artifact')}
 finally{password.fill(0);key?.fill(0);plaintext?.fill(0)}
}
