import { getVaultPassphrase } from '@/lib/crypto/session'
import { resolveKey } from '@/lib/crypto/vault'
import { useUI } from '@/stores/useUI'

/**
 * Return a usable plaintext API key. Encrypted keys are decrypted with the
 * in-memory vault passphrase; if the vault is locked (e.g. after a reload)
 * the global unlock prompt opens and this throws, so callers abort cleanly
 * instead of calling providers with a missing/garbage key (the classic
 * "403 Forbidden" from NVIDIA NIM et al.).
 */
export async function usableKey(stored: string | undefined): Promise<string> {
  const raw = stored ?? ''
  if (!raw) return ''
  if (!raw.startsWith('enc:')) return raw
  const pass = getVaultPassphrase()
  if (!pass) {
    useUI.setState({ vaultPrompt: true })
    throw new Error('Your API key is encrypted and the vault is locked. Unlock it to use this provider.')
  }
  const key = await resolveKey(raw, pass)
  if (!key) {
    useUI.setState({ vaultPrompt: true })
    throw new Error('The API key could not be decrypted. Unlock the vault with your passphrase.')
  }
  return key
}
