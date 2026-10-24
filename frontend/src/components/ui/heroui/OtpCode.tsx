/**
 * HeroUI `InputOTP` for two-factor codes, in this app's colours.
 *
 * Every 2FA entry (authenticator setup, turning it off, unlocking the vault)
 * goes through here, so the code boxes look and behave the same everywhere.
 */
import React from 'react'
import { InputOTP } from '@heroui/react'

export function OtpCode({
  value,
  onChange,
  label,
  disabled = false,
  autoFocus = false,
  length = 6,
}: {
  value: string
  onChange: (next: string) => void
  label: string
  disabled?: boolean
  autoFocus?: boolean
  length?: number
}) {
  return (
    <InputOTP
      maxLength={length}
      value={value}
      onChange={(next: string) => onChange(next.replace(/\D/g, '').slice(0, length))}
      isDisabled={disabled}
      aria-label={label}
      autoFocus={autoFocus}
      inputMode="numeric"
      autoComplete="one-time-code"
      className="flex justify-center"
    >
      <InputOTP.Group className="flex gap-2">
        {Array.from({ length }, (_, i) => (
          <InputOTP.Slot
            key={i}
            index={i}
            className="h-11 w-10 rounded-[11px] text-[16px] font-medium tabular-nums"
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text)',
            }}
          />
        ))}
      </InputOTP.Group>
    </InputOTP>
  )
}
