/**
 * A stat card drawn as a grid of dots. The filled dots show the share of a whole, a
 * big percentage sits under the grid, and an optional "previous" value shows where it
 * was before. Use it for any ratio: adoption, completion, share of budget, and so on.
 *
 * Pure presentation: pass numbers and a label in, it draws the rest. Dots fill row by
 * row from the top left, so the shape reads at a glance.
 */
import React from 'react'

export interface DotStatCardProps {
  /** The current value, 0–100 (a percentage). Clamped. */
  value: number
  /** The value it was before, 0–100. Omit to hide the comparison line. */
  previous?: number
  /** What the number measures, shown beside the percentage. */
  label: string
  /** Text shown under the label in place of the comparison, e.g. "vs last month". */
  note?: string
  /** Dots per row. */
  columns?: number
  /** Total dots in the grid. Fill is `value` percent of this. */
  total?: number
  /** Colour of a filled dot. Defaults to the app's text colour. */
  fill?: string
  /** Colour of an empty dot. */
  empty?: string
  className?: string
}

export function dotsFilled(value: number, total: number): number {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  return Math.round((v / 100) * total)
}

/** Whole percentages read best; a fraction shows one decimal place only when it has one. */
export function formatPercent(value: number): string {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`
}

export function DotStatCard({
  value, previous, label, note, columns = 15, total = 100, fill = 'var(--text)', empty = 'var(--elevated)', className = '',
}: DotStatCardProps) {
  const cols = Math.max(1, Math.floor(columns))
  const count = Math.max(cols, Math.floor(total))
  const lit = dotsFilled(value, count)
  const comparison = previous === undefined ? null : previous
  return (
    <figure
      className={`rounded-[18px] p-5 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
      aria-label={`${label}: ${formatPercent(value)}${comparison === null ? '' : `, ${formatPercent(comparison)} before`}`}
    >
      <div
        className="grid gap-[7px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="aspect-square rounded-full"
            style={{ background: i < lit ? fill : empty }}
          />
        ))}
      </div>
      <figcaption className="mt-5 flex items-end gap-3">
        <span className="font-semibold leading-none tracking-tight text-[52px]" style={{ color: 'var(--text)' }}>
          {formatPercent(value)}
        </span>
        <span className="pb-1 leading-tight">
          <span className="block text-[15px]" style={{ color: 'var(--text)' }}>{label}</span>
          <span className="block text-[13px]" style={{ color: 'var(--text-3)' }}>
            {comparison !== null ? `vs ${formatPercent(comparison)} ${note ?? 'previous'}` : (note ?? '')}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}
