/**
 * Videos in the Library: paste a YouTube link, and it is kept with its title,
 * your notes and the moment you want to start from. Playback uses YouTube's
 * privacy-enhanced embed (youtube-nocookie.com), so no cookies are set until
 * you press play, and the link to YouTube is always there.
 */
import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Play, Trash2, ExternalLink, Clock, Link2 } from 'lucide-react'
import { useUI } from '@/stores/useUI'

export interface SavedVideo {
  id: string
  ytId: string
  title: string
  addedAt: number
  notes: string
  startAt: number
}

export const useLibraryVideos = create<{
  videos: SavedVideo[]
  add: (v: SavedVideo) => void
  update: (id: string, patch: Partial<SavedVideo>) => void
  remove: (id: string) => void
}>()(
  persist(
    (set) => ({
      videos: [],
      add: (v) => set((s) => ({ videos: [v, ...s.videos.filter((x) => x.ytId !== v.ytId)] })),
      update: (id, patch) => set((s) => ({ videos: s.videos.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((s) => ({ videos: s.videos.filter((x) => x.id !== id) })),
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

const fmt = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function LibraryVideos() {
  const videos = useLibraryVideos((s) => s.videos)
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [startText, setStartText] = useState('')
  const ui = useUI()

  const current = useMemo(() => videos.find((v) => v.id === selected) ?? videos[0] ?? null, [videos, selected])
  useEffect(() => { setPlaying(false); setStartText(current ? fmt(current.startAt) : '') }, [current?.id])

  const add = async () => {
    const ytId = youtubeId(url)
    if (!ytId) {
      ui.toast('Not a YouTube link', 'Paste a youtube.com or youtu.be link, or the 11-character video id.', 'warning')
      return
    }
    let title = `Video ${ytId}`
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`)
      if (res.ok) title = (await res.json()).title ?? title
    } catch { /* offline: keep the id as the title until it can be renamed */ }
    const v: SavedVideo = { id: `vid_${ytId}`, ytId, title, addedAt: Date.now(), notes: '', startAt: 0 }
    useLibraryVideos.getState().add(v)
    setSelected(v.id)
    setUrl('')
    ui.toast('Video saved', title, 'success')
  }

  const src = current
    ? `https://www.youtube-nocookie.com/embed/${current.ytId}?rel=0&modestbranding=1${current.startAt ? `&start=${current.startAt}` : ''}${playing ? '&autoplay=1' : ''}`
    : ''

  return (
    <div className="space-y-4" data-ui="library-videos">
      <div className="surface p-3 flex flex-wrap items-center gap-2">
        <Link2 size={14} style={{ color: 'var(--text-3)' }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder="Paste a YouTube link"
          aria-label="YouTube link"
          className="flex-1 min-w-[200px] bg-transparent outline-none text-[13px]" />
        <button onClick={() => void add()} disabled={!url.trim()}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>Save video</button>
      </div>

      {!current && (
        <div className="surface p-6 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          Save a video to keep it here with your notes. It plays inside Research Engine.
        </div>
      )}

      {current && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3 min-w-0">
            <div className="relative w-full aspect-video rounded-[16px] overflow-hidden bg-black" style={{ border: '1px solid var(--surface-border)' }}>
              {playing ? (
                <iframe key={src} src={src} title={current.title} className="absolute inset-0 w-full h-full"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${current.title}`}
                  className="absolute inset-0 w-full h-full group"
                  style={{ background: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url(https://i.ytimg.com/vi/${current.ytId}/hqdefault.jpg) center / cover` }}>
                  <span className="absolute inset-0 m-auto w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.92)', color: '#111' }}>
                    <Play size={22} fill="currentColor" />
                  </span>
                </button>
              )}
            </div>
            <div>
              <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.01em' }}>{current.title}</div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                <label className="inline-flex items-center gap-1.5">
                  <Clock size={12} /> Start at
                  <input value={startText} onChange={(e) => setStartText(e.target.value)}
                    onBlur={() => { const sec = parseStart(startText); useLibraryVideos.getState().update(current.id, { startAt: sec }); setStartText(fmt(sec)) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    placeholder="0:00" aria-label="Start time"
                    className="w-[68px] px-2 py-0.5 rounded-[8px] bg-transparent outline-none tabular-nums"
                    style={{ border: '1px solid var(--surface-border)' }} />
                </label>
                <a href={`https://www.youtube.com/watch?v=${current.ytId}`} target="_blank" rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 hover:underline">Open on YouTube <ExternalLink size={10} /></a>
              </div>
            </div>
            <textarea value={current.notes} onChange={(e) => useLibraryVideos.getState().update(current.id, { notes: e.target.value })}
              placeholder="Notes on this video: what you want to remember, and where." rows={4} aria-label="Notes on this video"
              className="w-full px-3 py-2 rounded-[12px] outline-none text-[12.5px] resize-y"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
          </div>

          <ul className="space-y-1.5 min-w-0" aria-label="Saved videos">
            {videos.map((v) => (
              <li key={v.id} className="group flex items-center gap-2 rounded-[12px] p-1.5"
                style={{ background: v.id === current.id ? 'var(--elevated)' : 'transparent' }}>
                <button type="button" onClick={() => setSelected(v.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <img src={`https://i.ytimg.com/vi/${v.ytId}/default.jpg`} alt="" width={64} height={36}
                    className="rounded-[6px] object-cover shrink-0" style={{ width: 64, height: 36 }} loading="lazy" />
                  <span className="text-[12px] truncate">{v.title}</span>
                </button>
                <button type="button" onClick={() => useLibraryVideos.getState().remove(v.id)} aria-label={`Remove ${v.title}`}
                  className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: 'var(--text-3)' }}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
