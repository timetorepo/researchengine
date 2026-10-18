/**
 * Meetings: record a conversation on this device, watch it transcribe as you
 * talk, type notes alongside it, then write notes with the model you have
 * configured. Nothing is sent anywhere but that model.
 *
 * What it does not do: join a call for you, or label who said what. Speakers
 * are not separated. Transcription is Whisper, and the first run downloads the
 * model into the browser's cache.
 */
import { useEffect, useState } from 'react'
import { Mic, Square, Loader2, FileText } from 'lucide-react'
import { useMeetings, type Meeting } from '@/lib/meetings/store'
import { clock } from '@/lib/meetings/model'
import { startMeeting, stopMeeting, useRecording, recoverInterrupted } from '@/lib/meetings/session'
import { MeetingDetail } from './MeetingDetail'
import { StatusPill } from './StatusPill'

export function MeetingsPanel() {
  const meetings = useMeetings((s) => s.meetings)
  const recordingId = useRecording((s) => s.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = meetings.find((m) => m.id === openId) ?? null

  useEffect(() => { recoverInterrupted() }, [])

  if (open) return <MeetingDetail meeting={open} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-4" data-ui="meetings">
      <Recorder onOpen={(id) => setOpenId(id)} />
      <div className="surface p-3">
        <div className="text-[11px] uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-3)' }}>Your meetings</div>
        {meetings.length === 0 && (
          <p className="text-[12px] px-1 py-3" style={{ color: 'var(--text-3)' }}>
            Nothing recorded yet. Press record when a conversation starts; it stays on this device.
          </p>
        )}
        <ul className="space-y-1">
          {meetings.map((m) => (
            <MeetingRow key={m.id} meeting={m} live={m.id === recordingId} onOpen={() => setOpenId(m.id)} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function MeetingRow({ meeting: m, live, onOpen }: { meeting: Meeting; live: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen}
        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[12px] text-left hover:bg-[var(--elevated)]">
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
          <FileText size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium truncate">{m.title}</span>
          <span className="block text-[11px]" style={{ color: 'var(--text-3)' }}>
            {new Date(m.createdAt).toLocaleString()} · {clock(m.durationSec)}
            {m.segments?.length ? ` · ${m.segments.length} parts` : ''}
          </span>
        </span>
        <StatusPill status={m.status} />
        {live && <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--danger)' }} aria-label="Recording now" />}
      </button>
    </li>
  )
}

function Recorder({ onOpen }: { onOpen: (id: string) => void }) {
  const { recording, busy, elapsed, id, progress } = useRecording()

  const start = async () => {
    const newId = await startMeeting()
    if (newId) onOpen(newId)
  }

  return (
    <div className="surface p-4" data-ui="meeting-recorder">
      <div className="flex items-center gap-3">
        <button type="button" onClick={recording ? () => void stopMeeting() : () => void start()} disabled={busy}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50"
          style={{ background: recording ? 'var(--danger)' : 'var(--primary)', color: '#fff' }}>
          {recording ? <Square size={16} fill="currentColor" /> : busy ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold tabular-nums">
            {recording ? `Recording ${clock(elapsed)}` : busy ? 'Finishing the last meeting' : 'Record a meeting'}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {progress || (recording
              ? 'Text appears as you talk. Audio stays on this device.'
              : 'Transcribed on this device with Whisper, then notes from your model.')}
          </div>
        </div>
        {recording && id && (
          <button type="button" onClick={() => onOpen(id)} className="text-[12px] px-3 py-1.5 rounded-full shrink-0"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Open</button>
        )}
      </div>
    </div>
  )
}
