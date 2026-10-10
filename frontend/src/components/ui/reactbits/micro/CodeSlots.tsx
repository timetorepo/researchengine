// React Bits — Code Slots (Micro)
// Written here against the documented behaviour of
// https://reactbits.dev/c/micro/code-slots: a code block where each line is a
// slot that lights as you reach it. The upstream source is not reachable from
// this environment, so this is a reimplementation of the behaviour and it says
// so. License of the upstream design: MIT + Commons Clause.
import React, { useMemo } from 'react'
import { Copy, Check } from 'lucide-react'

export interface CodeSlotsProps {
  code: string
  language?: string
  /** The line to highlight, 1-based. Omitted, nothing is highlighted. */
  activeLine?: number
  /** Show the line numbers. On by default — a diff without numbers is a guess. */
  numbers?: boolean
  maxHeight?: number
  className?: string
}

/**
 * A code block as slots. The active line gets a rail and a wash, so when an
 * explanation says "this line" the reader can see which one without counting.
 *
 * Copy is one button and copies the whole block, because a half-copied snippet
 * is worse than none.
 */
export function CodeSlots({
  code, language, activeLine, numbers = true, maxHeight = 420, className,
}: CodeSlotsProps) {
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code])
  const [copied, setCopied] = React.useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className={`rounded-xl overflow-hidden ${className ?? ''}`}
      style={{ border: '1px solid var(--surface-border)', background: 'var(--code-bg)' }}>
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <span className="text-[10.5px] font-medium" style={{ color: 'var(--text-3)' }}>
          {language ?? 'code'}
        </span>
        <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>
        <button onClick={copy} className="ml-auto flex items-center gap-1 text-[10.5px]"
          style={{ color: 'var(--text-3)' }}>
          {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="text-[11.5px] leading-relaxed" style={{ margin: 0 }}>
          {lines.map((line, i) => {
            const n = i + 1
            const on = activeLine === n
            return (
              <div key={n} className="flex"
                style={{
                  background: on ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                  borderLeft: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
                }}>
                {numbers && (
                  <span className="select-none text-right pr-2.5 pl-2 shrink-0 tabular-nums"
                    style={{ color: on ? 'var(--primary)' : 'var(--text-3)', opacity: on ? 1 : 0.55, minWidth: 34 }}>
                    {n}
                  </span>
                )}
                <code className="pr-3 whitespace-pre" style={{ color: 'var(--text-1)' }}>{line || ' '}</code>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

export default CodeSlots
