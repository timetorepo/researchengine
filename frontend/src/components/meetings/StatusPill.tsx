import type { MeetingStatus } from '@/lib/meetings/model'

export function StatusPill({ status }: { status: MeetingStatus }) {
  const label = { recording: 'Recording', transcribing: 'Transcribing', ready: 'Ready', failed: 'Needs attention' }[status]
  const tone = status === 'failed' ? 'var(--danger)' : status === 'ready' ? 'var(--success)' : 'var(--warning)'
  return <span className="text-[10.5px] px-2 py-0.5 rounded-full shrink-0" style={{ color: tone, background: 'var(--elevated)' }}>{label}</span>
}
