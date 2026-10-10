// React Bits — Status Mark (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/status-mark rather than vendored: reactbits.dev
// is not reachable from this environment, so claiming the published source
// would be a false provenance claim. This is a reimplementation of the
// behaviour, not a vendored copy. Behaviour, not bytes: a status dot whose state
// reads at a glance, with the ring that says "this one is live".
// License of the upstream design: MIT + Commons Clause.
import React from 'react'

export type StatusMarkState = 'idle' | 'running' | 'done' | 'error' | 'waiting'

export interface StatusMarkProps {
  state: StatusMarkState
  /** Optional label beside the dot. Omitted, the dot stands alone. */
  label?: string
  size?: number
  /** Pulse the ring while running. Off when reduced motion is on. */
  pulse?: boolean
  className?: string
}

const TONE: Record<StatusMarkState, string> = {
  idle: 'var(--text-3)',
  running: 'var(--primary)',
  done: 'var(--success)',
  error: 'var(--danger)',
  waiting: 'var(--warning)',
}

export function StatusMark({ state, label, size = 8, pulse = true, className }: StatusMarkProps) {
  const tone = TONE[state]
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        {state === 'running' && pulse && (
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: tone, opacity: 0.35 }} />
        )}
        <span className="relative rounded-full" style={{ width: size, height: size, background: tone }} />
      </span>
      {label && <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>{label}</span>}
    </span>
  )
}

export default StatusMark
