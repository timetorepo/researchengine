/**
 * Videos in the Library: paste a YouTube link and it is kept with its title,
 * your notes, the moment you want to start from, and a timeline of notes pinned
 * to moments in the video. Each saved video is a card; clicking it opens the
 * player in a popup, with the notes beside it.
 */
import { useState } from 'react'
import { Play, Trash2, Clock, Link2, ListTree } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { VideoPlayerModal } from '@/components/video/VideoPlayerModal'
import { VideoTimeline } from '@/components/library/VideoTimeline'
import {
  useLibraryVideos, youtubeId, parseStart, fmtStart, type SavedVideo,
} from '@/lib/library/videos'

export type { SavedVideo, TimelineNote } from '@/lib/library/videos'
export { useLibraryVideos, youtubeId, parseStart, fmtStart }

export function LibraryVideos() {
  const videos = useLibraryVideos((s) => s.videos)
  const [url, setUrl] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [startText, setStartText] = useState('')
  const ui = useUI()
  const current = videos.find((v) => v.id === openId) ?? null

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
    const v: SavedVideo = { id: `vid_${ytId}`, ytId, title, addedAt: Date.now(), notes: '', startAt: 0, timeline: [] }
    useLibraryVideos.getState().add(v)
    setUrl('')
    ui.toast('Video saved', title, 'success')
  }

  const open = (v: SavedVideo) => {
    setStartText(fmtStart(v.startAt))
    setOpenId(v.id)
  }

  /** Jump the player to a moment: the player starts from there. */
  const seek = (video: SavedVideo, sec: number) => {
    useLibraryVideos.getState().update(video.id, { startAt: sec })
    setStartText(fmtStart(sec))
  }

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

      {videos.length === 0 && (
        <div className="surface p-6 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          Save a video to keep it here with your notes. Click it to play it inside Research Engine.
        </div>
      )}

      {videos.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Saved videos">
          {videos.map((v) => (
            <li key={v.id} className="surface overflow-hidden flex flex-col group">
              <button type="button" onClick={() => open(v)} aria-label={`Play ${v.title}`} className="relative w-full aspect-video">
                <img src={`https://i.ytimg.com/vi/${v.ytId}/hqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center bg-white/90 text-black transition-transform group-hover:scale-105">
                    <Play size={18} fill="currentColor" />
                  </span>
                </span>
              </button>
              <div className="p-3 flex items-start gap-2">
                <button type="button" onClick={() => open(v)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[12.5px] font-medium leading-snug line-clamp-2">{v.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                    {v.startAt > 0 && <span className="inline-flex items-center gap-1"><Clock size={10} /> from {fmtStart(v.startAt)}</span>}
                    {v.notes && <span>has notes</span>}
                    {(v.timeline?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><ListTree size={10} /> {v.timeline!.length} on the timeline</span>
                    )}
                  </span>
                </button>
                <button type="button" onClick={() => useLibraryVideos.getState().remove(v.id)} aria-label={`Remove ${v.title}`}
                  className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: 'var(--text-3)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VideoPlayerModal
        ytId={current?.ytId ?? null}
        title={current?.title ?? ''}
        startAt={current?.startAt ?? 0}
        onClose={() => setOpenId(null)}
      >
        {current && (
          <div className="space-y-4">
            <label className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              <Clock size={12} /> Start at
              <input value={startText} onChange={(e) => setStartText(e.target.value)}
                onBlur={() => { const sec = parseStart(startText); seek(current, sec) }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="0:00" aria-label="Start time"
                className="w-[68px] px-2 py-0.5 rounded-[8px] bg-transparent outline-none tabular-nums"
                style={{ border: '1px solid var(--surface-border)' }} />
              <span className="ml-1">The player starts from here.</span>
            </label>

            <VideoTimeline video={current} onSeek={(sec) => seek(current, sec)} />

            <div className="space-y-1.5">
              <div className="text-[11.5px] font-medium" style={{ color: 'var(--text-2)' }}>Summary notes</div>
              <textarea value={current.notes} onChange={(e) => useLibraryVideos.getState().update(current.id, { notes: e.target.value })}
                placeholder="Notes on this video as a whole: what you want to remember." rows={3} aria-label="Notes on this video"
                className="w-full px-3 py-2 rounded-[12px] outline-none text-[12.5px] resize-y"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
            </div>
          </div>
        )}
      </VideoPlayerModal>
    </div>
  )
}
