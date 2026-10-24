/**
 * HeroUI `Alert`, in this app's colours.
 *
 * Used for saved-settings confirmations and for brand-new update notices. The
 * stylesheet only carries the HeroUI classes it pins (see globals.css), so the
 * tone is set here from the app's own variables instead of HeroUI's status
 * classes, which would otherwise come out unstyled.
 */
import React from 'react'
import { Alert } from '@heroui/react'
import { X } from 'lucide-react'
import type { NoticeStatus } from '@/stores/useNotices'

const TONE: Record<NoticeStatus, string> = {
  default: 'var(--text-2)',
  accent: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

export function InlineAlert({
  status = 'default',
  title,
  children,
  onClose,
  className = '',
}: {
  status?: NoticeStatus
  title: React.ReactNode
  children?: React.ReactNode
  onClose?: () => void
  className?: string
}) {
  const tone = TONE[status]
  const urgent = status === 'danger' || status === 'warning'
  return (
    <Alert
      status={status}
      role={urgent ? 'alert' : 'status'}
      className={`flex w-full items-start gap-3 rounded-[14px] px-3.5 py-3 ${className}`}
      style={{
        background: `color-mix(in srgb, ${tone} 10%, var(--elevated))`,
        border: `1px solid color-mix(in srgb, ${tone} 35%, transparent)`,
        color: 'var(--text)',
      }}
    >
      <Alert.Indicator style={{ color: tone }} />
      <Alert.Content className="min-w-0 flex-1">
        <Alert.Title className="text-[13px] font-semibold" style={{ color: tone }}>{title}</Alert.Title>
        {children && <Alert.Description className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{children}</Alert.Description>}
      </Alert.Content>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded-md"
          style={{ color: 'var(--text-3)' }}
        >
          <X size={13} />
        </button>
      )}
    </Alert>
  )
}
