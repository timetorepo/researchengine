// React Bits — Call Chip (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/call-chip: a chip that shows how long a call
// took. The upstream source is not reachable from this environment, so this is a
// reimplementation of the behaviour, not a vendored copy, and it says so.
// License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface CallChipProps {
  /** Elapsed milliseconds. */
  ms: number
  label?: string
  className?: string
}

/**
 * How long a call took, as a chip.
 *
 * Under a second shows in milliseconds, because that is the interesting number
 * for a fast path. Over a second it switches to seconds with one decimal, and
 * over a minute to minutes and seconds — a chip reading 95420ms is a chip nobody
 * reads.
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

export function CallChip({ ms, label, className }: CallChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] tabular-nums ${className ?? ''}`}
      style={{ background: 'var(--elevated)', color: 'var(--text-3)', border: '1px solid var(--surface-border)' }}>
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--success)' }} />
      {label && <span>{label}</span>}
      <span>{formatMs(ms)}</span>
    </span>
  )
}

export default CallChip
