// The vault passphrase lives in memory only — never persisted.
let passphrase: string | null = null
export const setVaultPassphrase = (p: string | null) => { passphrase = p }
export const getVaultPassphrase = () => passphrase
