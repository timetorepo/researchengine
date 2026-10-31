/**
 * The timeline of one saved video: notes pinned to moments, written by the
 * person or by the AI. Clicking a time moves the player there.
 *
 * The AI only reads text the person pastes in (a transcript or a description).
 * It cannot watch the video, and when no AI provider is connected it writes
 * nothing rather than invent notes.
 */
import React, { useMemo, useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { generateText } from '@/lib/chat/generate'
import {
  useLibraryVideos, fmtStart, isClockText, parseAiTimeline, parseStart, sortTimeline,
  timelinePrompt, TRANSCRIPT_MIN, TRANSCRIPT_MAX, type SavedVideo,
} from '@/lib/library/videos'

const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const

export function VideoTimeline({ video, onSeek }: { video: SavedVideo; onSeek: (sec: number) => void }) {
  const ui = useUI()
  const notes = useMemo(() => sortTimeline(video.timeline ?? []), [video.timeline])
  const [at, setAt] = useState('')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const canAdd = text.trim().length > 0 && isClockText(at)

  const addMine = () => {
    if (!canAdd) return
    useLibraryVideos.getState().addNote(video.id, { at: parseStart(at), text: text.trim(), by: 'user' })
    setText('')
  }

  const writeWithAi = async () => {
    setAiError('')
    setBusy(true)
    try {
      const { system, prompt } = timelinePrompt(video.title, source)
      const res = await generateText({ system, prompt, maxTokens: 900, temperature: 0.2 })
      if (res.usedDemo) {
        ui.toast('No AI provider is connected', 'Add one in Settings → Providers to write the timeline with AI.', 'warning')
        return
      }
      const parsed = parseAiTimeline(res.text, 0)
      if (parsed.length === 0) {
        setAiError('The AI answer had no usable timeline lines. Try again, or paste a longer transcript.')
        return
      }
      const added = useLibraryVideos.getState().addNotes(video.id, parsed.map((n) => ({ at: n.at, text: n.text, by: 'ai' as const })))
      ui.toast(`${added} timeline ${added === 1 ? 'note' : 'notes'} added`, 'Written by the AI from the text you pasted.', 'success')
      setSource('')
    } catch (e: any) {
      setAiError(String(e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Timeline" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11.5px] font-medium" style={{ color: 'var(--text-2)' }}>Timeline</div>
        <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Click a time to jump there.</div>
      </div>

      {notes.length === 0 && (
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>No timeline notes yet. Add one below, or let the AI write them from a transcript.</p>
      )}

      {notes.length > 0 && (
        <ol className="space-y-1.5" aria-label="Timeline notes">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start gap-2.5 rounded-[12px] px-2.5 py-2" style={field}>
              <button type="button" onClick={() => onSeek(n.at)} aria-label={`Jump to ${fmtStart(n.at)}`}
                className="shrink-0 px-1.5 py-0.5 rounded-[8px] text-[11.5px] tabular-nums font-medium"
                style={{ background: 'var(--surface)', color: 'var(--primary)' }}>
                {fmtStart(n.at)}
              </button>
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug">{n.text}</span>
              <span className="shrink-0 text-[9.5px] px-1.5 py-0.5 rounded-full"
                style={{ background: n.by === 'ai' ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--surface)', color: n.by === 'ai' ? 'var(--primary)' : 'var(--text-3)' }}>
                {n.by === 'ai' ? 'AI' : 'You'}
              </span>
              <button type="button" onClick={() => useLibraryVideos.getState().removeNote(video.id, n.id)}
                aria-label={`Remove the note at ${fmtStart(n.at)}`}
                className="shrink-0 p-0.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: 'var(--text-3)' }}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); addMine() }}>
        <input value={at} onChange={(e) => setAt(e.target.value)} placeholder="m:ss" aria-label="Note time"
          className="w-[72px] px-2 py-1.5 rounded-[10px] outline-none text-[12px] tabular-nums" style={field} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What happens here, or what to remember" aria-label="Note text"
          className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-[10px] outline-none text-[12.5px]" style={field} />
        <button type="submit" disabled={!canAdd}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Plus size={12} /> Add note
        </button>
      </form>
      {at && !isClockText(at) && <p className="text-[11px]" style={{ color: 'var(--danger, #e5484d)' }}>Use a time like 1:23 or 1:02:03.</p>}

      <details className="rounded-[12px] px-3 py-2" style={field}>
        <summary className="cursor-pointer text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <Sparkles size={12} /> Write the timeline with AI
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Paste the transcript or description (on YouTube: ⋯ → Show transcript). The AI works from this text only; it cannot watch the video.
          </p>
          <textarea value={source} onChange={(e) => setSource(e.target.value.slice(0, TRANSCRIPT_MAX))} rows={4}
            aria-label="Transcript or description"
            placeholder="Paste the transcript here"
            className="w-full px-2.5 py-2 rounded-[10px] outline-none text-[12px] resize-y" style={field} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void writeWithAi()} disabled={busy || source.trim().length < TRANSCRIPT_MIN}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              <Sparkles size={12} /> {busy ? 'Writing…' : 'Write timeline'}
            </button>
            <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {source.trim().length < TRANSCRIPT_MIN ? `Paste at least ${TRANSCRIPT_MIN} characters.` : `${source.length.toLocaleString()} characters`}
            </span>
          </div>
          {aiError && <p role="alert" className="text-[11.5px]" style={{ color: 'var(--danger, #e5484d)' }}>{aiError}</p>}
        </div>
      </details>
    </section>
  )
}
