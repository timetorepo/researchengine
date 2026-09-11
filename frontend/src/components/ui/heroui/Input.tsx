import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** HeroUI-style input with floating label slot, radius and focus tint. */
export function Input({
  label, value, onChange, placeholder = '', type = 'text', description, isInvalid, errorMessage,
  className = '', autoFocus, onKeyDown, endContent,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  description?: string
  isInvalid?: boolean
  errorMessage?: string
  className?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
  endContent?: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-[12.5px] font-medium mb-1.5">{label}</span>}
      <div
        className="relative flex items-center rounded-[14px] transition-colors focus-within:border-[var(--primary)]"
        style={{
          background: 'var(--elevated)',
          border: `1px solid ${isInvalid ? 'var(--danger)' : 'var(--surface-border)'}`,
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={isPassword ? (show ? 'text' : 'password') : type}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent outline-none px-3.5 py-2.5 text-[13.5px]"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)} aria-label="Toggle visibility"
            className="px-2.5 shrink-0" style={{ color: 'var(--text-3)' }}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        {endContent && <span className="px-3 shrink-0">{endContent}</span>}
      </div>
      {description && !isInvalid && <span className="block text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{description}</span>}
      {isInvalid && errorMessage && <span className="block text-[11px] mt-1" style={{ color: 'var(--danger)' }}>{errorMessage}</span>}
    </label>
  )
}
