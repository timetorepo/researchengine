/**
 * The one-time-code field for two-factor codes, in this app's colours.
 * It renders the vendored CodeSlots component.
 *
 * Every 2FA entry (authenticator setup, turning it off, unlocking the vault)
 * goes through here, so the code boxes look and behave the same everywhere.
 */
import React from 'react'
import CodeSlots from '@/components/ui/reactbits/micro/CodeSlots'

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
    <CodeSlots
      length={length}
      value={value}
      onChange={(next: string) => onChange(next.replace(/\D/g, '').slice(0, length))}
      disabled={disabled}
      autoFocus={autoFocus}
      ariaLabel={label}
      accentColor="var(--primary)"
      inkColor="var(--text)"
      slotColor="var(--elevated)"
      digitColor="var(--text)"
      dangerColor="var(--danger)"
    />
  )
}
