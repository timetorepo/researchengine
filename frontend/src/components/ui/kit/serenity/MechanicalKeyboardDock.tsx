// The floating keyboard panel, shown when Settings → Appearance → "3D keyboard" is on.
//
// • Drag the header to put it anywhere on screen. The spot is remembered.
// • Fixed (top): a view from above, no orbit. Custom: drag the scene to any angle.
// • It listens to keys only while it is on AND the person has agreed to the
//   disclaimer (KeyboardConsent.tsx). Nothing mounts before that.
import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react'
import {
  KEYBOARD_EVENT, KEYBOARD_PERSPECTIVE,
  grantKeyboardConsent, keyboardListening, readKeyboardConsent, setKeyboardEnabled,
  readKeyboardEnabled as readEnabled, readKeyboardPerspective as readPerspective, type Perspective,
} from './keyboardPrefs'
import { KeyboardConsentDialog } from './KeyboardConsent'

// The 3D scene is its own chunk. It loads the first time the keyboard is shown, so a
// person who never turns it on never downloads three.js.
const SerenityKeyboard = lazy(() => import('./SerenityKeyboard').then((m) => ({ default: m.MechanicalKeyboard })))

export { KEYBOARD_EVENT, KEYBOARD_PERSPECTIVE, KEYBOARD_PREF } from './keyboardPrefs'

const POSITION = 'kb3d.position'
const WIDTH = 360
const SCENE_HEIGHT = 220

type Pos = { x: number; y: number }

function readPosition(): Pos | null {
  try {
    const v = JSON.parse(localStorage.getItem(POSITION) || 'null')
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null
  } catch { return null }
}

/** Keeps the panel on screen: the header always stays reachable. */
function clamp(p: Pos, height: number): Pos {
  const maxX = Math.max(0, window.innerWidth - WIDTH)
  const maxY = Math.max(0, window.innerHeight - 40)
  return { x: Math.min(Math.max(0, p.x), maxX), y: Math.min(Math.max(0, p.y), Math.max(0, maxY - height + 40)) }
}

export function MechanicalKeyboardDock() {
  const [enabled, setEnabled] = useState(readEnabled)
  const [perspective, setPerspective] = useState<Perspective>(readPerspective)
  const [open, setOpen] = useState(true)
  const [pos, setPos] = useState<Pos>(() => readPosition() ?? { x: 12, y: Math.max(12, window.innerHeight - SCENE_HEIGHT - 80) })
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null)
  const panel = useRef<HTMLElement>(null)
  // A keyboard turned on before the disclaimer existed has no consent on record. Ask
  // before it listens to anything; declining switches it off again.
  const [askConsent, setAskConsent] = useState(() => readEnabled() && !readKeyboardConsent())

  useEffect(() => {
    const sync = () => {
      setEnabled(readEnabled()); setPerspective(readPerspective())
      if (readEnabled() && !readKeyboardConsent()) setAskConsent(true)
    }
    window.addEventListener(KEYBOARD_EVENT, sync)
    const resize = () => setPos((p) => clamp(p, panel.current?.offsetHeight ?? 0))
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener(KEYBOARD_EVENT, sync)
      window.removeEventListener('resize', resize)
    }
  }, [])

  if (askConsent && enabled) {
    return (
      <KeyboardConsentDialog
        onAgree={() => { grantKeyboardConsent(); setAskConsent(false); setKeyboardEnabled(true) }}
        onCancel={() => { setAskConsent(false); setKeyboardEnabled(false) }}
      />
    )
  }

  // Shown only when it is on AND the person has agreed. Otherwise nothing listens.
  if (!enabled || !keyboardListening()) return null

  const choose = (p: Perspective) => {
    setPerspective(p)
    try { localStorage.setItem(KEYBOARD_PERSPECTIVE, p) } catch { /* ignore */ }
    window.dispatchEvent(new Event(KEYBOARD_EVENT))
  }

  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    // Buttons in the header keep their own clicks; only the rest of it drags.
    if ((e.target as HTMLElement).closest('button, [role="group"]')) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }, panel.current?.offsetHeight ?? 0))
  }
  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return
    drag.current = null
    try { localStorage.setItem(POSITION, JSON.stringify(pos)) } catch { /* private mode */ }
  }

  return (
    <section ref={panel} aria-label="3D keyboard"
      className="fixed z-40 rounded-[16px] overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: WIDTH, maxWidth: 'calc(100vw - 24px)', background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.5)' }}>
      <header className="flex items-center gap-2 px-3 py-2 text-[12px] cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ color: 'var(--text-2)' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        title="Drag to move the keyboard">
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
        <div style={{ height: SCENE_HEIGHT }} className="relative">
          <Suspense fallback={<div className="h-full" aria-hidden />}>
            <SerenityKeyboard interactive orbit={perspective === 'custom'} />
          </Suspense>
          {perspective === 'custom' && (
            <p className="absolute bottom-1 inset-x-0 text-center text-[10.5px] pointer-events-none" style={{ color: 'var(--text-3)' }}>Drag the keyboard to change the angle</p>
          )}
        </div>
      )}
    </section>
  )
}
