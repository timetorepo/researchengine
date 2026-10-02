/**
 * Notifications.
 *
 * A tiny store rather than a service: everything here is produced by things
 * that already run on this machine (the update check, the recommendation
 * fetch), and everything is read by the one bell in the sidebar. Keeping the
 * persistence in localStorage means a notification survives a restart and
 * still costs nothing, and the `key` field is what stops the same release from
 * being announced on every launch.
 *
 * Two rules the rest of the app relies on:
 *
 *   • Nothing is pushed unless it was asked for. Update notices are on by
 *     default; recommendation notices are off until the user turns them on in
 *     Settings → Notifications.
 *   • A notification is a record of something that happened, not a nag: the
 *     bell shows a count, the panel shows the list, and dismissing is one tap.
 */
import { useSyncExternalStore } from 'react'

export type NotificationKind = 'update' | 'recommendations' | 'info'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  at: number
  read: boolean
  href?: string
  /** Dedupe key: the same release or the same day never lands twice. */
  key?: string
}

const KEY = 're.notifications'
const MAX = 60

let items: AppNotification[] = load()
const listeners = new Set<() => void>()

function load(): AppNotification[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.slice(0, MAX) : []
  } catch { return [] }
}

function commit(next: AppNotification[]) {
  items = next.slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* private mode */ }
  listeners.forEach((l) => l())
}

export const notifications = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get(): AppNotification[] { return items },
  unread(): number { return items.filter((i) => !i.read).length },

  push(n: Omit<AppNotification, 'id' | 'at' | 'read'> & { id?: string; at?: number }): AppNotification | null {
    if (n.key && items.some((i) => i.key === n.key)) return null
    const entry: AppNotification = {
      id: n.id ?? `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind: n.kind,
      title: n.title,
      body: n.body,
      at: n.at ?? Date.now(),
      read: false,
      href: n.href,
      key: n.key,
    }
    commit([entry, ...items])
    return entry
  },

  markRead(id: string) { commit(items.map((i) => (i.id === id ? { ...i, read: true } : i))) },
  markAllRead() { commit(items.map((i) => ({ ...i, read: true }))) },
  remove(id: string) { commit(items.filter((i) => i.id !== id)) },
  clear() { commit([]) },

  /** How many unread notifications there are of one kind — what a badge shows. */
  unreadOf(kind: NotificationKind): number { return items.filter((i) => i.kind === kind && !i.read).length },
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(notifications.subscribe, notifications.get, notifications.get)
}

/**
 * Announce a new release, once per version.
 *
 * Called from the update check rather than from a timer of its own: the app
 * already asks about releases, and a notification should describe a fact that
 * was just learned, not a second independent poll.
 */
export function notifyUpdate(version: string, notes?: string) {
  notifications.push({
    kind: 'update',
    key: `update:${version}`,
    title: `Research Engine ${version} is available`,
    body: (notes ?? '').split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 160)
      ?? 'Open Settings → Updates to see what changed and install it.',
    href: '/settings/updates',
  })
}

/** Announce recommendations, at most once a day, and only when switched on. */
export function notifyRecommendations(count: number, sample: string[]) {
  if (count <= 0) return
  const day = new Date().toISOString().slice(0, 10)
  notifications.push({
    kind: 'recommendations',
    key: `recs:${day}`,
    title: count === 1 ? 'One new recommendation' : `${count} new recommendations`,
    body: sample.slice(0, 3).join(' · '),
    href: '/library',
  })
}
