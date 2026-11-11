/**
 * The meeting record, as plain data and plain functions. Nothing here touches
 * the browser, so the rules that matter (time stamps, gaps, joining text) can
 * be tested in Node.
 *
 * The shape follows the idea behind anarlog: one session is the single entity.
 * The notes you type during the meeting, the timed transcript, the record of
 * any lost audio, and the notes written afterwards all hang off that one id.
 */

export type MeetingStatus = 'recording' | 'transcribing' | 'ready' | 'failed'
export type TemplateId = 'general' | 'one-to-one' | 'interview' | 'study'

export interface Segment {
  id: string
  startSec: number
  endSec: number
  text: string
}

export interface Gap {
  startSec: number
  endSec: number
  reason: string
}

export const SAMPLE_RATE = 16000

/** Clock text for a time in seconds: 1:05, or 1:02:05 past an hour. */
export function clock(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Text of the segments in order, the way the transcript field is kept. */
export function joinText(segments: Segment[]): string {
  return segments.map((s) => s.text.trim()).filter(Boolean).join(' ')
}

/**
 * Segments and gaps in time order, as lines for a timed transcript. A gap is
 * shown where the audio was lost, so nobody reads a hole as silence.
 */
export function timeline(segments: Segment[], gaps: Gap[] = []): Array<
  | { kind: 'segment'; at: number; segment: Segment }
  | { kind: 'gap'; at: number; gap: Gap }
> {
  const rows: Array<{ kind: 'segment'; at: number; segment: Segment } | { kind: 'gap'; at: number; gap: Gap }> = [
    ...segments.map((segment) => ({ kind: 'segment' as const, at: segment.startSec, segment })),
    ...gaps.map((gap) => ({ kind: 'gap' as const, at: gap.startSec, gap })),
  ]
  return rows.sort((a, b) => a.at - b.at)
}

/** Plain text for copy and export, with time stamps and lost-audio notes. */
export function timedText(segments: Segment[], gaps: Gap[] = []): string {
  return timeline(segments, gaps)
    .map((row) =>
      row.kind === 'segment'
        ? `[${clock(row.segment.startSec)}] ${row.segment.text.trim()}`
        : `[${clock(row.gap.startSec)}] (audio missing until ${clock(row.gap.endSec)}: ${row.gap.reason})`,
    )
    .join('\n')
}

/**
 * Records spans where the microphone was lost. Open a gap when the track ends
 * and close it at the next time the audio is known to be flowing again, or at
 * the end of the meeting. Zero-length gaps are dropped.
 */
export class GapLedger {
  private open: number | null = null
  private gaps: Gap[] = []

  constructor(private readonly reason: string) {}

  begin(at: number): void {
    if (this.open === null) this.open = at
  }

  end(at: number): void {
    if (this.open === null) return
    if (at > this.open) this.gaps.push({ startSec: this.open, endSec: at, reason: this.reason })
    this.open = null
  }

  close(at: number): Gap[] {
    this.end(at)
    return this.list()
  }

  isOpen(): boolean {
    return this.open !== null
  }

  list(): Gap[] {
    return this.gaps.slice()
  }
}

/**
 * Linear resampling to the speech model's 16 kHz. Good enough for speech; the
 * browser's own resampler is used when the context already runs at 16 kHz.
 */
export function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === SAMPLE_RATE || input.length === 0) return input
  const ratio = fromRate / SAMPLE_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const f = pos - i0
    out[i] = input[i0] * (1 - f) + input[i1] * f
  }
  return out
}
