/**
 * The one recording the app can have at a time. It lives outside any React
 * component, so leaving the Library tab does not stop a meeting. Each window of
 * speech is written into the meeting record when it comes back, not at the end.
 */
import { create } from 'zustand'
import { useUI } from '@/stores/useUI'
import { useMeetings } from './store'
import { saveAudio } from './audioStore'
import { transcribeBlob, whenTranscriptionIdle } from './transcribe'
import { LiveRecorder } from './live'
import { joinText, type Gap } from './model'

interface RecordingState {
  id: string | null
  recording: boolean
  busy: boolean
  elapsed: number
  level: number
  lostAt: number | null
  progress: string
}

const idle: RecordingState = { id: null, recording: false, busy: false, elapsed: 0, level: 0, lostAt: null, progress: '' }

export const useRecording = create<RecordingState>()(() => idle)

let live: LiveRecorder | null = null
let timer: number | undefined
let startedAt = 0

const toast = (title: string, body?: string, tone?: 'success' | 'warning' | 'danger') =>
  useUI.getState().toast(title, body, tone)

function title(): string {
  const created = new Date()
  return `Meeting · ${created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

export async function startMeeting(): Promise<string | null> {
  if (useRecording.getState().recording || useRecording.getState().busy) return null
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('No microphone access here', 'This browser cannot record audio. Try the desktop app or a current browser.', 'warning')
    return null
  }
  const id = `mtg_${Date.now().toString(36)}`
  const rec = new LiveRecorder()
  try {
    await rec.start({
      onSegment: (seg) => useMeetings.getState().appendSegment(id, seg),
      onLevel: (level) => useRecording.setState({ level }),
      onLost: (at) => useRecording.setState({ lostAt: at }),
      onProgress: (p) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') useRecording.setState({ progress: `Downloading the speech model… ${Math.round(p.progress)}%` })
        else if (p?.status === 'ready') useRecording.setState({ progress: '' })
      },
    })
  } catch (e: any) {
    toast('Microphone unavailable', e?.message ?? 'Allow microphone access and try again.', 'warning')
    return null
  }
  live = rec
  useMeetings.getState().add({
    id,
    title: title(),
    createdAt: Date.now(),
    durationSec: 0,
    status: 'recording',
    transcript: '',
    notes: '',
    hasAudio: false,
    memo: '',
    template: 'general',
    segments: [],
    gaps: [],
  })
  startedAt = Date.now()
  useRecording.setState({ ...idle, id, recording: true })
  timer = window.setInterval(() => useRecording.setState({ elapsed: (Date.now() - startedAt) / 1000 }), 250)
  return id
}

export async function stopMeeting(): Promise<void> {
  const id = useRecording.getState().id
  if (!live || !id) return
  window.clearInterval(timer)
  useRecording.setState({ recording: false, busy: true, level: 0, progress: 'Finishing the transcript…' })
  const result = await live.stop()
  live = null
  const patch = useMeetings.getState().patch
  patch(id, { durationSec: Math.round(result.durationSec), gaps: result.gaps as Gap[] })

  let hasAudio = false
  if (result.blob.size > 0) {
    await saveAudio(id, result.blob)
    hasAudio = true
  }
  patch(id, { hasAudio })

  await whenTranscriptionIdle()
  const meeting = useMeetings.getState().meetings.find((m) => m.id === id)
  const have = meeting?.segments?.length ?? 0
  const needFull = hasAudio && (!result.liveOk || (have === 0 && result.durationSec > 3))

  if (needFull) {
    patch(id, { status: 'transcribing' })
    try {
      const text = await transcribeBlob(result.blob, (p) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') useRecording.setState({ progress: `Downloading the speech model… ${Math.round(p.progress)}%` })
      })
      const segments = text ? [{ id: 'full', startSec: 0, endSec: result.durationSec, text }] : []
      patch(id, { status: 'ready', segments, transcript: text || '(no speech found)' })
    } catch (e: any) {
      patch(id, { status: 'failed', error: e?.message ?? 'Transcription failed' })
      toast('Transcription failed', 'The recording is kept. Try again from the meeting.', 'danger')
    }
  } else {
    const segments = useMeetings.getState().meetings.find((m) => m.id === id)?.segments ?? []
    patch(id, { status: 'ready', transcript: joinText(segments) || '(no speech found)' })
    toast('Transcript ready', 'Write notes from it when you are ready.', 'success')
  }
  useRecording.setState({ ...idle })
}

/**
 * A meeting that is still marked as recording when this session starts was
 * cut off by an app close. Its transcript up to that point is kept; the audio
 * in the last few seconds may not be.
 */
export function recoverInterrupted(): void {
  const active = useRecording.getState().id
  for (const m of useMeetings.getState().meetings) {
    if (m.status === 'recording' && m.id !== active) {
      useMeetings.getState().patch(m.id, {
        status: 'failed',
        error: 'The app closed during this recording. The transcript up to that point is kept.',
      })
    }
  }
}
