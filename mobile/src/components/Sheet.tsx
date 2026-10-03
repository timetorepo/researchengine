// Sheet (docs/mobile/04-navigation.md §2): detents 25 / 50 / 90, grabber row,
// scrim uses --scrim, radius-modal top-only. R1 ships detent taps; velocity
// drag-snap continues from the same spring values in R3 (motion stays
// composited: translateY only, never layout properties).
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../lib/haptics'

export type Detent = 25 | 50 | 90

export function Sheet({ open, onClose, children, initialDetent = 50, label, inline = false }:
  { open: boolean; onClose: () => void; children: React.ReactNode; initialDetent?: Detent; label: string; inline?: boolean }) {
  const [detent, setDetent] = useState<Detent>(initialDetent)
  useEffect(() => { if (open) setDetent(initialDetent) }, [open, initialDetent])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open && !inline) return null
  if (inline) {
    // Rendered in-place for the design preview / tests: same DOM minus the
    // fixed positioning and the portal (react-dom/server cannot portal).
    return (
      <div data-c="Sheet" data-state="inline" className="sheet-inline">
        <div className="sheet-grabber-row">
          <span className="sheet-grabber" aria-hidden />
        </div>
        <div className="sheet-body pane-scroll">{children}</div>
      </div>
    )
  }
  return createPortal(
    <div data-c="Sheet" data-state="open" className="sheet-root" role="dialog" aria-modal="true" aria-label={label}>
      <button className="sheet-scrim" aria-label="Close sheet" onClick={onClose} />
      <div className="sheet-panel" style={{ ['--sheet-h' as any]: `${detent}dvh` } as React.CSSProperties}>
        <div className="sheet-grabber-row">
          <span className="sheet-grabber" aria-hidden />
          <div className="sheet-detents" role="group" aria-label="Sheet height">
            {([25, 50, 90] as Detent[]).map((d) => (
              <button key={d} className={`detent ${d === detent ? 'detent-on' : ''}`}
                onClick={() => { haptic('detent'); setDetent(d) }} aria-pressed={d === detent}>{d}%</button>
            ))}
          </div>
        </div>
        <div className="sheet-body pane-scroll">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
