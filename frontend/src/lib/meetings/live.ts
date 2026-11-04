/**
 * The microphone, while a meeting is being recorded.
 *
 * Two things run side by side. MediaRecorder keeps the whole recording as one
 * file, for playback, for the fallback pass, and for anyone who wants it. A
 * PCM tap cuts the same audio into windows of WINDOW_SEC and sends each window
 * to the speech model as it fills, so the transcript grows while you talk.
 * Every window that comes back is handed up at once, which is what lets the
 * caller save it before the meeting ends.
 */
import { transcribeQueued } from './transcribe'
import { GapLedger, resampleTo16k, SAMPLE_RATE, type Gap } from './model'

export const WINDOW_SEC = 20
const MIN_TAIL_SEC = 1

export interface LiveHandlers {
  onSegment: (seg: { id: string; startSec: number; endSec: number; text: string }) => void
  onLevel: (level: number) => void
  onLost: (atSec: number) => void
  onProgress?: (p: any) => void
}

export interface LiveResult {
  blob: Blob
  durationSec: number
  gaps: Gap[]
  /** False when any window could not be transcribed live; the caller then runs the full file. */
  liveOk: boolean
  segmentCount: number
}

function pickMime(): string | undefined {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
}

export class LiveRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private ctx: AudioContext | null = null
  private tap: ScriptProcessorNode | null = null
  private handlers!: LiveHandlers
  private pending: Float32Array[] = []
  private pendingLen = 0
  private windowStartSample = 0
  private totalSamples = 0
  private rate = 48000
  private t0 = 0
  private jobs: Promise<void>[] = []
  private segments = 0
  private liveOk = true
  private gaps = new GapLedger('the microphone stopped')

  async start(handlers: LiveHandlers): Promise<void> {
    this.handlers = handlers
    this.t0 = performance.now()
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mime = pickMime()
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.recorder.start(1000)

    const track = this.stream.getAudioTracks()[0]
    track?.addEventListener('ended', () => {
      const at = this.wallElapsed()
      this.gaps.begin(at)
      handlers.onLost(at)
    })

    this.ctx = new AudioContext()
    this.rate = this.ctx.sampleRate
    const source = this.ctx.createMediaStreamSource(this.stream)
    this.tap = this.ctx.createScriptProcessor(4096, 1, 1)
    this.tap.onaudioprocess = (e) => this.onBlock(e.inputBuffer.getChannelData(0))
    const mute = this.ctx.createGain()
    mute.gain.value = 0
    source.connect(this.tap)
    this.tap.connect(mute)
    mute.connect(this.ctx.destination)
  }

  /** Audio time: the position of the transcript windows. Stops if the mic is lost. */
  private audioElapsed(): number {
    return this.totalSamples / this.rate
  }

  /** Wall time: the length of the meeting, and where a lost-audio gap starts and ends. */
  private wallElapsed(): number {
    return (performance.now() - this.t0) / 1000
  }

  private onBlock(block: Float32Array): void {
    const copy = new Float32Array(block)
    this.pending.push(copy)
    this.pendingLen += copy.length
    this.totalSamples += copy.length
    let sum = 0
    for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i]
    this.handlers.onLevel(Math.min(1, Math.sqrt(sum / Math.max(1, copy.length)) * 4))
    if (this.pendingLen >= WINDOW_SEC * this.rate) this.cut()
  }

  private cut(): void {
    if (this.pendingLen === 0) return
    const merged = new Float32Array(this.pendingLen)
    let off = 0
    for (const p of this.pending) { merged.set(p, off); off += p.length }
    const startSec = this.windowStartSample / this.rate
    const endSec = (this.windowStartSample + this.pendingLen) / this.rate
    this.windowStartSample += this.pendingLen
    this.pending = []
    this.pendingLen = 0
    const samples = resampleTo16k(merged, this.rate)
    this.jobs.push(this.transcribeWindow(samples, startSec, endSec))
  }

  private transcribeWindow(samples: Float32Array, startSec: number, endSec: number): Promise<void> {
    return transcribeQueued(samples, this.handlers.onProgress)
      .then((text) => {
        const clean = text.trim()
        if (!clean) return
        this.segments++
        this.handlers.onSegment({ id: `seg_${this.segments}_${Math.round(startSec)}`, startSec, endSec, text: clean })
      })
      .catch(() => { this.liveOk = false })
  }

  /** Stops, finishes the last window, and waits for every window to come back. */
  async stop(): Promise<LiveResult> {
    const durationSec = this.wallElapsed()
    this.tap?.disconnect()
    if (this.pendingLen / this.rate >= MIN_TAIL_SEC) this.cut()
    const gaps = this.gaps.close(durationSec)
    const blob = await new Promise<Blob>((resolve) => {
      const rec = this.recorder
      if (!rec || rec.state === 'inactive') { resolve(new Blob(this.chunks, { type: 'audio/webm' })); return }
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }))
      rec.stop()
    })
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    await Promise.all(this.jobs)
    return { blob, durationSec, gaps, liveOk: this.liveOk, segmentCount: this.segments }
  }
}
