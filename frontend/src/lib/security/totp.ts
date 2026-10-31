/**
 * Time-based one-time passwords (RFC 6238) for the API key lock.
 *
 * Works with any authenticator app that reads the standard `otpauth://` URI:
 * Google Authenticator, Stratum, Aegis, 1Password, Bitwarden and the rest.
 * SHA-1, 6 digits, 30 seconds, which is what those apps expect by default.
 * HMAC runs through Web Crypto, so no third-party code sits in the path.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const TOTP_DIGITS = 6
export const TOTP_PERIOD = 30

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx < 0) throw new Error('Not a valid key: use the letters A–Z and digits 2–7.')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

/** A fresh 160-bit secret, as base32 (the form authenticator apps take). */
export function newTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)))
}

/** The key grouped in fours, so it can be typed in by hand. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ')
}

export function otpauthUri(secret: string, account: string, issuer = 'ResearchEngine'): string {
  const label = encodeURIComponent(`${issuer}:${account || 'researcher'}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

async function hmacCode(keyBytes: Uint8Array, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new Uint8Array(8)
  // 64-bit big-endian counter. JS numbers are exact well past any real time value.
  let c = counter
  for (let i = 7; i >= 0; i--) {
    msg[i] = c % 256
    c = Math.floor(c / 256)
  }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const offset = mac[mac.length - 1] & 0x0f
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff)
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

/** The code the app expects at `timeMs` (defaults to now). */
export async function totpCode(secret: string, timeMs = Date.now()): Promise<string> {
  const counter = Math.floor(timeMs / 1000 / TOTP_PERIOD)
  return hmacCode(base32Decode(secret), counter)
}

/**
 * Check a typed code. One step either side of now is accepted, so a phone
 * whose clock is 30 seconds off still works.
 */
export async function verifyTotp(secret: string, input: string, timeMs = Date.now()): Promise<boolean> {
  const code = input.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return false
  const key = base32Decode(secret)
  const counter = Math.floor(timeMs / 1000 / TOTP_PERIOD)
  for (const step of [-1, 0, 1]) {
    if ((await hmacCode(key, counter + step)) === code) return true
  }
  return false
}
