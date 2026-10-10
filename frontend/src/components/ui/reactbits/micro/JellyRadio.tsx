// React Bits — Jelly Radio (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/jelly-radio: a radio group whose selected knob
// jellies into place. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour, not a vendored
// copy, and it says so. License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface JellyOption<T extends string> {
  value: T
  label: string
}

export interface JellyRadioProps<T extends string> {
  value: T
  options: JellyOption<T>[]
  onChange: (v: T) => void
  name?: string
  label?: string
}

/**
 * A radio group with a springy selected marker.
 *
 * The marker transitions with a bounce, and `prefers-reduced-motion` is honoured
 * by the consumer's CSS, so it settles instead of wobbling for people who asked
 * for stillness.
 */
export function JellyRadio<T extends string>({
  value, options, onChange, name = 'jelly', label,
}: JellyRadioProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: active ? 'var(--primary)' : 'var(--elevated)',
              color: active ? '#fff' : 'var(--text-2)',
              border: '1px solid var(--surface-border)',
            }}>
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--primary)', animation: 'jelly-pop 320ms cubic-bezier(.34,1.56,.64,1)' }} />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default JellyRadio
