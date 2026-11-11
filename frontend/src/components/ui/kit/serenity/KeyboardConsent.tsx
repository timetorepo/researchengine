// The disclaimer shown the first time someone turns the 3D keyboard on. It stays
// free of three.js on purpose: it is opened from Settings and the dock alike.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, ShieldCheck } from 'lucide-react'

interface Props {
  onAgree: () => void
  onCancel: () => void
}

export function KeyboardConsentDialog({ onAgree, onCancel }: Props) {
  const [checked, setChecked] = useState(false)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'var(--scrim, rgba(0,0,0,0.5))' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="kb-consent-title" aria-describedby="kb-consent-body"
        className="w-full max-w-[460px] rounded-[18px] p-5 text-[13px] leading-relaxed"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard size={16} aria-hidden style={{ color: 'var(--primary)' }} />
          <h2 id="kb-consent-title" className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Turn on the 3D keyboard?</h2>
        </div>

        <div id="kb-consent-body" className="flex flex-col gap-2.5">
          <p>The 3D keyboard shows the keys you press. To do that, it listens for key presses <strong style={{ color: 'var(--text)' }}>while it is on</strong>.</p>
          <p className="flex gap-2">
            <ShieldCheck size={15} aria-hidden className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
            <span><strong style={{ color: 'var(--text)' }}>Research Engine does not eavesdrop on keys outside the 3D keyboard.</strong> With the 3D keyboard toggle off, the app does not listen to your keys at all.</span>
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>It moves the matching key in the picture and plays a click. That is all it does with a key.</li>
            <li>It does not record, store or send what you type, anywhere.</li>
            <li>Key presses in password fields are ignored.</li>
            <li>Keystroke capture is regulated in some places, including California. That is why this stays off until you agree, and you can turn it off at any time in Settings → Appearance.</li>
          </ul>
        </div>

        <label className="flex items-start gap-2.5 mt-4 p-3 rounded-[12px] cursor-pointer" style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
          <input ref={first} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
          <span>I understand. Research Engine listens to keys only while the 3D keyboard is on, and does not listen to keys outside it.</span>
        </label>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-[10px] text-[12.5px]" style={{ color: 'var(--text-2)', background: 'var(--elevated)' }}>Cancel</button>
          <button type="button" onClick={onAgree} disabled={!checked}
            className="px-3.5 py-1.5 rounded-[10px] text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--primary)', color: '#fff' }}>Turn on keyboard</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
