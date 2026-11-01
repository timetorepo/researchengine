/**
 * A small music player that makes its own sound. The four tracks are not
 * recordings: each is a chord loop, a bass line and an arpeggio, scheduled
 * with the Web Audio clock (the standard lookahead pattern), so nothing is
 * downloaded and nothing is licensed. The app can ship without any audio
 * files, and it works offline.
 *
 * Time is kept on the audio context's clock. Pausing suspends that clock, so
 * the position stops with the sound; seeking re-anchors the loop's start.
 */

export type RepeatMode = 'off' | 'all' | 'one'

export interface Track {
  id: string
  title: string
  /** Shown under the title. Says plainly that the track is generated. */
  mood: string
  bpm: number
  /** One chord per bar, as MIDI note numbers. The loop is these bars played twice. */
  chords: number[][]
}

export const TRACKS: Track[] = [
  { id: 'dusk-drift', title: 'Dusk Drift', mood: 'Slow pads · generated', bpm: 70,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]] },
  { id: 'low-tide', title: 'Low Tide', mood: 'Minor drift · generated', bpm: 64,
    chords: [[50, 53, 57, 60], [46, 50, 53, 57], [53, 57, 60, 64], [48, 52, 55, 59]] },
  { id: 'paper-lamp', title: 'Paper Lamp', mood: 'Bright arpeggio · generated', bpm: 84,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]] },
  { id: 'quiet-circuit', title: 'Quiet Circuit', mood: 'Night focus · generated', bpm: 78,
    chords: [[45, 48, 52, 55], [41, 45, 48, 52], [48, 52, 55, 59], [43, 47, 50, 54]] },
]

const LOOKAHEAD_S = 0.2
const TICK_MS = 25
const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

interface Engine {
  ctx: AudioContext
  master: GainNode
  timer: ReturnType<typeof setInterval> | null
  track: number
  /** Audio-clock time at which position 0 of the current loop started. */
  t0: number
  /** Next eighth-note index to schedule, counted from t0. */
  nextN: number
  live: AudioScheduledSourceNode[]
  playing: boolean
  repeat: RepeatMode
  stopAt: number | null
}

let eng: Engine | null = null
let listeners: Array<() => void> = []
export function onEngineChange(fn: () => void) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn) } }
const emit = () => listeners.forEach((l) => l())

function eighthSec(t: Track) { return 60 / t.bpm / 2 }
function loopEighths(t: Track) { return t.chords.length * 2 * 8 }
export function trackDuration(t: Track) { return loopEighths(t) * eighthSec(t) }

function ensure(): Engine {
  if (eng) return eng
  const Ctor: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = readVolume()
  master.connect(ctx.destination)
  eng = { ctx, master, timer: null, track: readTrack(), t0: 0, nextN: 0, live: [], playing: false, repeat: readRepeat(), stopAt: null }
  return eng
}

function readVolume(): number {
  const v = Number(localStorage.getItem('re-music-volume'))
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.35
}
function readTrack(): number {
  const v = Number(localStorage.getItem('re-music-track'))
  return Number.isInteger(v) && v >= 0 && v < TRACKS.length ? v : 0
}
function readRepeat(): RepeatMode {
  const v = localStorage.getItem('re-music-repeat')
  return v === 'off' || v === 'one' || v === 'all' ? v : 'all'
}

function note(e: Engine, when: number, freq: number, dur: number, gain: number, type: OscillatorType, attack: number) {
  const { ctx } = e
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(gain, when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g).connect(e.master)
  osc.start(when)
  osc.stop(when + dur + 0.05)
  e.live.push(osc)
  osc.onended = () => { e.live = e.live.filter((n) => n !== osc) }
}

/** Schedule everything that starts on one eighth-note of the loop. */
function scheduleEighth(e: Engine, n: number, when: number) {
  const t = TRACKS[e.track]
  const idx = n % loopEighths(t)
  const bar = Math.floor(idx / 8)
  const within = idx % 8
  const chord = t.chords[bar % t.chords.length]
  const es = eighthSec(t)
  if (within === 0) {
    // Pad: the chord, held for the bar, with a soft attack so bars do not click.
    const bars = 8 * es
    for (const midi of chord) note(e, when, midiHz(midi + 12), bars + 0.4, 0.035, 'triangle', 0.9)
  }
  if (within % 4 === 0) {
    // Bass: the root an octave down, on each beat.
    note(e, when, midiHz(chord[0] - 12), 0.9, 0.12, 'sine', 0.02)
  }
  // Arpeggio: chord tones up and back on every eighth.
  const pattern = [0, 1, 2, 3, 2, 1]
  const tone = chord[pattern[idx % pattern.length]] + 12
  note(e, when, midiHz(tone), 0.7, 0.05, 'sine', 0.005)
}

function stopLive(e: Engine) {
  for (const n of e.live) { try { n.stop() } catch { /* already stopped */ } }
  e.live = []
}

