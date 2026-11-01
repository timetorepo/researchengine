import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, Copy, Lock, Trash2, Loader2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { getVaultPassphrase, setVaultPassphrase } from '@/lib/crypto/session'
import {
  checkSecondFactor, disableAuthenticator, enableAuthenticator, passphraseMatchesKeys,
} from '@/lib/security/apiKeyAuth'
import { formatSecret, newTotpSecret, otpauthUri, totpCode, verifyTotp } from '@/lib/security/totp'
import { OtpCode } from '@/components/ui/heroui/OtpCode'
import { saveNotice, warnNotice } from '@/stores/useNotices'

/**
 * Lock the API key vault behind an authenticator app.
 *
 * Turning it on: the passphrase is checked, a secret is made, and a QR code
 * plus the same secret typed out by hand are shown. The code must be entered
 * once before the lock is saved, so a wrong setup cannot lock the user out.
 * Turning it off needs the passphrase and a current code.
 */
export function AuthenticatorSection() {
  const ui = useUI()
  const settings = useStore((s) => s.settings)
  const on = !!settings.apiKeyAuth?.enabled
  const [mode, setMode] = useState<'idle' | 'setup' | 'off'>('idle')
  const [pass, setPass] = useState('')
  const [secret, setSecret] = useState('')
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const reset = () => { setMode('idle'); setPass(''); setSecret(''); setQr(''); setCode(''); setErr('') }

  const startSetup = async () => {
    setErr('')
    if (!pass) return setErr('Type your vault passphrase first.')
    if (!(await passphraseMatchesKeys(pass))) return setErr('That passphrase does not open your saved keys.')
    const s = newTotpSecret()
    const uri = otpauthUri(s, 'researcher')
    try {
      setQr(await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: '#000000', light: '#ffffff' } }))
    } catch {
      setQr('')
    }
    setSecret(s)
    setMode('setup')
  }

  const confirmSetup = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!(await verifyTotp(secret, code))) {
        setErr('That code does not match yet. Check the time on your phone, then type the code shown now.')
        return
      }
      await enableAuthenticator(secret, pass)
      setVaultPassphrase(pass)
      saveNotice('Authenticator on', 'Unlocking the key vault now needs a code from your app.')
      reset()
    } catch {
      setErr('The lock could not be saved. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!(await checkSecondFactor(pass, code))) {
        setErr('Passphrase or code not right.')
        return
      }
      disableAuthenticator()
      warnNotice('Authenticator off', 'The key vault opens with the passphrase again.')
      reset()
    } finally {
      setBusy(false)
    }
  }

  const lockNow = () => {
    setVaultPassphrase(null)
    ui.toast('Keys locked', 'The next time a provider needs a key, the vault asks again.', 'info')
  }

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      ui.toast('Copied', 'The setup key is on the clipboard.', 'success')
    } catch {
      ui.toast('Could not copy', 'Select the key and copy it by hand.', 'warning')
    }
  }

  // The preview code in setup, so the user can see that the key works.
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (mode !== 'setup' || !secret) return
    let alive = true
    const tick = async () => { const c = await totpCode(secret); if (alive) setPreview(c) }
    void tick()
    const t = window.setInterval(tick, 1000)
    return () => { alive = false; window.clearInterval(t) }
  }, [mode, secret])

  const hasPassphrase = settings.passphraseSet || !!getVaultPassphrase()

  return (
    <section className="surface p-4 mb-4" aria-labelledby="auth-lock-title">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: 'var(--elevated)', color: on ? 'var(--success)' : 'var(--primary)' }}>
          <ShieldCheck size={15} strokeWidth={1.7} />
        </span>
        <div className="flex-1">
          <div id="auth-lock-title" className="text-[13px] font-medium flex items-center gap-2">
            Authenticator for API keys
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: on ? 'var(--success)' : 'var(--elevated)', color: on ? '#fff' : 'var(--text-3)' }}>
              {on ? 'On' : 'Off'}
            </span>
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            Unlocking the key vault takes your passphrase and a 6-digit code from an authenticator app such as
            Google Authenticator, Stratum, Aegis or 1Password.
          </div>
        </div>
      </div>

      {!hasPassphrase && !on && (
        <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
          Set a vault passphrase first (Settings → Providers). The authenticator protects the encrypted keys, so it
          needs a passphrase to protect.
        </p>
      )}

      {mode === 'idle' && on && (
        <div className="flex flex-wrap gap-2">
          <button onClick={lockNow}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Lock size={13} /> Lock keys now
          </button>
          <button onClick={() => setMode('off')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Trash2 size={13} /> Turn off
          </button>
        </div>
      )}

      {mode === 'setup' && (
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] items-start">
          <div className="flex flex-col items-center gap-2">
            {qr ? (
              <img src={qr} alt="QR code: scan it with your authenticator app" width={220} height={220}
                className="rounded-[10px] bg-white p-2" />
            ) : (
              <div className="w-[220px] h-[220px] rounded-[10px] flex items-center justify-center text-[11px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>QR code unavailable</div>
            )}
            <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Scan with your app</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] mb-1" style={{ color: 'var(--text-3)' }}>
              Can't scan? Add an account by hand and type this key. Type it as shown, spaces do not matter.
            </div>
            <div className="flex items-center gap-2 mb-3">
              <code data-testid="totp-secret" className="flex-1 px-2.5 py-2 rounded-[10px] text-[12.5px] tracking-[0.12em] break-all"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                {formatSecret(secret)}
              </code>
              <button onClick={() => void copyKey()} title="Copy the key" aria-label="Copy the key"
                className="p-2 rounded-[10px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                <Copy size={13} />
              </button>
            </div>
            <div className="text-[11px] mb-1.5" style={{ color: 'var(--text-3)' }}>
              Type the 6-digit code your app shows now (it currently reads {preview || '······'}).
            </div>
            <div className="mb-2"><OtpCode value={code} onChange={setCode} label="Authenticator code" /></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void confirmSetup()} disabled={busy || code.length !== 6}
                className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Turn the lock on
              </button>
              <button onClick={reset} className="px-3.5 py-2 rounded-[11px] text-[12.5px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'off' && (
        <div className="grid gap-2 max-w-[360px]">
          <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
            placeholder="Vault passphrase" aria-label="Vault passphrase" autoComplete="current-password"
            className="px-3 py-2 rounded-[11px] outline-none text-[13px]"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
          <div className="mb-2"><OtpCode value={code} onChange={setCode} label="Current authenticator code" /></div>
          <label className="text-[11px] flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} /> Show passphrase
          </label>
          <div className="flex gap-2">
            <button onClick={() => void turnOff()} disabled={busy || !pass || code.length !== 6}
              className="px-3.5 py-2 rounded-[11px] text-[12.5px] font-medium disabled:opacity-40"
              style={{ background: 'var(--danger)', color: '#fff' }}>Turn the lock off</button>
            <button onClick={reset} className="px-3.5 py-2 rounded-[11px] text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Cancel</button>
          </div>
        </div>
      )}

      {err && <div className="text-[11.5px] mt-2" style={{ color: 'var(--danger)' }}>{err}</div>}

      {mode === 'idle' && !on && hasPassphrase && (
        <div className="grid gap-2 max-w-[360px]">
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password"
            placeholder="Vault passphrase" aria-label="Vault passphrase"
            className="px-3 py-2 rounded-[11px] outline-none text-[13px]"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
          <button onClick={() => void startSetup()} disabled={!pass}
            className="self-start px-3.5 py-2 rounded-[11px] text-[12.5px] font-medium disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}>Show the QR code</button>
        </div>
      )}
    </section>
  )
}
