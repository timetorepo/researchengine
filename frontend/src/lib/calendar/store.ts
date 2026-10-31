import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { parseIcs, type CalEvent } from './ics'

/**
 * Calendar data on this device. Events you make here are "local". A feed is a
 * calendar file you brought in: an .ics file, or a Google Calendar secret
 * address that the backend fetches for you. A feed owns its events, so a sync
 * replaces them, and removing a feed removes exactly what it brought in.
 */
export interface Feed {
  id: string
  name: string
  kind: 'file' | 'google'
  /** Only for Google feeds. The secret iCal address from Google Calendar settings. */
  url?: string
  lastSyncedAt?: number
  count: number
  error?: string
}

export const GOOGLE_ICS_RE = /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s]+\.ics$/

export const useCalendar = create<{
  events: CalEvent[]
  feeds: Feed[]
  addEvent: (e: CalEvent) => void
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  removeEvent: (id: string) => void
  addFeed: (f: Feed) => void
  removeFeed: (id: string) => void
  /** Replace a feed's events with what its file says now. Returns how many were read. */
  syncFeed: (feedId: string, text: string) => { count: number; skipped: number }
  setFeedError: (feedId: string, error: string | undefined) => void
}>()(
  persist(
    (set) => ({
      events: [],
      feeds: [],
      addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
      updateEvent: (id, patch) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      addFeed: (f) => set((s) => ({ feeds: [...s.feeds, f] })),
      removeFeed: (id) => set((s) => ({
        feeds: s.feeds.filter((f) => f.id !== id),
        events: s.events.filter((e) => e.feedId !== id),
      })),
      syncFeed: (feedId, text) => {
        const { events: read, skipped } = parseIcs(text)
        const owned = read.map((e) => ({ ...e, id: `${feedId}:${e.id}`, feedId }))
        set((s) => ({
          events: [...s.events.filter((e) => e.feedId !== feedId), ...owned],
          feeds: s.feeds.map((f) => (f.id === feedId ? { ...f, count: owned.length, lastSyncedAt: Date.now(), error: undefined } : f)),
        }))
        return { count: owned.length, skipped }
      },
      setFeedError: (feedId, error) => set((s) => ({ feeds: s.feeds.map((f) => (f.id === feedId ? { ...f, error } : f)) })),
    }),
    { name: 're.calendar.v1', storage: createJSONStorage(() => localStorage) },
  ),
)
