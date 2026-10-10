// React Bits — Peek Rating (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/peek-rating: a rating that shows what you are
// about to give before you commit. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour and it says so.
// License of the upstream design: MIT + Commons Clause.
import React, { useState } from 'react'
import { Star } from 'lucide-react'

export interface PeekRatingProps {
  value: number
  max?: number
  /** Not required when readOnly: a score you are shown is not one you set. */
  onChange?: (value: number) => void
  /** Read-only when true — for showing a score, not setting one. */
  readOnly?: boolean
  size?: number
  label?: string
}

/**
 * Stars you can preview.
 *
 * Hovering the third star shows three filled and the rest hollow, so you can see
 * the rating before you give it. Clicking the same star twice clears it, because
 * a rating you cannot take back is a rating you give too cautiously.
 */
export function PeekRating({ value, max = 5, onChange, readOnly, size = 14, label }: PeekRatingProps) {
  const [peek, setPeek] = useState<number | null>(null)
  const shown = peek ?? value

  return (
    <div className="inline-flex items-center gap-1" role={readOnly ? 'img' : 'radiogroup'}
      aria-label={label ?? 'Rating'} aria-valuenow={readOnly ? value : undefined}
      onPointerLeave={() => setPeek(null)}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const on = n <= shown
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onPointerEnter={() => !readOnly && setPeek(n)}
            onClick={() => !readOnly && onChange?.(n === value ? 0 : n)}
            aria-label={`${n} of ${max}`}
            aria-checked={!readOnly && n === value ? true : undefined}
            role={readOnly ? undefined : 'radio'}
            className="p-0.5 disabled:cursor-default"
            style={{ color: on ? 'var(--warning)' : 'var(--text-3)', opacity: on || peek !== null ? 1 : 0.55 }}>
            <Star size={size} fill={on ? 'currentColor' : 'none'} strokeWidth={1.6} />
          </button>
        )
      })}
    </div>
  )
}

export default PeekRating
