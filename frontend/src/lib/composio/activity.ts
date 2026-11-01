/**
 * What changed in the person's connected services, whoever made the change.
 *
 * A connection can be made here or on Composio's own website. Each time the
 * accounts are read, they are compared with the last reading for the same
 * Composio user id, and the differences become "connected" or "disconnected"
 * events. The first reading only sets the baseline, so nothing is reported as new
 * just because the app was opened.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ComposioAccount } from '@/lib/composio/client'

export interface AccountSnap {
  id: string
  toolkit: string
}

export type ActivityKind = 'connected' | 'disconnected'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  toolkit: string
  accountId: string
  userId: string
  at: number
}

export const MAX_EVENTS = 30

/** The events between two readings of the active accounts. Pure. */
export function diffSnapshots(prev: AccountSnap[], next: AccountSnap[], userId: string, at: number): ActivityEvent[] {
  const before = new Map(prev.map((a) => [a.id, a]))
  const after = new Map(next.map((a) => [a.id, a]))
  const out: ActivityEvent[] = []
  for (const a of next) {
    if (!before.has(a.id)) out.push({ id: `${a.id}:c:${at}`, kind: 'connected', toolkit: a.toolkit, accountId: a.id, userId, at })
  }
  for (const a of prev) {
    if (!after.has(a.id)) out.push({ id: `${a.id}:d:${at}`, kind: 'disconnected', toolkit: a.toolkit, accountId: a.id, userId, at })
  }
  return out.sort((x, y) => y.at - x.at)
}

/** Active accounts only: a connection that is still being set up is not "connected". */
export function snapshotOf(accounts: ComposioAccount[], isActive: (a: ComposioAccount) => boolean): AccountSnap[] {
  return accounts.filter(isActive).map((a) => ({ id: a.id, toolkit: a.toolkit.toLowerCase() }))
}

interface ActivityState {
  /** Last reading of active accounts, per Composio user id. */
  baseline: Record<string, AccountSnap[]>
  events: ActivityEvent[]
  /** Compare a fresh reading with the last one. Returns the new events. */
  observe: (userId: string, snaps: AccountSnap[], at: number) => ActivityEvent[]
  /** Clear the list of recent changes (the baseline is kept). */
  clear: () => void
}

export const useComposioActivity = create<ActivityState>()(
  persist(
    (set, get) => ({
      baseline: {},
      events: [],
      observe: (userId, snaps, at) => {
        const prev = get().baseline[userId]
        const fresh = prev === undefined ? [] : diffSnapshots(prev, snaps, userId, at)
        set((s) => ({
          baseline: { ...s.baseline, [userId]: snaps },
          events: [...fresh, ...s.events].slice(0, MAX_EVENTS),
        }))
        return fresh
      },
      clear: () => set({ events: [] }),
    }),
    { name: 're.composio.activity.v1', storage: createJSONStorage(() => localStorage) },
  ),
)
