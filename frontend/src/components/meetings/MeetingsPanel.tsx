/**
 * Meetings: record a conversation on this device, transcribe it on this device,
 * then write notes with the model you have configured. It is the same shape as
 * the AI note-takers people pay for, with nothing sent anywhere but that model.
 *
 * What it does not do: join a call for you, or label who said what. Speakers
 * are not separated. Transcription is Whisper, and the first run downloads the
 * model into the browser's cache.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Square, Trash2, Copy, Download, Loader2, Sparkles, FileText, ArrowLeft } from 'lucide-react'
import { useMeetings, type Meeting } from '@/lib/meetings/store'
import { saveAudio, loadAudio, deleteAudio } from '@/lib/meetings/audioStore'
import { transcribeBlob } from '@/lib/meetings/transcribe'
import { writeMeetingNotes } from '@/lib/meetings/notes'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'

const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return `${h ? `${h}:` : ''}${String(h ? m : m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
}

function pickMime(): string | undefined {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
}

export function MeetingsPanel() {
  const meetings = useMeetings((s) => s.meetings)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = meetings.find((m) => m.id === openId) ?? null

  if (open) return <MeetingDetail meeting={open} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-4" data-ui="meetings">
      <Recorder onSaved={(id) => setOpenId(id)} />
      <div className="surface p-3">
        <div className="text-[11px] uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-3)' }}>Your meetings</div>
        {meetings.length === 0 && (
          <p className="text-[12px] px-1 py-3" style={{ color: 'var(--text-3)' }}>
            Nothing recorded yet. Press record when a conversation starts; it stays on this device.
          </p>
        )}
        <ul className="space-y-1">
          {meetings.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpenId(m.id)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[12px] text-left hover:bg-[var(--elevated)]">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
                  <FileText size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium truncate">{m.title}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {new Date(m.createdAt).toLocaleString()} · {fmtClock(m.durationSec)}
                  </span>
                </span>
                <StatusPill status={m.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: Meeting['status'] }) {
  const label = { recording: 'Recording', transcribing: 'Transcribing', ready: 'Ready', failed: 'Needs attention' }[status]
  const tone = status === 'failed' ? 'var(--danger)' : status === 'ready' ? 'var(--success)' : 'var(--warning)'
  return <span className="text-[10.5px] px-2 py-0.5 rounded-full shrink-0" style={{ color: tone, background: 'var(--elevated)' }}>{label}</span>
}

function Recorder({ onSaved }: { onSaved: (id: string) => void }) {
  const ui = useUI()
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(32).fill(0.05))
  const [progress, setProgress] = useState('')
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef(0)
  const rafRef = useRef(0)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => stopAll(), [])

  const stopAll = () => {
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void ctxRef.current?.close()
    streamRef.current = null
    ctxRef.current = null
  }

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      ui.toast('No microphone access here', 'This browser cannot record audio. Try the desktop app or a current browser.', 'warning')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => void finish(rec.mimeType || mime || 'audio/webm')
      rec.start(1000)
      recRef.current = rec

      const ctx = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const draw = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) { const d = (v - 128) / 128; sum += d * d }
        const rms = Math.sqrt(sum / data.length)
        setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 4)])
        rafRef.current = requestAnimationFrame(draw)
      }
      draw()

      startRef.current = Date.now()
      setElapsed(0)
      timerRef.current = window.setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 250)
      setRecording(true)
    } catch (e: any) {
      ui.toast('Microphone unavailable', e?.message ?? 'Allow microphone access and try again.', 'warning')
    }
  }

  const stop = () => {
    recRef.current?.stop()
    setRecording(false)
  }

  const finish = async (mime: string) => {
    const duration = (Date.now() - startRef.current) / 1000
    const blob = new Blob(chunksRef.current, { type: mime })
    stopAll()
    setLevels(Array(32).fill(0.05))
    const id = `mtg_${Date.now().toString(36)}`
    const created = new Date()
    useMeetings.getState().add({
      id,
      title: `Meeting · ${created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: created.getTime(),
      durationSec: Math.round(duration),
      status: 'transcribing',
      transcript: '',
      notes: '',
      hasAudio: true,
    })
    await saveAudio(id, blob)
    onSaved(id)
    setBusy(true)
    try {
      const text = await transcribeBlob(blob, (p) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') setProgress(`Downloading the speech model… ${Math.round(p.progress)}%`)
        else if (p?.status === 'ready') setProgress('')
      })
      useMeetings.getState().patch(id, { status: 'ready', transcript: text || '(no speech found)' })
      ui.toast('Transcript ready', 'Write notes from it when you are ready.', 'success')
    } catch (e: any) {
      useMeetings.getState().patch(id, { status: 'failed', error: e?.message ?? 'Transcription failed' })
      ui.toast('Transcription failed', 'The recording is kept. Try again from the meeting.', 'danger')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="surface p-4" data-ui="meeting-recorder">
      <div className="flex items-center gap-3">
        <button type="button" onClick={recording ? stop : () => void start()} disabled={busy}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50"
          style={{ background: recording ? 'var(--danger)' : 'var(--primary)', color: '#fff' }}>
          {recording ? <Square size={16} fill="currentColor" /> : busy ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold tabular-nums">
            {recording ? `Recording ${fmtClock(elapsed)}` : busy ? 'Working on the last meeting' : 'Record a meeting'}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {progress || (recording ? 'Audio stays on this device. Stop to transcribe.' : 'Transcribed on this device with Whisper, then notes from your model.')}
          </div>
        </div>
        {recording && (
          <div className="hidden sm:flex items-end gap-[3px] h-8" aria-hidden="true">
            {levels.map((l, i) => (
              <span key={i} className="w-[3px] rounded-full" style={{ height: `${Math.max(8, l * 100)}%`, background: 'var(--primary)', opacity: 0.4 + l * 0.6 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingDetail({ meeting, onBack }: { meeting: Meeting; onBack: () => void }) {
  const ui = useUI()
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [title, setTitle] = useState(meeting.title)
  const md = useMemo(() => {
    const parts = [`# ${meeting.title}`, '', `_${new Date(meeting.createdAt).toLocaleString()} · ${fmtClock(meeting.durationSec)}_`]
    if (meeting.notes) parts.push('', meeting.notes)
    parts.push('', '## Transcript', '', meeting.transcript || '_No transcript yet._')
    return parts.join('\n')
  }, [meeting])

  useEffect(() => {
    let url: string | null = null
    let alive = true
    if (meeting.hasAudio) void loadAudio(meeting.id).then((b) => { if (b && alive) { url = URL.createObjectURL(b); setAudioUrl(url) } })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [meeting.id, meeting.hasAudio])

  const writeNotes = async () => {
    setWriting(true)
    try {
      const notes = await writeMeetingNotes(meeting.title, meeting.transcript)
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
      useMeetings.getState().patch(meeting.id, { status: 'ready', transcript: text || '(no speech found)' })
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
            {new Date(meeting.createdAt).toLocaleString()} · {fmtClock(meeting.durationSec)}
          </div>
        </div>
        <StatusPill status={meeting.status} />
      </div>

      {audioUrl && <audio controls src={audioUrl} className="w-full" aria-label="Recording" />}

      {meeting.status === 'failed' && (
        <div className="surface p-3 flex items-center gap-3 text-[12px]">
          <span style={{ color: 'var(--danger)' }}>{meeting.error ?? 'Transcription failed.'}</span>
          <button type="button" onClick={() => void retry()} disabled={retrying}
            className="ml-auto px-3 py-1.5 rounded-full text-[12px] disabled:opacity-50" style={{ background: 'var(--elevated)' }}>
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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

      {meeting.notes && (
        <section className="surface p-4">
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Notes</div>
          <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed font-sans">{meeting.notes}</pre>
        </section>
      )}

      <section className="surface p-4">
        <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Transcript</div>
        <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
          {meeting.transcript || (meeting.status === 'transcribing' ? 'Transcribing…' : 'No transcript yet.')}
        </p>
      </section>
    </div>
  )
}
