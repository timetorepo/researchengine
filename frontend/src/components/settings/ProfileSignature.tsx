import { useRef, useState } from 'react'
import { Signature } from '@/components/ui/bencho/signature/Signature'
import '@/components/ui/bencho/signature/Signature.css'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'

export function ProfileSignature() {
  const pad = useRef<HTMLDivElement>(null)
  const saved = useStore((s) => s.settings.profileSignature)
  const [version, setVersion] = useState(0)
  const save = () => {
    const svg = pad.current?.querySelector<SVGElement>('.sig-ink')
    if (!svg?.querySelector('path')) { useUI.getState().toast('Draw a signature first', 'Or keep using your profile name instead.', 'info'); return }
    // Only our own rendered path geometry is persisted, never pasted SVG or scripts.
    const copy = svg.cloneNode(true) as SVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.setAttribute('color', '#777777')
    const data = new XMLSerializer().serializeToString(copy)
    if (data.length > 200000) { useUI.getState().toast('Signature is too detailed', 'Clear the pad and try a shorter signature.', 'warning'); return }
    useStore.setState((s) => ({ settings: { ...s.settings, profileSignature: data } }))
    useUI.getState().toast('Signature saved locally')
  }
  return <section className="surface p-4" aria-label="Profile signature">
    <h3 className="text-sm font-semibold">Your signature</h3>
    <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-2)' }}>Optional profile artwork, stored on this device. Not a verified legal signature. Your profile name works without drawing.</p>
    <div ref={pad} className="re-bencho overflow-x-auto"><Signature key={version} /></div>
    <div className="flex flex-wrap gap-2 text-xs mt-3">
      <button className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={save}>Save signature</button>
      <button className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => setVersion((v) => v + 1)}>Clear drawing</button>
      {saved && <><button className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => download('signature.svg', saved, 'image/svg+xml')}>Export signature</button>
      <button className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, profileSignature: undefined } }))}>Remove saved signature</button></>}
    </div>
    {saved && <img className="mt-3 max-w-full" width={260} height={120} alt="Your saved profile signature" src={`data:image/svg+xml,${encodeURIComponent(saved)}`} />}
  </section>
}
