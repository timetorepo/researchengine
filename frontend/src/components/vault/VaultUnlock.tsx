import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { setVaultPassphrase } from '@/lib/crypto/session'
import { decryptWithPassphrase } from '@/lib/crypto/vault'
import { authenticatorOn, readAuthenticatorSecret } from '@/lib/security/apiKeyAuth'
import { verifyTotp } from '@/lib/security/totp'
import { OtpCode } from '@/components/ui/heroui/OtpCode'

/** After this many wrong codes, the code box waits before it tries again. */
const CODE_TRIES = 5
const COOLDOWN_S = 30

/**
 * Global vault unlock prompt. Shown whenever an encrypted API key is needed
 * but the in-memory passphrase is missing (e.g. after a reload). With the
 * authenticator lock on, a second step asks for the 6-digit code, and the
 * passphrase is only kept once both are right.
 */
export function VaultUnlock() {
  const open = useUI((s) => s.vaultPrompt)
  const ui = useUI()
  const [pass, setPass] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'passphrase' | 'code'>('passphrase')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [misses, setMisses] = useState(0)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  const close = () => {
    useUI.setState({ vaultPrompt: false })
    setPass('')
    setCode('')
    setErr('')
    setStep('passphrase')
    setMisses(0)
  }

  const finish = (p: string) => {
    setVaultPassphrase(p)
    ui.toast('Vault unlocked', 'Encrypted keys are available for this session.', 'success')
    close()
  }

  const unlock = async () => {
    if (!pass) return
    setBusy(true)
    setErr('')
    // Verify against the first encrypted key we can find.
    const providers = useStore.getState().settings.providers ?? {}
    const encKey = Object.values(providers).find((p) => p?.apiKey?.startsWith('enc:'))?.apiKey
    try {
      if (encKey) await decryptWithPassphrase(encKey, pass)
      if (authenticatorOn()) {
        // Reading the secret proves the passphrase too.
        await readAuthenticatorSecret(pass)
        setStep('code')
        return
      }
      finish(pass)
    } catch {
      setErr('Wrong passphrase — the key did not decrypt.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async () => {
    if (wait > 0 || busy) return
    setBusy(true)
    setErr('')
    try {
      const secret = await readAuthenticatorSecret(pass)
      if (await verifyTotp(secret, code)) {
        finish(pass)
        return
      }
      const n = misses + 1
      setMisses(n)
      setCode('')
      if (n >= CODE_TRIES) {
        setWait(COOLDOWN_S)
        setMisses(0)
        setErr(`Too many wrong codes. Wait ${COOLDOWN_S} seconds.`)
      } else {
        setErr('That code is not right. Codes change every 30 seconds, so check your authenticator app.')
      }
    } catch {
      setErr('The authenticator could not be read. Start again with your passphrase.')
      setStep('passphrase')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70]" style={{ background: 'var(--scrim)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            role="dialog" aria-label="Unlock key vault"
            className="fixed left-1/2 top-1/2 z-[71] w-[min(92vw,380px)] p-5 rounded-[18px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 24px 80px -24px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-9 h-9 rounded-[11px] flex items-center justify-center" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
                {step === 'code' ? <ShieldCheck size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
              </span>
              <div>
                <div className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Unlock your key vault</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  {step === 'code' ? 'Second step: your authenticator app' : 'Your API keys are encrypted on this device.'}
                </div>
              </div>
            </div>

            {step === 'passphrase' ? (
              <>
                <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                  Enter your vault passphrase to use encrypted provider keys this session.
                </p>
                <input
                  autoFocus type="password" value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void unlock() }}
                  placeholder="Passphrase" aria-label="Vault passphrase"
                  className="w-full px-3 py-2 rounded-[11px] outline-none text-[13px] mb-2"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                />
              </>
            ) : (
              <>
                <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                  Type the 6-digit code from your authenticator app for ResearchEngine.
                </p>
                <div className="mb-2" onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) void submitCode() }}>
                  <OtpCode value={code} onChange={setCode} label="Authenticator code" autoFocus disabled={wait > 0} />
                </div>
                {wait > 0 && <div className="text-[11.5px] mb-2" style={{ color: 'var(--text-3)' }}>Try again in {wait}s.</div>}
              </>
            )}

            {err && <div className="text-[11.5px] mb-2" style={{ color: 'var(--danger)' }}>{err}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={close} className="px-3.5 py-1.5 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Not now
              </button>
              {step === 'passphrase' ? (
                <button onClick={() => void unlock()} disabled={busy || !pass}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  <LockOpen size={12} /> {authenticatorOn() ? 'Continue' : 'Unlock'}
                </button>
              ) : (
                <button onClick={() => void submitCode()} disabled={busy || code.length !== 6 || wait > 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  <LockOpen size={12} /> Unlock
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
