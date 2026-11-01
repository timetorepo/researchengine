/**
 * A select that looks like a menu, not a browser control. Drop-in for a native
 * `<select>`: it takes the same `<option>` children and calls `onChange` with an
 * object shaped like the change event (`target.value`), so call sites only swap
 * the tag.
 *
 * Look: a quiet trigger; the open list is a raised panel where the current
 * value sits on a grey band, and hovering or arrowing moves the same band.
 * Keyboard: Enter/Space/ArrowDown open, arrows move, Enter picks, Escape closes.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectChange { target: { value: string } }

interface Option { value: string; label: string; disabled?: boolean }

export interface ModernSelectProps {
  value: string
  onChange: (e: SelectChange) => void
  children?: React.ReactNode
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
  title?: string
  id?: string
  placeholder?: string
}

/** Read the `<option>` children into a flat list. Groups are flattened. */
export function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const el = child as React.ReactElement<any>
    if (el.type === 'optgroup') { out.push(...readOptions(el.props.children)); return }
    if (el.type !== 'option') return
    const text = React.Children.toArray(el.props.children).join('')
    out.push({
      value: String(el.props.value ?? text),
      label: typeof el.props.children === 'string' ? el.props.children : text || String(el.props.value ?? ''),
      disabled: !!el.props.disabled,
    })
  })
  return out
}

export function ModernSelect({ value, onChange, children, disabled, className = '', style, placeholder, ...rest }: ModernSelectProps) {
  const options = useMemo(() => readOptions(children), [children])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.findIndex((o) => o.value === value)
  const label = current >= 0 ? options[current].label : (placeholder ?? '')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const openList = () => {
    if (disabled) return
    setActive(current >= 0 ? current : 0)
    setOpen(true)
  }
  const pick = (i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    setOpen(false)
    if (o.value !== value) onChange({ target: { value: o.value } })
  }
  const step = (dir: 1 | -1) => {
    if (!options.length) return
    let i = active
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) { setActive(i); return }
    }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else if (e.key === 'Home') { e.preventDefault(); setActive(options.findIndex((o) => !o.disabled)) }
    else if (e.key === 'End') { e.preventDefault(); for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) { setActive(i); break } }
  }

  return (
    <div ref={root} className={`relative inline-block min-w-0 ${className}`} style={style}>
      <button
        type="button"
        id={rest.id}
        role="combobox"
        aria-label={rest['aria-label']}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        title={rest.title}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className="w-full min-w-0 inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-[9px] text-[12.5px] text-left transition-colors hover:bg-[var(--elevated)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--ring-focus, none)' }}
      >
        <span className="truncate">{label || '\u00A0'}</span>
        <ChevronDown size={13} aria-hidden className="shrink-0 transition-transform duration-150" style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={rest['aria-label']}
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 min-w-[10rem] overflow-y-auto rounded-[12px] p-1 shadow-xl"
          style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
        >
          {options.map((o, i) => {
            const selected = o.value === value
            const highlighted = i === active
            return (
              <li
                key={`${o.value}-${i}`}
                role="option"
                aria-selected={selected}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(i) }}
                className={`flex items-center justify-between gap-3 h-8 px-2.5 rounded-[8px] text-[13px] cursor-pointer select-none ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                style={{
                  // The grey band: the highlight on hover or arrow, and the chosen value keeps it when nothing else is highlighted.
                  background: highlighted || (selected && active < 0) ? 'color-mix(in srgb, var(--text) 9%, transparent)' : 'transparent',
                  color: selected ? 'var(--text)' : 'var(--text-2)',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span className="truncate">{o.label}</span>
                {selected && <Check size={13} aria-hidden className="shrink-0" style={{ color: 'var(--text-3)' }} />}
              </li>
            )
          })}
          {!options.length && <li className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--text-3)' }}>Nothing to choose</li>}
        </ul>
      )}
    </div>
  )
}
