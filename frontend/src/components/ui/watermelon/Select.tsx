/** Compatibility wrapper. Shared select now uses the BoardUI layout adapter and Base UI semantics. */
import type React from 'react'
import { BoardSelect } from '@/components/ui/boardui/Select'
export interface SelectOption<T extends string = string> {
  value: T
  label: string
  hint?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SelectProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  label?: string
  /** Renders the trigger at input height instead of pill height. */
  size?: 'sm' | 'md'
  className?: string
  /** Right-aligned menu (for triggers near the right edge of a pane). */
  align?: 'left' | 'right'
  disabled?: boolean
  id?: string
}

export function Select<T extends string = string>({ value, onChange, options, placeholder = 'Select…', label, size = 'md', className, align = 'left', disabled, id }: SelectProps<T>) {
  return <label className={`block min-w-0 ${className ?? ''}`}>{label && <span className="block text-xs mb-1 text-[var(--text-3)]">{label}</span>}
    <BoardSelect value={value} onChange={(event) => onChange(event.target.value as T)} options={options} placeholder={placeholder} aria-label={label ?? placeholder} disabled={disabled} id={id} align={align} className={`w-full ${size === 'sm' ? 'text-xs py-1.5' : ''}`} />
  </label>
}
