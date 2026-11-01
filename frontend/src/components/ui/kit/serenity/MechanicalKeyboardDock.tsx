// The floating keyboard panel shown when Settings → Appearance → "3D keyboard"
// is on. Pick Fixed or Custom perspective; Custom exposes tilt and turn sliders.
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react'
import { MechanicalKeyboard, type Perspective } from './MechanicalKeyboard'

export const KEYBOARD_PREF = 'kb3d.enabled'
export const KEYBOARD_PERSPECTIVE = 'kb3d.perspective'
/** Dispatched on window whenever the keyboard settings change, so every surface stays in step. */
export const KEYBOARD_EVENT = 'kb3d-change'

function readEnabled(): boolean {
  try { return localStorage.getItem(KEYBOARD_PREF) === '1' } catch { return false }
}
function readPerspective(): Perspective {
  try { return (localStorage.getItem(KEYBOARD_PERSPECTIVE) as Perspective) || 'fixed' } catch { return 'fixed' }
}

export function MechanicalKeyboardDock() {
  const [enabled, setEnabled] = useState(readEnabled)
  const [perspective, setPerspective] = useState<Perspective>(readPerspective)
  const [tilt, setTilt] = useState(0.6)
  const [rotation, setRotation] = useState(0)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const sync = () => { setEnabled(readEnabled()); setPerspective(readPerspective()) }
    window.addEventListener(KEYBOARD_EVENT, sync)
    return () => window.removeEventListener(KEYBOARD_EVENT, sync)
  }, [])

  if (!enabled) return null

  const choose = (p: Perspective) => {
    setPerspective(p)
    try { localStorage.setItem(KEYBOARD_PERSPECTIVE, p) } catch { /* ignore */ }
    window.dispatchEvent(new Event(KEYBOARD_EVENT))
  }

  return (
    <section aria-label="3D keyboard" className="fixed bottom-3 left-3 z-40 w-[360px] max-w-[calc(100vw-24px)] rounded-[16px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.5)' }}>
      <header className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
        <Keyboard size={13} aria-hidden style={{ color: 'var(--primary)' }} />
        <span className="font-medium" style={{ color: 'var(--text)' }}>Keyboard</span>
        <div role="group" aria-label="Perspective" className="ml-auto flex rounded-[8px] p-0.5" style={{ background: 'var(--elevated)' }}>
          {(['fixed', 'custom'] as const).map((p) => (
            <button key={p} type="button" aria-pressed={perspective === p} onClick={() => choose(p)}
              className="px-2 py-0.5 rounded-[6px] text-[11px]"
              style={{ background: perspective === p ? 'var(--surface)' : 'transparent', color: perspective === p ? 'var(--text)' : 'var(--text-3)' }}>{p === 'fixed' ? 'Fixed (top)' : 'Custom'}</button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse keyboard' : 'Expand keyboard'} aria-expanded={open}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
        </button>
      </header>
      {open && (
        <>
          <MechanicalKeyboard perspective={perspective} tilt={tilt} rotation={rotation} height={170} />
          {perspective === 'custom' && (
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 text-[11px]" style={{ color: 'var(--text-2)' }}>
              <label className="flex flex-col gap-1">Tilt
                <input type="range" min={0} max={1.4} step={0.02} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">Turn
                <input type="range" min={-0.6} max={0.6} step={0.02} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
              </label>
            </div>
          )}
        </>
      )}
    </section>
  )
}