function pump() {
  const e = eng
  if (!e || !e.playing) return
  const now = e.ctx.currentTime
  const t = TRACKS[e.track]
  const es = eighthSec(t)
  const total = loopEighths(t)
  if (e.stopAt != null) {
    // Repeat off on the last track: the end is already scheduled; finish when it arrives.
    if (now >= e.stopAt) finish(e)
    return
  }
  while (e.t0 + e.nextN * es < now + LOOKAHEAD_S) {
    if (e.nextN >= total) {
      // The loop boundary falls inside the lookahead window.
      const boundary = e.t0 + total * es
      if (e.repeat === 'one') { e.t0 = boundary; e.nextN = 0; continue }
      const nextIdx = e.track + 1
      if (nextIdx < TRACKS.length) { switchTo(e, nextIdx, boundary); continue }
      if (e.repeat === 'all') { switchTo(e, 0, boundary); continue }
      // Off: play the last track to its end, then stop.
      e.stopAt = boundary
      if (now >= e.stopAt) finish(e)
      return
    }
    scheduleEighth(e, e.nextN, e.t0 + e.nextN * es)
    e.nextN++
  }
}

function halt(e: Engine) {
  e.playing = false
  e.stopAt = null
  if (e.timer) { clearInterval(e.timer); e.timer = null }
  void e.ctx.suspend()
}

function finish(e: Engine) {
  halt(e)
  emit()
}

function switchTo(e: Engine, index: number, at: number) {
  // Nodes already queued for the old track keep playing until their own end, so
  // the boundary is seamless; only the schedule moves on.
  e.track = index
  e.t0 = at
  e.nextN = 0
  try { localStorage.setItem('re-music-track', String(index)) } catch { /* private mode */ }
  emit()
}

function startTimer(e: Engine) {
  if (e.timer) return
  e.timer = setInterval(pump, TICK_MS)
}

/** Current position in the track, in seconds. */
export function position(): number {
  if (!eng) return 0
  const t = TRACKS[eng.track]
  const dur = trackDuration(t)
  const p = eng.ctx.currentTime - eng.t0
  return Math.min(dur, Math.max(0, p))
}

export function currentIndex(): number { return eng ? eng.track : readTrack() }
export function isPlaying(): boolean { return !!eng?.playing }
export function getRepeat(): RepeatMode { return eng ? eng.repeat : readRepeat() }
export function getVolume(): number { return eng ? eng.master.gain.value : readVolume() }

export async function play(): Promise<void> {
  const e = ensure()
  if (e.playing) return
  if (e.ctx.state === 'suspended') await e.ctx.resume()
  e.playing = true
  e.stopAt = null
  if (e.nextN === 0 && e.t0 === 0) {
    e.t0 = e.ctx.currentTime + 0.05
  }
  startTimer(e)
  pump()
  emit()
}

export function pause(): void {
  const e = eng
  if (!e || !e.playing) return
  halt(e)
  emit()
}

export async function toggle(): Promise<void> {
  if (isPlaying()) pause()
  else await play()
}

/** Jump to a track from the start. */
export function selectTrack(index: number): void {
  const e = ensure()
  stopLive(e)
  e.stopAt = null
  e.track = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length
  e.t0 = e.ctx.currentTime
  e.nextN = 0
  try { localStorage.setItem('re-music-track', String(e.track)) } catch { /* ignore */ }
  if (e.playing) pump()
  emit()
}

export function next(): void { selectTrack(currentIndex() + 1) }
export function prev(): void {
  if (position() > 3) return seek(0)
  selectTrack(currentIndex() - 1)
}

/** Move to a position in seconds. The loop is re-anchored and the queued notes are dropped. */
export function seek(seconds: number): void {
  const e = ensure()
  const t = TRACKS[e.track]
  const dur = trackDuration(t)
  const p = Math.min(dur - 0.05, Math.max(0, seconds))
  stopLive(e)
  e.stopAt = null
  e.t0 = e.ctx.currentTime - p
  const es = eighthSec(t)
  e.nextN = Math.ceil(p / es)
  if (e.playing) pump()
  emit()
}

export function skip(deltaSeconds: number): void { seek(position() + deltaSeconds) }

export function setRepeat(mode: RepeatMode): void {
  const e = ensure()
  e.repeat = mode
  try { localStorage.setItem('re-music-repeat', mode) } catch { /* ignore */ }
  emit()
}

export function setVolume(v: number): void {
  const clamped = Math.min(1, Math.max(0, v))
  const e = ensure()
  e.master.gain.setTargetAtTime(clamped, e.ctx.currentTime, 0.02)
  try { localStorage.setItem('re-music-volume', String(clamped)) } catch { /* ignore */ }
  emit()
}

/** Tracks the engine's own playing state with the page's. Used when the control is removed. */
export function dispose(): void {
  if (!eng) return
  pause()
  if (eng.timer) clearInterval(eng.timer)
  stopLive(eng)
}

/** Run one scheduling pass now. The timer calls this; tests call it to drive the clock. */
export function pumpNow(): void { pump() }
