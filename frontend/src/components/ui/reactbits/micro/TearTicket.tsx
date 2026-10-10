// React Bits — Tear Ticket (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/tear-ticket: a ticket with a perforated stub
// you tear off. The upstream source is not reachable from this environment, so
// this is a reimplementation of the behaviour, not a vendored copy, and it says
// so. License of the upstream design: MIT + Commons Clause.
import React, { useState } from 'react'

export interface TearTicketProps {
  title: string
  body?: string
  cta?: string
  onTear?: () => void
  className?: string
}

/**
 * A ticket with a tear-off stub.
 *
 * The stub lifts away on a drag past the perf line. It is one affordance, not a
 * promise of a peel animation: once torn, it stays torn until the parent resets
 * it, so an onboarding "open your ResearchEngine" moment cannot be un-torn by an
 * accidental hover.
 */
export function TearTicket({ title, body, cta = 'Tear to open', onTear, className }: TearTicketProps) {
  const [torn, setTorn] = useState(false)
  const [lift, setLift] = useState(0)

  return (
    <div className={`relative ${className ?? ''}`} style={{ perspective: 800 }}>
      <div className="flex">
        <div className="flex-1 px-4 py-3 rounded-l-xl" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', borderRight: 'none' }}>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</div>
          {body && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{body}</div>}
        </div>
        <div
          onPointerDown={(e) => { const start = e.clientY; const move = (ev: PointerEvent) => setLift(Math.max(0, ev.clientY - start)); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (lift > 28) { setTorn(true); onTear?.() } else setLift(0) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up) }}
          className="relative w-16 grid place-items-center rounded-r-xl cursor-grab active:cursor-grabbing"
          style={{
            background: 'color-mix(in srgb, var(--primary) 16%, var(--elevated))',
            border: '1px dashed var(--surface-border)',
            transform: `translateY(${lift}px) rotateX(${lift > 4 ? -22 : 0}deg)`,
            transformOrigin: 'bottom',
            opacity: torn ? 0 : 1,
            transition: lift > 0 ? undefined : 'transform 200ms, opacity 200ms',
          }}>
          <span className="text-[10.5px] font-medium text-center px-1" style={{ color: 'var(--primary)' }}>{torn ? 'Open' : cta}</span>
        </div>
      </div>
      {/* perforation */}
      <div aria-hidden className="absolute top-0 bottom-0 left-[calc(100%-4rem)] flex flex-col justify-around py-1" style={{ width: 1 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ width: 1, height: 3, background: 'var(--surface-border)' }} />
        ))}
      </div>
    </div>
  )
}

export default TearTicket
