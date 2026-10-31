/**
 * Saved YouTube videos in the Library: the list, the notes, and the timeline.
 *
 * A timeline note is pinned to one moment of a video. The person writes it, or
 * the AI writes it from a transcript or description the person pastes in. The
 * AI cannot watch the video, so it only ever sees that text.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'

export type NoteAuthor = 'user' | 'ai'

/** A note pinned to one moment of a video. */
export interface TimelineNote {
  id: string
  /** Seconds into the video. */
  at: number
  text: string
  by: NoteAuthor
  createdAt: number
}

export interface SavedVideo {
  id: string
  ytId: string
  title: string
  addedAt: number
  notes: string
  startAt: number
  /** Optional so videos saved before the timeline existed still load. */
  timeline?: TimelineNote[]
}

type NewNote = Omit<TimelineNote, 'id' | 'createdAt'>

interface VideosState {
  videos: SavedVideo[]
  add: (v: SavedVideo) => void
  update: (id: string, patch: Partial<SavedVideo>) => void
  remove: (id: string) => void
  addNote: (videoId: string, note: NewNote) => void
  updateNote: (videoId: string, noteId: string, patch: Partial<Pick<TimelineNote, 'at' | 'text'>>) => void
  removeNote: (videoId: string, noteId: string) => void
  /** Adds many notes at once (the AI's timeline). Returns how many were added. */
  addNotes: (videoId: string, notes: NewNote[]) => number
}

const withNote = (v: SavedVideo, note: TimelineNote): SavedVideo => ({
  ...v,
  timeline: [...(v.timeline ?? []), note],
})

export const useLibraryVideos = create<VideosState>()(
  persist(
    (set, get) => ({
      videos: [],
      add: (v) => set((s) => ({ videos: [v, ...s.videos.filter((x) => x.ytId !== v.ytId)] })),
      update: (id, patch) => set((s) => ({ videos: s.videos.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((s) => ({ videos: s.videos.filter((x) => x.id !== id) })),
      addNote: (videoId, note) => set((s) => ({
        videos: s.videos.map((v) => (v.id === videoId
          ? withNote(v, { ...note, id: nanoid(10), createdAt: Date.now() })
          : v)),
      })),
      updateNote: (videoId, noteId, patch) => set((s) => ({
        videos: s.videos.map((v) => (v.id !== videoId ? v : {
          ...v,
          timeline: (v.timeline ?? []).map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
        })),
      })),
      removeNote: (videoId, noteId) => set((s) => ({
        videos: s.videos.map((v) => (v.id !== videoId ? v : {
          ...v,
          timeline: (v.timeline ?? []).filter((n) => n.id !== noteId),
        })),
      })),
      addNotes: (videoId, notes) => {
        const video = get().videos.find((v) => v.id === videoId)
        if (!video || notes.length === 0) return 0
        const now = Date.now()
        const fresh = notes.map((n, i) => ({ ...n, id: nanoid(10), createdAt: now + i }))
        set((s) => ({
          videos: s.videos.map((v) => (v.id !== videoId ? v : { ...v, timeline: [...(v.timeline ?? []), ...fresh] })),
        }))
        return fresh.length
      },
    }),
    { name: 're.library.videos.v1', storage: createJSONStorage(() => localStorage) },
  ),
)

/** Pull the 11-character video id out of the usual YouTube link shapes. */
export function youtubeId(input: string): string | null {
  const s = input.trim()
  const direct = /^[A-Za-z0-9_-]{11}$/.exec(s)
  if (direct) return direct[0]
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
      const m = /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname)
      if (m) return m[2]
    }
  } catch { /* not a URL */ }
  return null
}

/** "1:23", "01:02:03" or plain seconds, to whole seconds. */
export function parseStart(text: string): number {
  const t = text.trim()
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const parts = t.split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** True when the text is a clock time the app can read: "5", "1:23" or "1:02:03". */
export function isClockText(text: string): boolean {
  return /^\d+$/.test(text.trim()) || /^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(text.trim())
}

export const fmtStart = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : String(m)}:${String(s).padStart(2, '0')}`
}

/** The timeline in order: by moment, then by when it was written. */
export function sortTimeline(notes: TimelineNote[]): TimelineNote[] {
  return [...notes].sort((a, b) => a.at - b.at || a.createdAt - b.createdAt)
}

export const TRANSCRIPT_MIN = 80
export const TRANSCRIPT_MAX = 30000

/** The prompt that turns a transcript or description into timeline notes. */
export function timelinePrompt(title: string, source: string): { system: string; prompt: string } {
  const body = source.slice(0, TRANSCRIPT_MAX)
  return {
    system: [
      'You write timeline notes for a video from the text the person gives you.',
      'You cannot watch the video; use only what the text says.',
      'Reply with a JSON array and nothing else. Each item is {"time": "m:ss" or "h:mm:ss", "note": "one short sentence"}.',
      'Pick 6 to 20 moments that matter. Use the times that appear in the text. If the text has no times, estimate and say so in the note.',
    ].join(' '),
    prompt: `Video: ${title}\n\nText:\n${body}`,
  }
}

export interface AiNote { at: number; text: string }

/**
 * Read the AI's answer. Accepts a bare JSON array or one wrapped in a code fence
 * or a sentence. Lines that do not carry a usable time and note are dropped.
 */
export function parseAiTimeline(raw: string, maxSec = 0): AiNote[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let items: unknown
  try { items = JSON.parse(raw.slice(start, end + 1)) } catch { return [] }
  if (!Array.isArray(items)) return []
  const out: AiNote[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const time = (item as any).time
    const note = (item as any).note
    if (typeof note !== 'string') continue
    const text = note.trim().slice(0, 220)
    if (!text) continue
    let at: number
    if (typeof time === 'number') at = Math.floor(time)
    else if (typeof time === 'string' && isClockText(time)) at = parseStart(time)
    else continue
    if (!Number.isFinite(at) || at < 0) continue
    if (maxSec > 0 && at > maxSec) continue
    const key = `${at}|${text}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ at, text })
    if (out.length >= 40) break
  }
  return out.sort((a, b) => a.at - b.at)
}
