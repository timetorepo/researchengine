/**
 * Checks the music engine's scheduling against a fake Web Audio clock: the clock
 * advances only when the test says so, the way a real context does.
 */
let now = 0
let state = 'running'
class FakeParam { value = 1; setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime(v: number) { this.value = v } }
class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); type = ''; connect() { return this } start() {} stop() {} onended: any = null }
class FakeCtx {
  destination = {}
  get currentTime() { return now }
  get state() { return state }
  createGain() { return new FakeNode() }
  createOscillator() { return new FakeNode() }
  async resume() { state = 'running' }
  async suspend() { state = 'suspended' }
}
;(globalThis as any).window = { AudioContext: FakeCtx, matchMedia: () => ({ matches: false }) }
const store: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
const eng = await import('../src/lib/music/engine.ts')

let failures = 0
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }

// Tick the scheduler the way the real timer does.
const advance = (sec: number) => { for (let i = 0; i < sec / 0.025; i++) { now += 0.025; eng.pumpNow() } }

await eng.play()
const t0 = eng.TRACKS[0]
const dur = eng.trackDuration(t0)
check('track duration is 8 bars at the track tempo', Math.abs(dur - 8 * 4 * 60 / t0.bpm) < 1e-9, `${dur.toFixed(2)}s`)
advance(3)
check('position advances with the clock', Math.abs(eng.position() - 3) < 0.1, eng.position().toFixed(2))
eng.pause()
const paused = eng.position()
eng.pumpNow()
check('pause freezes the position', eng.position() === paused && eng.isPlaying() === false, `${paused.toFixed(2)} stays`)
await eng.play()
advance(1)
eng.seek(dur - 1)
check('seek near the end lands where asked', Math.abs(eng.position() - (dur - 1)) < 0.1, eng.position().toFixed(2))
eng.setRepeat('off')
eng.selectTrack(eng.TRACKS.length - 1)
check('select last track', eng.currentIndex() === eng.TRACKS.length - 1)
eng.seek(0)
advance(eng.trackDuration(eng.TRACKS[3]) + 1)
check('repeat off stops after the last track', eng.isPlaying() === false)
eng.setRepeat('all')
await eng.play()
advance(eng.trackDuration(eng.TRACKS[3]) + 0.5)
check('repeat all wraps to the first track', eng.currentIndex() === 0, `index ${eng.currentIndex()}`)
check('repeat all keeps playing', eng.isPlaying())
eng.setRepeat('one')
eng.selectTrack(1)
advance(eng.trackDuration(eng.TRACKS[1]) + 1)
check('repeat one stays on the same track', eng.currentIndex() === 1 && eng.isPlaying())
eng.setVolume(2)
check('volume clamps to 1', eng.getVolume() === 1)
check('prev restarts a track past 3s', (() => { eng.selectTrack(2); advance(5); eng.prev(); return eng.position() < 1 && eng.currentIndex() === 2 })())
check('prev goes back when near the start', (() => { eng.prev(); return eng.currentIndex() === 1 })())

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
