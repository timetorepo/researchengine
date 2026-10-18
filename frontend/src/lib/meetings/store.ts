import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type MeetingStatus = 'recording' | 'transcribing' | 'ready' | 'failed'

export interface Meeting {
  id: string
  title: string
  createdAt: number
  durationSec: number
  status: MeetingStatus
  transcript: string
  notes: string
  hasAudio: boolean
  error?: string
}

/** Meeting text only. The audio itself is in IndexedDB (audioStore.ts). */
export const useMeetings = create<{
  meetings: Meeting[]
  add: (m: Meeting) => void
  patch: (id: string, p: Partial<Meeting>) => void
  remove: (id: string) => void
}>()(
  persist(
    (set) => ({
      meetings: [],
      add: (m) => set((s) => ({ meetings: [m, ...s.meetings] })),
      patch: (id, p) => set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
      remove: (id) => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),
    }),
    { name: 're.meetings.v1', storage: createJSONStorage(() => localStorage) },
  ),
)
