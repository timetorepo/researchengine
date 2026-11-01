import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Trash2, Copy, Download, Loader2, Sparkles, Square, AlertTriangle } from 'lucide-react'
import { useMeetings, type Meeting } from '@/lib/meetings/store'
import { saveAudio, loadAudio, deleteAudio } from '@/lib/meetings/audioStore'
import { transcribeBlob } from '@/lib/meetings/transcribe'
import { writeMeetingNotes } from '@/lib/meetings/notes'
import { clock, timedText, timeline, joinText } from '@/lib/meetings/model'
import { TEMPLATES, templateOf } from '@/lib/meetings/templates'
import { stopMeeting, useRecording } from '@/lib/meetings/session'
import { WINDOW_SEC } from '@/lib/meetings/live'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'
import { Select } from '@/components/ui/watermelon/Select'
import { StatusPill } from './StatusPill'

export function MeetingDetail({ meeting, onBack }: { meeting: Meeting; onBack: () => void }) {
  const ui = useUI()
  const live = useRecording((s) => s.id === meeting.id && s.recording)
  const busyHere = useRecording((s) => s.id === meeting.id && s.busy)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [title, setTitle] = useState(meeting.title)
  const [memo, setMemo] = useState(meeting.memo ?? '')
  const segments = useMemo(() => meeting.segments ?? [], [meeting.segments])
  const gaps = meeting.gaps ?? []
  const rows = useMemo(() => timeline(segments, gaps), [segments, gaps])
  const template = templateOf(meeting.template)

  useEffect(() => { setTitle(meeting.title) }, [meeting.title])
  useEffect(() => { setMemo(meeting.memo ?? '') }, [meeting.id])

  useEffect(() => {
    if (!memo || memo === (meeting.memo ?? '')) return
    const t = window.setTimeout(() => useMeetings.getState().patch(meeting.id, { memo }), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo])

  useEffect(() => {
    let url: string | null = null
    let alive = true
    if (meeting.hasAudio && !live) void loadAudio(meeting.id).then((b) => { if (b && alive) { url = URL.createObjectURL(b); setAudioUrl(url) } })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [meeting.id, meeting.hasAudio, live])

  const seek = (sec: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = sec
    void a.play().catch(() => undefined)
  }

  const md = useMemo(() => {
    const parts = [`# ${meeting.title}`, '', `_${new Date(meeting.createdAt).toLocaleString()} · ${clock(meeting.durationSec)} · ${template.label}_`]
    if (meeting.notes) parts.push('', meeting.notes)
    if (memo.trim()) parts.push('', '## Your notes from the meeting', '', memo.trim())
    parts.push('', '## Transcript', '', (segments.length ? timedText(segments, gaps) : meeting.transcript) || '_No transcript yet._')
    return parts.join('\n')
  }, [meeting, memo, segments, gaps, template.label])

  const writeNotes = async () => {
    setWriting(true)
    try {
      const notes = await writeMeetingNotes({
        title: meeting.title,
        memo,
        template: template.id,
        segments,
        transcript: meeting.transcript,
        gaps,
      })
      if (!notes) {
        ui.toast('No model to write notes', 'Connect a provider in Settings → Providers. The transcript is saved either way.', 'warning')
        return
      }
      useMeetings.getState().patch(meeting.id, { notes })
      ui.toast('Notes written', 'Check them against the transcript before you rely on them.', 'success')
    } finally {
      setWriting(false)
    }
  }

  const retry = async () => {
    const blob = await loadAudio(meeting.id)
    if (!blob) { ui.toast('Audio is gone', 'The recording was removed from this device.', 'warning'); return }
    setRetrying(true)
    useMeetings.getState().patch(meeting.id, { status: 'transcribing', error: undefined })
    try {
      const text = await transcribeBlob(blob)
      useMeetings.getState().patch(meeting.id, {
        status: 'ready',
        segments: text ? [{ id: 'full', startSec: 0, endSec: meeting.durationSec, text }] : [],
        transcript: text || '(no speech found)',
      })
    } catch (e: any) {
      useMeetings.getState().patch(meeting.id, { status: 'failed', error: e?.message })
    } finally {
      setRetrying(false)
    }
  }

  const remove = async () => {
    await deleteAudio(meeting.id).catch(() => undefined)
    useMeetings.getState().remove(meeting.id)
    onBack()
  }

  const showSegments = segments.length > 0 || gaps.length > 0

  return (
    <div className="space-y-4" data-ui="meeting-detail">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={13} /> All meetings
      </button>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== meeting.title && useMeetings.getState().patch(meeting.id, { title: title.trim() })}
            aria-label="Meeting title"
            className="w-full bg-transparent outline-none text-[17px] font-semibold" style={{ letterSpacing: '-0.01em' }} />
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {new Date(meeting.createdAt).toLocaleString()} · {clock(meeting.durationSec)}
          </div>
        </div>
        <StatusPill status={meeting.status} />
      </div>

      {live && <LiveBanner onStop={() => void stopMeeting()} />}
      {busyHere && !live && (
        <div className="surface p-3 text-[12px] flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
          <Loader2 size={13} className="animate-spin" /> Finishing the transcript…
        </div>
      )}

      {live && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Your notes</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} aria-label="Your notes from the meeting"
            placeholder="Type what matters while you listen. These are used when notes are written."
            className="w-full px-3 py-2 rounded-[12px] outline-none text-[12.5px] resize-y"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        </div>
      )}

      {audioUrl && !live && <audio ref={audioRef} controls src={audioUrl} className="w-full" aria-label="Recording" />}

      {meeting.status === 'failed' && (
        <div className="surface p-3 flex items-center gap-3 text-[12px]">
          <span style={{ color: 'var(--danger)' }}>{meeting.error ?? 'Transcription failed.'}</span>
          {meeting.hasAudio && (
            <button type="button" onClick={() => void retry()} disabled={retrying}
              className="ml-auto px-3 py-1.5 rounded-full text-[12px] disabled:opacity-50" style={{ background: 'var(--elevated)' }}>
              {retrying ? 'Trying again…' : 'Try again'}
            </button>
          )}
        </div>
      )}

      {!live && (
        <div className="flex flex-wrap items-center gap-2">
          <Select size="sm" value={template.id} onChange={(v) => useMeetings.getState().patch(meeting.id, { template: v as Meeting['template'] })}
            options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))} className="w-[220px]" />
          <button type="button" onClick={() => void writeNotes()} disabled={writing || !meeting.transcript || meeting.status !== 'ready'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {writing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {meeting.notes ? 'Write notes again' : 'Write notes'}
          </button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(md); ui.toast('Copied', 'Notes and transcript are on the clipboard.', 'success') }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Copy size={13} /> Copy
          </button>
          <button type="button" onClick={() => download(`${meeting.title.replace(/[^\w-]+/g, '-')}.md`, md, 'text/markdown')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Download size={13} /> Export .md
          </button>
          <button type="button" onClick={() => void remove()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--danger)' }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {!live && memo.trim() && (
        <section className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Your notes</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} aria-label="Your notes from the meeting"
            className="w-full bg-transparent outline-none text-[12.5px] leading-relaxed resize-y" />
        </section>
      )}

      {meeting.notes && (
        <section className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Notes · {template.label}</div>
          <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed font-sans">{meeting.notes}</pre>
        </section>
      )}

      <section className="surface p-4">
        <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Transcript</div>
        {showSegments ? (
          <ol className="space-y-2" aria-label="Timed transcript">
            {rows.map((row) => row.kind === 'segment' ? (
              <li key={`s-${row.segment.id}-${row.segment.startSec}`} className="flex gap-3 text-[12.5px] leading-relaxed">
                {audioUrl && !live ? (
                  <button type="button" onClick={() => seek(row.segment.startSec)} className="tabular-nums shrink-0 underline-offset-2 hover:underline"
                    style={{ color: 'var(--primary)' }} aria-label={`Play from ${clock(row.segment.startSec)}`}>
                    {clock(row.segment.startSec)}
                  </button>
                ) : (
                  <span className="tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>{clock(row.segment.startSec)}</span>
                )}
                <span className="min-w-0">{row.segment.text}</span>
              </li>
            ) : (
              <li key={`g-${row.gap.startSec}`} className="flex items-center gap-2 text-[11.5px] py-1 px-2 rounded-[10px]"
                style={{ background: 'var(--elevated)', color: 'var(--warning)' }}>
                <AlertTriangle size={12} />
                <span>Audio missing from {clock(row.gap.startSec)} to {clock(row.gap.endSec)}: {row.gap.reason}. Nothing here is known about that time.</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
            {meeting.transcript || (meeting.status === 'transcribing' || live ? 'Listening…' : 'No transcript yet.')}
          </p>
        )}
        {joinText(segments) === '' && live && <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>The first lines appear after about {WINDOW_SEC} seconds of speech.</p>}
      </section>
    </div>
  )
}

function LiveBanner({ onStop }: { onStop: () => void }) {
  const { elapsed, level, lostAt, progress } = useRecording()
  return (
    <div className="surface p-3 flex flex-wrap items-center gap-3" data-ui="meeting-live">
      <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--danger)' }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tabular-nums">Recording {clock(elapsed)}</div>
        <div className="text-[11.5px]" style={{ color: lostAt !== null ? 'var(--warning)' : 'var(--text-3)' }}>
          {lostAt !== null
            ? `The microphone stopped at ${clock(lostAt)}. The rest is recorded without it.`
            : progress || 'Text appears in about 20-second parts. Audio stays on this device.'}
        </div>
      </div>
      <div className="hidden sm:flex items-end gap-[2px] h-6" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="w-[3px] rounded-full" style={{ height: `${Math.max(12, (i % 4 === 0 ? level : level * 0.6) * 100)}%`, background: 'var(--primary)' }} />
        ))}
      </div>
      <button type="button" onClick={onStop} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium"
        style={{ background: 'var(--danger)', color: '#fff' }}>
        <Square size={12} fill="currentColor" /> Stop
      </button>
    </div>
  )
}
