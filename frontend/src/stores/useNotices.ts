/**
 * Inline notices: saved-settings confirmations and brand-new update notices.
 *
 * These render as HeroUI alerts at the top of Settings, not as corner toasts,
 * so the user sees them where they just acted. A notice clears itself after a
 * few seconds unless it is sticky (an update that is still waiting to be seen).
 */
import { create } from 'zustand'

export type NoticeStatus = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export interface Notice {
  id: number
  status: NoticeStatus
  title: string
  description?: string
}

interface NoticeState {
  notices: Notice[]
  /** `ms` 0 keeps the notice until the user dismisses it. */
  show: (n: Omit<Notice, 'id'>, ms?: number) => void
  dismiss: (id: number) => void
}

const MAX_VISIBLE = 3
const DEFAULT_MS = 6000
let seq = 0

export const useNotices = create<NoticeState>((set, get) => ({
  notices: [],
  show: (n, ms = DEFAULT_MS) => {
    const id = ++seq
    set((s) => ({ notices: [{ ...n, id }, ...s.notices].slice(0, MAX_VISIBLE) }))
    if (ms > 0) window.setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((x) => x.id !== id) })),
}))

/** A setting was saved. */
export function saveNotice(title: string, description?: string) {
  useNotices.getState().show({ status: 'success', title, description })
}

/** Something needs attention (a rollback, a warning). */
export function warnNotice(title: string, description?: string) {
  useNotices.getState().show({ status: 'warning', title, description })
}

/** A brand-new update: stays until the user dismisses it. */
export function updateNotice(title: string, description?: string) {
  useNotices.getState().show({ status: 'accent', title, description }, 0)
}
