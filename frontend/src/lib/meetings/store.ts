import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Gap, MeetingStatus, Segment, TemplateId } from './model'
import { joinText } from './model'

export type { MeetingStatus } from './model'

export interface Meeting {
  id: string
  title: string
  createdAt: number
  durationSec: number
  status: MeetingStatus
  /** The whole transcript as text. Kept in step with `segments` for older readers. */
  transcript: string
  notes: string
  hasAudio: boolean
  error?: string
  /** Notes typed during the meeting. */
  memo?: string
  template?: TemplateId
  /** Timed transcript. Missing on meetings recorded before the timed model. */
  segments?: Segment[]
  /** Spans where the microphone was lost. */
  gaps?: Gap[]
}

/**
 * Meeting text only. The audio itself is in IndexedDB (audioStore.ts). Nothing
 * here waits on a network, and each change is written to localStorage as it
 * happens, so a reload keeps a transcript that was already finished.
 */
export const useMeetings = create<{
  meetings: Meeting[]
  add: (m: Meeting) => void
  patch: (id: string, p: Partial<Meeting>) => void
  appendSegment: (id: string, s: Segment) => void
  remove: (id: string) => void
}>()(
  persist(
    (set) => ({
      meetings: [],
      add: (m) => set((s) => ({ meetings: [m, ...s.meetings] })),
      patch: (id, p) => set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
      appendSegment: (id, seg) =>
        set((s) => ({
          meetings: s.meetings.map((m) => {
            if (m.id !== id) return m
            const segments = [...(m.segments ?? []), seg]
            return { ...m, segments, transcript: joinText(segments) }
          }),
        })),
      remove: (id) => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),
    }),
    { name: 're.meetings.v1', storage: createJSONStorage(() => localStorage) },
  ),
)
