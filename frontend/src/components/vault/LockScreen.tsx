import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, Delete, Loader2, ShieldAlert, LogOut } from 'lucide-react'
import CodeSlots from '@/components/ui/reactbits/micro/CodeSlots'
import {
  roleForPin, writeLockSession, wipeEverything, removeLockConfig,
  normalisePin, type LockRole,
} from '@/lib/security/lock'

/**
 * The code screen.
 *
 * Three things can happen when a code is typed, and only one of them is
 * visible: the app opens. The other two look identical from the outside.
 *
 *   your code   the app opens on your data
 *   guest code  the app opens on an empty Research Engine with none of your
 *               data in it, and whatever they make is kept apart
 *   duress code the app opens on an empty Research Engine, because everything
 *               was deleted first
 *
 * The duress path is the reason this screen never says which codes exist. A
 * lock that tells you "wrong code" three times and then behaves differently on
 * the fourth is a lock that can be mapped out by whoever is holding the device.
 * So every wrong code costs the same and says the same thing, and the wipe
 * happens before anything is drawn.
 */
export function LockScreen() {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  /** Set while the duress wipe runs, so the screen never shows the app. */
  const [wiping, setWiping] = useState(false)
  const [wiped, setWiped] = useState<string | null>(null)

  const submit = async (code: string) => {
    const value = normalisePin(code)
    if (!value || busy) return
    setBusy(true)
    setErr('')
    let role: LockRole | null = null
    try {
      role = await roleForPin(value)
    } catch {
      setErr('This device cannot check the code. Open the app over https or on localhost.')
      setBusy(false)
      return
    }

    if (role === 'duress') {
      // Delete first, render nothing. The person holding the device sees the
      // screen below, which is what a fresh install looks like.
      setWiping(true)
      try {
        const report = await wipeEverything()
        removeLockConfig()
        setWiped(report.note)
      } catch {
        setWiped('Local data was deleted. The server-side store could not be reached, so remove its data folder by hand.')
      }
      // A reload is what makes it real: the store re-hydrates from empty
      // storage and onboarding runs, with no code configured.
      window.setTimeout(() => window.location.reload(), 1400)
      return
    }

    if (role === 'main' || role === 'guest') {
      writeLockSession(role)
      // Reload so the store hydrates from the right namespace before anything
      // reads it. A role change is rare; a stale namespace is not recoverable.
      window.setTimeout(() => window.location.reload(), 60)
      return
    }

    setErr('That code does not open Research Engine.')
    setPin('')
    setBusy(false)
  }

  const press = (d: string) => {
    if (busy) return
    setErr('')
    setPin((p) => (p.length >= 12 ? p : p + d))
  }
  const back = () => { if (!busy) { setErr(''); setPin((p) => p.slice(0, -1)) } }

  if (wiped) {
    return (
      <div className="fixed inset-0 z-[95] grid place-items-center px-6" style={{ background: 'var(--bg)' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <span className="w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
            <ShieldAlert size={20} strokeWidth={1.6} />
          </span>
          <div className="text-[15px] font-semibold mb-1.5">Research Engine is empty</div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{wiped}</p>
        </motion.div>
      </div>
    )
  }

  if (wiping) {
    return (
      <div className="fixed inset-0 z-[95] grid place-items-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <Loader2 size={22} className="animate-spin mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <div className="text-[13px]" style={{ color: 'var(--text-3)' }}>Opening Research Engine</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center px-6" style={{ background: 'var(--bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-[340px]"
      >
        <div className="flex flex-col items-center mb-6">
          <span className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-3.5"
            style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
            <Lock size={20} strokeWidth={1.8} />
          </span>
          <div className="text-[17px] font-semibold" style={{ letterSpacing: '-0.02em' }}>Research Engine is locked</div>
          <div className="text-[12.5px] mt-1 text-center" style={{ color: 'var(--text-3)' }}>
            Enter your code to continue.
          </div>
        </div>

        {/* React Bits Code Slots is the code input. Digits are masked, so the
            screen shows how long the code is and never what is in it. The
            length follows what has been typed (6 slots minimum, 12 at most),
            and the keypad below writes into the same value. */}
        <div className="flex justify-center mb-5" onKeyDown={(e) => { if (e.key === 'Enter') void submit(pin) }}>
          <CodeSlots
            length={Math.min(12, Math.max(6, pin.length))}
            value={pin}
            mask
            caret={!busy}
            disabled={busy}
            autoFocus
            status={err ? 'error' : 'idle'}
            onChange={(v) => { setErr(''); setPin(v.slice(0, 12)) }}
            accentColor="var(--primary)"
            inkColor="var(--text-1)"
            slotColor="var(--surface)"
            digitColor="var(--bg)"
            dangerColor="var(--danger)"
            slotSize={34}
            gap={6}
            radius={9}
            ariaLabel="Access code"
          />
        </div>

        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[12px] text-center mb-3" style={{ color: 'var(--danger)' }}
              role="alert"
            >
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => void submit(pin)}
          disabled={busy || !pin}
          className="w-full py-2.5 rounded-full text-[13px] font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={13} />}
          Unlock
        </button>

        {/* A keypad, because the code is short and typed on a phone as often as
            a keyboard. It is the only way in when there is no physical one. */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={busy}
              className="py-3 rounded-[12px] text-[16px] font-medium disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
              {d}
            </button>
          ))}
          <button onClick={back} disabled={busy || !pin}
            className="py-3 rounded-[12px] flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
            aria-label="Delete last character">
            <Delete size={16} />
          </button>
          <button onClick={() => press('0')} disabled={busy}
            className="py-3 rounded-[12px] text-[16px] font-medium disabled:opacity-40"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
            0
          </button>
          <button onClick={() => void submit(pin)} disabled={busy || !pin}
            className="py-3 rounded-[12px] flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }} aria-label="Unlock">
            <LogOut size={15} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>

        <p className="text-[11px] text-center mt-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Codes are checked on this device. Nothing is sent anywhere.
        </p>
      </motion.div>
    </div>
  )
}
