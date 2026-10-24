/**
 * The authenticator lock for the API key vault.
 *
 * With it on, unlocking the vault takes two things: the vault passphrase, and
 * a 6-digit code from an authenticator app. The TOTP secret is kept only
 * encrypted with the vault passphrase, so the code cannot be checked without
 * the passphrase, and the passphrase is never kept in plain text.
 *
 * What this does not do: it cannot stop someone who has the device, the
 * passphrase and the unlocked app. The secret lives on this device, so the
 * code is a second step in the app, not a key held somewhere else. The README
 * says the same.
 */
import { useStore } from '@/stores/useStore'
import { decryptWithPassphrase, encryptWithPassphrase } from '@/lib/crypto/vault'
import { verifyTotp } from '@/lib/security/totp'

export function authenticatorOn(): boolean {
  return !!useStore.getState().settings.apiKeyAuth?.enabled
}

/** Read the TOTP secret. Throws if the passphrase is wrong. */
export async function readAuthenticatorSecret(passphrase: string): Promise<string> {
  const stored = useStore.getState().settings.apiKeyAuth?.secretEnc
  if (!stored) throw new Error('No authenticator is set up.')
  return decryptWithPassphrase(stored, passphrase)
}

/** Check a passphrase against the encrypted provider keys, when there are any. */
export async function passphraseMatchesKeys(passphrase: string): Promise<boolean> {
  const providers = useStore.getState().settings.providers ?? {}
  const encKey = Object.values(providers).find((p) => p?.apiKey?.startsWith('enc:'))?.apiKey
  if (!encKey) return true
  try {
    await decryptWithPassphrase(encKey, passphrase)
    return true
  } catch {
    return false
  }
}

/** Save a newly confirmed secret, encrypted with the passphrase. */
export async function enableAuthenticator(secret: string, passphrase: string): Promise<void> {
  const secretEnc = await encryptWithPassphrase(secret, passphrase)
  useStore.setState((s) => ({
    settings: {
      ...s.settings,
      apiKeyAuth: { enabled: true, secretEnc, enrolledAt: new Date().toISOString() },
    },
  }))
}

export function disableAuthenticator(): void {
  useStore.setState((s) => ({ settings: { ...s.settings, apiKeyAuth: undefined } }))
}

/**
 * The code check used by the unlock prompt and by turning the lock off. Returns
 * true only when the passphrase opens the secret and the code matches it.
 */
export async function checkSecondFactor(passphrase: string, code: string): Promise<boolean> {
  try {
    const secret = await readAuthenticatorSecret(passphrase)
    return await verifyTotp(secret, code)
  } catch {
    return false
  }
}
