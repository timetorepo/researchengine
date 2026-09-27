import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, LockOpen } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { setVaultPassphrase } from '@/lib/crypto/session'
import { decryptWithPassphrase } from '@/lib/crypto/vault'

/**
 * Global vault unlock prompt. Shown whenever an encrypted API key is needed
 * but the in-memory passphrase is missing (e.g. after a reload) — instead of
 * silently calling providers without a key (which reads as 403 Forbidden).
 */
export function VaultUnlock() {
  const open = useUI((s) => s.vaultPrompt)
  const ui = useUI()
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    useUI.setState({ vaultPrompt: false })
    setPass('')
    setErr('')
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
      setVaultPassphrase(pass)
      ui.toast('Vault unlocked', 'Encrypted keys are available for this session.', 'success')
      close()
    } catch {
      setErr('Wrong passphrase — the key did not decrypt.')
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
                <Lock size={16} strokeWidth={1.8} />
              </span>
              <div>
                <div className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Unlock your key vault</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Your API keys are encrypted on this device.</div>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
              Enter your vault passphrase to use encrypted provider keys this session.
            </p>
            <input
              autoFocus type="password" value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') unlock() }}
              placeholder="Passphrase"
              className="w-full px-3 py-2 rounded-[11px] outline-none text-[13px] mb-2"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
            />
            {err && <div className="text-[11.5px] mb-2" style={{ color: 'var(--danger)' }}>{err}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={close} className="px-3.5 py-1.5 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Not now
              </button>
              <button onClick={unlock} disabled={busy || !pass}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <LockOpen size={12} /> Unlock
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
