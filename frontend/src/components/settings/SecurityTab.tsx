import React, { useState } from 'react'
import { ShieldCheck, ShieldAlert, Trash2, Download, Loader2, Eye, EyeOff, Lock } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import {
  readLockConfig, writeLockConfig, removeLockConfig, armedRoles, normalisePin,
  pinProblem, pinWarning, readLockSession, clearLockSession, MIN_PIN_LENGTH,
  type LockRole,
} from '@/lib/security/lock'
import { download } from '@/lib/utils'

/**
 * Settings for the startup lock.
 *
 * Three codes, and the tab says plainly what each one does, including the
 * destructive one. The duress code is the only thing in this app that deletes
 * data without asking first, so setting it is gated behind a typed
 * confirmation and a hold: a lock that can be misconfigured into a landmine is
 * worse than no lock.
 *
 * The guest section also carries the export, because "their data is downloadable
 * by you" is a promise this tab has to be able to keep.
 */
export function SecurityTab() {
  const ui = useUI()
  const [config, setConfig] = useState(() => readLockConfig())
  const roles = armedRoles(config)
  const session = readLockSession()

  const [main, setMain] = useState('')
  const [duress, setDuress] = useState('')
  const [guest, setGuest] = useState('')
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  /** Arming the duress code is two steps: acknowledge, then choose the code. */
  const [armStep, setArmStep] = useState<'off' | 'confirm' | 'code'>('off')
  const [armText, setArmText] = useState('')

  const armed = roles.includes('main')

  const save = async () => {
    // Only the codes that were actually typed are sent. A blank field means
    // "leave that code alone", not "delete it", so a guest code can be added
    // without retyping the main one.
    const codes: Partial<Record<LockRole, string>> = {}
    if (main) codes.main = normalisePin(main)
    if (guest) codes.guest = normalisePin(guest)
    if (duress) codes.duress = normalisePin(duress)
    setBusy(true)
    try {
      const next = await writeLockConfig(codes)
      setConfig(next)
      setMain(''); setDuress(''); setGuest('')
      setArmStep('off'); setArmText('')
      ui.toast(
        armed ? 'Codes saved' : 'Lock turned on',
        armed ? 'The codes take effect the next time the app opens.' : 'Research Engine now asks for a code at startup.',
        'success',
      )
    } catch {
      ui.toast('Could not save', 'This device cannot derive a code. Open the app over https or on localhost.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const disable = () => {
    removeLockConfig()
    setConfig(null)
    ui.toast('Lock removed', 'Research Engine opens without a code.', 'warning')
  }

  const problem = (v: string) => (v ? pinProblem(v) : null)
  const warn = (v: string) => (v ? pinWarning(v) : null)
  const canSave = !!main || !!duress || !!guest

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <ShieldCheck size={20} style={{ color: 'var(--primary)' }} /> Security
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Put a code in front of Research Engine. Everything in the app is on this device, so the code is checked
        here too and never sent anywhere.
      </p>

      {session?.role === 'guest' && (
        <div className="surface p-4 mb-4" style={{ borderColor: 'var(--warning)' }}>
          <div className="text-[12.5px] font-medium mb-1">You are in a guest session</div>
          <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
            Nothing here belongs to the owner, and nothing you make is visible to them.
          </div>
          <button onClick={() => { clearLockSession(); window.location.reload() }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Lock size={13} /> Leave the guest session
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------ your code */}
      <section className="surface p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
            <Lock size={15} strokeWidth={1.7} />
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-medium">Your code</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              Opens Research Engine on everything you have. Leave blank to keep the code you already set.
            </div>
          </div>
        </div>
        <CodeField
          label="Your code"
          value={main}
          onChange={setMain}
          show={!!show.main}
          onToggleShow={() => setShow((s) => ({ ...s, main: !s.main }))}
          problem={problem(main)}
          warning={warn(main)}
        />
      </section>

      {/* -------------------------------------------------------------- guest */}
      <section className="surface p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <ShieldCheck size={15} strokeWidth={1.7} />
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-medium">Unprioritized user code</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              Hands the app to somebody else. They get a working Research Engine with none of your data in it,
              and what they create is kept apart from yours.
            </div>
          </div>
        </div>
        <CodeField
          label="Guest code"
          value={guest}
          onChange={setGuest}
          show={!!show.guest}
          onToggleShow={() => setShow((s) => ({ ...s, guest: !s.guest }))}
          problem={problem(guest)}
          warning={warn(guest)}
        />
        {roles.includes('guest') && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const raw = localStorage.getItem('re.data.guest:research-engine-v1')
                if (!raw) { ui.toast('Nothing to download yet', 'A guest has not created anything in this session.', 'info'); return }
                download('guest-session.json', raw, 'application/json')
                ui.toast('Downloaded', 'The guest session was saved as JSON.', 'success')
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <Download size={13} /> Download what the guest made
            </button>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              Only you can read this. A guest cannot see your data either way.
            </span>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- duress */}
      <section className="surface p-4 mb-4" style={roles.includes('duress') ? { borderColor: 'var(--danger)' } : undefined}>
        <div className="flex items-start gap-3 mb-3">
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'var(--elevated)', color: 'var(--danger)' }}>
            <ShieldAlert size={15} strokeWidth={1.7} />
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-medium">Duress code</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              The code you type when someone is making you unlock. It deletes every chat, article, citation,
              document, key and setting on this device, then opens Research Engine looking brand new.
            </div>
          </div>
        </div>

        {!roles.includes('duress') ? (
          armStep === 'off' ? (
            <button onClick={() => setArmStep('confirm')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <ShieldAlert size={13} /> Set a duress code
            </button>
          ) : armStep === 'confirm' ? (
            <div>
              <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
                Type <b>I understand</b> to go on. There is no undo and no backup: the deletion covers this
                browser's storage and the server-side store on this machine.
              </p>
              <input
                value={armText}
                onChange={(e) => setArmText(e.target.value)}
                placeholder="I understand"
                className="w-full px-3 py-2 rounded-[11px] outline-none text-[13px] mb-2"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
              />
              <div className="flex gap-2">
                <button
                  disabled={armText.trim().toLowerCase() !== 'i understand'}
                  onClick={() => setArmStep('code')}
                  className="px-3.5 py-2 rounded-[11px] text-[12.5px] font-medium disabled:opacity-40"
                  style={{ background: 'var(--danger)', color: '#fff' }}>
                  Continue
                </button>
                <button onClick={() => { setArmStep('off'); setArmText('') }}
                  className="px-3.5 py-2 rounded-[11px] text-[12.5px]"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <CodeField
                label="Duress code"
                value={duress}
                onChange={setDuress}
                show={!!show.duress}
                onToggleShow={() => setShow((s) => ({ ...s, duress: !s.duress }))}
                problem={problem(duress)}
                warning={warn(duress)}
              />
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
                Save it below to arm it. Until then nothing is deleted.
              </p>
            </div>
          )
        ) : (
          <div>
            <div className="text-[12px] mb-3" style={{ color: 'var(--danger)' }}>
              A duress code is armed. Typing it deletes everything, immediately and without asking.
            </div>
            <button
              onClick={() => {
                const next = { ...(config as any), hashes: { ...(config as any).hashes, duress: null }, duressArmed: false }
                localStorage.setItem('re.lock.config', JSON.stringify(next))
                setConfig(next as any)
                ui.toast('Duress code removed', 'The other codes still work.', 'warning')
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <Trash2 size={13} /> Remove the duress code
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void save()} disabled={busy || !canSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {armed ? 'Save codes' : 'Turn the lock on'}
        </button>
        {armed && (
          <button onClick={disable}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Trash2 size={15} /> Turn the lock off
          </button>
        )}
      </div>

      <div className="mt-5 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
        <p className="mb-1.5">
          A code is never stored. Only a derived key is kept, so a copy of this browser's storage does not hand
          over the codes themselves. Codes are at least {MIN_PIN_LENGTH} characters and can be anything you can type.
        </p>
        <p>
          This protects the app from someone who picks up the device. It does not protect against someone who
          already has your code, and it is not encryption of your data at rest.
        </p>
      </div>
    </div>
  )
}

function CodeField({ label, value, onChange, show, onToggleShow, problem, warning }: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  problem: string | null
  warning: string | null
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</label>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PIN_LENGTH} characters`}
          className="flex-1 px-3 py-2 rounded-[11px] outline-none text-[13px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
        />
        <button onClick={onToggleShow} className="px-3 rounded-[11px]" title={show ? 'Hide' : 'Show'}
          style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {problem && <div className="text-[11px] mt-1.5" style={{ color: 'var(--danger)' }}>{problem}</div>}
      {!problem && warning && <div className="text-[11px] mt-1.5" style={{ color: 'var(--warning)' }}>{warning}</div>}
    </div>
  )
}
