// API keys encrypted with Web Crypto (AES-GCM), key derived via PBKDF2
// from a user-defined passphrase. Without a passphrase, keys stay in local
// storage and the app warns clearly.

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s)
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

const SALT_KEY = 're.vault.salt'

function getSalt(): Uint8Array {
  let s = localStorage.getItem(SALT_KEY)
  if (!s) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    localStorage.setItem(SALT_KEY, b64(salt))
    return salt
  }
  return unb64(s)
}

export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: getSalt() as BufferSource, iterations: 150_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptWithPassphrase(plain: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plain))
  return `enc:${b64(iv)}:${b64(ct)}`
}

export async function decryptWithPassphrase(payload: string, passphrase: string): Promise<string> {
  const [, ivB64, ctB64] = payload.split(':')
  const key = await deriveKey(passphrase)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) as BufferSource },
    key,
    unb64(ctB64) as BufferSource,
  )
  return dec.decode(pt)
}

/** Resolve a possibly-encrypted key value. */
export async function resolveKey(stored: string, passphrase: string | null): Promise<string> {
  if (!stored) return ''
  if (!stored.startsWith('enc:')) return stored
  if (!passphrase) return ''
  try {
    return await decryptWithPassphrase(stored, passphrase)
  } catch {
    return ''
  }
}
