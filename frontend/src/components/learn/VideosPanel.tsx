/**
 * The Videos tab: YouTube videos about what is being studied right now.
 *
 * The topic is taken from the document and the current path lesson, and can be
 * edited. The lookup goes through the backend (/api/learn/videos), which asks
 * the search ladder for `site:youtube.com <topic>`. Videos play inline from the
 * privacy-enhanced embed, and every result also links out to YouTube.
 */
import React, { useEffect, useState } from 'react'
import { Search, Loader2, ExternalLink, Play, AlertTriangle } from 'lucide-react'
import type { DocumentRecord, LearnPath } from '@/types'
import { useStore } from '@/stores/useStore'
import { keyTerms } from '@/lib/learn/cards'
import { lessonOrder } from '@/lib/learn/path'
import { Select } from '@/components/ui/watermelon/Select'

interface Video { id: string; title: string; url: string; snippet: string; channel: string }

export function VideosPanel({ documents }: { documents: DocumentRecord[] }) {
  const paths = useStore((s) => s.learnPaths)
  const progress = useStore((s) => s.learnProgress)
  const [docId, setDocId] = useState<string>(documents[0]?.id ?? '')
  const doc = documents.find((d) => d.id === docId) ?? documents[0]
  const path: LearnPath | undefined = paths.find((p) => p.docId === doc?.id)

  const suggested = (() => {
    const nextLesson = path ? lessonOrder(path, progress).find((x) => !x.locked && x.stars === 0) : undefined
    if (nextLesson) return nextLesson.lesson.title.replace(/^Part \d+:\s*/, '').replace(/…$/, '')
    if (!doc) return ''
    const terms = keyTerms(doc.text).slice(0, 3)
    return [doc.name.replace(/\.[a-z]+$/i, ''), ...terms].join(' ')
  })()

  const [topic, setTopic] = useState(suggested)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  // Follow the study focus when the document or the next lesson changes.
  useEffect(() => { setTopic(suggested); setVideos(null); setPlaying(null) }, [suggested])

  const search = async (q: string) => {
    const clean = q.trim()
    if (!clean) return
    setLoading(true)
    setNote(null)
    setPlaying(null)
    try {
      const res = await fetch(`/api/learn/videos?q=${encodeURIComponent(clean)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVideos([])
        setNote(json?.error ?? 'The search did not answer.')
      } else {
        setVideos(json.videos ?? [])
        setNote(json.note ?? (json.videos?.length ? null : 'No videos matched this topic.'))
      }
    } catch {
      setVideos([])
      setNote('The backend is not reachable, so videos cannot be looked up right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (suggested) void search(suggested) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [suggested])

  if (documents.length === 0) {
    return <div className="surface p-5 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>Add a document and the videos will follow what it covers.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select size="sm" value={doc?.id ?? ''} onChange={(v) => setDocId(v)}
          options={documents.map((d) => ({ value: d.id, label: d.name }))} className="w-[220px]" />
        <form className="flex-1 min-w-[220px] flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void search(topic) }}>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[12px]" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
            <Search size={14} style={{ color: 'var(--text-3)' }} />
            <input value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Video topic"
              className="flex-1 bg-transparent outline-none text-[13px]" placeholder="What do you want to watch about?" />
          </div>
          <button type="submit" disabled={loading || !topic.trim()} className="px-3.5 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {loading && <Loader2 size={13} className="animate-spin" />} Find videos
          </button>
        </form>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        Following: {path ? 'your next lesson' : 'this document'}. Results come from a web search for YouTube pages, so titles are as YouTube wrote them.
      </p>

      {note && (
        <div className="flex items-start gap-2 text-[12px] p-3 rounded-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} /> {note}
        </div>
      )}

      {videos && videos.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {videos.map((v) => (
            <div key={v.id} className="surface overflow-hidden flex flex-col">
              {playing === v.id ? (
                <iframe
                  title={v.title}
                  src={`https://www.youtube-nocookie.com/embed/${v.id}?rel=0`}
                  className="w-full aspect-video"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button onClick={() => setPlaying(v.id)} className="relative w-full aspect-video group" aria-label={`Play ${v.title}`}>
                  <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                    <span className="w-11 h-11 rounded-full flex items-center justify-center bg-white/90 text-black"><Play size={18} fill="currentColor" /></span>
                  </span>
                </button>
              )}
              <div className="p-3 flex-1 min-w-0">
                <div className="text-[12.5px] font-medium leading-snug line-clamp-2">{v.title}</div>
                <div className="flex items-center gap-2 mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                  <span className="truncate">{v.channel}</span>
                  <a href={v.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:underline shrink-0">
                    YouTube <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
