/** Passphrase-wrapped host keys. Not OS-keystore integration or host-blind encryption. */
import { randomBytes, scrypt, createCipheriv, createDecipheriv } from 'node:crypto'
import type { RecoveryKeys } from './recovery'
const kdf = 'scrypt-N32768-r8-p1'
export type UnlockedHostKeys = { team: string; keys: RecoveryKeys }
function teamId(team: string) { if (typeof team !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(team)) throw new Error('Invalid team identity') }
function base64(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string') throw new Error('Invalid keyring encoding')
  const bytes = Buffer.from(value,'base64')
  if (bytes.toString('base64') !== value || (length !== undefined && bytes.length !== length)) throw new Error('Invalid keyring encoding')
  return bytes
}
export function deriveKeyringKey(passphrase: Buffer, salt: Buffer): Promise<Buffer> {
  if (!Buffer.isBuffer(passphrase) || passphrase.length < 12 || passphrase.length > 1024) return Promise.reject(new Error('Passphrase must contain 12–1024 bytes; use a strong unique passphrase'))
  return new Promise((resolve,reject) => scrypt(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key) => error ? reject(error) : resolve(key)))
}
const context = (team: string, salt: string) => Buffer.from(JSON.stringify(['re-teams-host-keys',1,kdf,team,salt]))
export function clearHostKeys(value: UnlockedHostKeys) { Object.values(value.keys).forEach(key => key.fill(0)) }
export async function createHostKeyring(team: string, passphrase: Buffer): Promise<Buffer> {
  teamId(team)
  const salt = randomBytes(16), nonce = randomBytes(12), password = Buffer.from(passphrase)
  let wrapping: Buffer|undefined, plaintext: Buffer|undefined
  try {
    wrapping = await deriveKeyringKey(password,salt)
    // Three independently generated keys; no key or passphrase is written unwrapped.
    plaintext = randomBytes(96)
    const cipher = createCipheriv('aes-256-gcm',wrapping,nonce), saltText = salt.toString('base64')
    cipher.setAAD(context(team,saltText))
    const sealed = Buffer.concat([nonce,cipher.update(plaintext),cipher.final(),cipher.getAuthTag()])
    return Buffer.from(JSON.stringify({version:1,kdf,team,salt:saltText,sealed:sealed.toString('base64')}))
  } finally { password.fill(0); wrapping?.fill(0); plaintext?.fill(0) }
}
export async function unlockHostKeyring(bytes: Buffer, passphrase: Buffer): Promise<UnlockedHostKeys> {
  if (bytes.length > 4096) throw new Error('Invalid keyring size')
  const value = JSON.parse(bytes.toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'kdf,salt,sealed,team,version' || value.version !== 1 || value.kdf !== kdf) throw new Error('Unsupported host keyring format')
  teamId(value.team)
  const salt = base64(value.salt,16), sealed = base64(value.sealed,124), password = Buffer.from(passphrase)
  let wrapping: Buffer|undefined, plaintext: Buffer|undefined
  try {
    wrapping = await deriveKeyringKey(password,salt)
    const cipher = createDecipheriv('aes-256-gcm',wrapping,sealed.subarray(0,12))
    cipher.setAAD(context(value.team,value.salt)); cipher.setAuthTag(sealed.subarray(-16))
    plaintext = Buffer.concat([cipher.update(sealed.subarray(12,-16)),cipher.final()])
    return {team:value.team,keys:{journal:Buffer.from(plaintext.subarray(0,32)),objects:Buffer.from(plaintext.subarray(32,64)),backup:Buffer.from(plaintext.subarray(64,96))}}
  } catch { throw new Error('Could not unlock host keyring: wrong passphrase or damaged file') }
  finally { password.fill(0); wrapping?.fill(0); plaintext?.fill(0) }
}
