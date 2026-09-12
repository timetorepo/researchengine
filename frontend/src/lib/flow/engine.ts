// AIFlowEngine — the streaming engine.
//
// Three responsibilities:
//   1. Token efficiency (classifier/pruner/cache live alongside in lib/flow)
//   2. Stream shaping — raw provider bursts are smoothed into a composed,
//      word-by-word cadence so responses feel written, not dumped
//   3. Continuity — pipeline stages are surfaced to the UI so the thinking
//      indicator always reflects what is actually happening
//
// Architecture: raw tokens enter a ring buffer with arrival timestamps; a
// requestAnimationFrame pacer draws from the buffer at a shaped rate with
// word-level micro-timing (30–80ms between words, longer pauses after
// punctuation, line-wise reveals inside code fences). Rendering NEVER reads
// the raw stream directly.

export type FlowStage =
  | 'understand' | 'search' | 'read-sources' | 'retrieve' | 'think' | 'compose' | 'done'

export const STAGE_LABELS: Record<FlowStage, string> = {
  understand: 'Understanding your question',
  search: 'Searching the web',
  'read-sources': 'Reading sources',
  retrieve: 'Retrieving from your notebook',
  think: 'Thinking',
  compose: 'Composing response',
  done: '',
}

export type ShapingMode = 'off' | 'subtle' | 'standard' | 'cinematic'
export type ThinkingStyle = 'minimal' | 'standard' | 'verbose'

export interface ShapeConfig {
  shaping: ShapingMode
  /** 0..1 — how aggressively the pacer accelerates when the buffer grows */
  sensitivity: number
  punctuationPauses: boolean
}

/** Per-mode micro-timing (ms). */
const TIMING: Record<ShapingMode, { word: [number, number]; punct: [number, number]; newline: number }> = {
  off: { word: [0, 0], punct: [0, 0], newline: 0 },
  subtle: { word: [15, 40], punct: [50, 90], newline: 110 },
  standard: { word: [30, 80], punct: [100, 160], newline: 200 },
  cinematic: { word: [60, 120], punct: [160, 240], newline: 300 },
}

// rAF with a timer fallback so the engine survives headless harnesses (smoke tests).
// Resolved lazily per call — test harnesses may install rAF after import.
const raf = (cb: FrameRequestCallback): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : (setTimeout(() => cb(performance.now()), 16) as unknown as number)
const caf = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  else clearTimeout(id)
}

const RATE_WINDOW_MS = 500        // rolling arrival-rate window
const STALL_MS = 250               // dry buffer -> stream stall
const SPEEDUP_BUFFER_WORDS = 40    // start accelerating past this depth
const MIN_WORD_GAP_MS = 10         // capped acceleration — never "dump"

export interface FlowStats {
  firstTokenMs: number
  totalMs: number
  words: number
  stalls: number
  avgArrivalRate: number
  avgRenderRate: number
}

export interface FlowHooks {
  onStageChange?: (stage: FlowStage) => void
  onFirstToken?: () => void
  onStreamStall?: () => void
  onStreamResume?: () => void
  onComplete?: (stats: FlowStats) => void
}

/* ---------------- diagnostics (raw vs rendered rate samples) ---------------- */
export interface DiagSample { t: number; arrival: number; rendered: number }

class Diagnostics {
  samples: DiagSample[] = []
  private diagTimer: any = null
  active = false
  begin() {
    this.samples = []
    this.active = true
    this.diagTimer = setInterval(() => {
      const r = activeRun
      if (!r) return
      this.samples.push({ t: performance.now(), arrival: r.arrivalRate(), rendered: r.recentRenderRate() })
      if (this.samples.length > 600) this.samples.shift()
    }, 200)
  }
  end() { this.active = false; if (this.diagTimer) clearInterval(this.diagTimer); this.diagTimer = null }
}
export const flowDiagnostics = new Diagnostics()

/* --------------------------------- shaper ---------------------------------- */
interface EmitItem { text: string; delay: number }

export class StreamShaper {
  private queue: EmitItem[] = []
  private arrivalTimes: number[] = []
  private pending = ''            // raw text not yet tokenized into items
  private inCodeFence = false
  private startedAt = 0
  private firstTokenAt = 0
  private lastRenderAt = 0
  private lastEmitCount = 0
  private rawDone = false
  private finished = false
  private raf = 0
  private nextEmitAt = 0
  private emittedWords = 0
  private stalls = 0
  private stalled = false
  private renderTimes: number[] = []
  private totalArrived = 0

  constructor(
    private cfg: ShapeConfig,
    private flush: (text: string) => void,
    private hooks: FlowHooks = {},
  ) {}

  /* ---- ingestion ---- */
  ingest(chunk: string) {
    const now = performance.now()
    if (!this.startedAt) this.startedAt = now
    if (!this.firstTokenAt) {
      this.firstTokenAt = now
      this.hooks.onFirstToken?.()
      if (this.cfg.shaping === 'off') {
        // Off: pass-through, but keep the hook contract
        this.flush(chunk)
        this.emittedWords += chunk.split(/\s+/).filter(Boolean).length
        this.arrivalTimes.push(now)
        return
      }
    }
    this.arrivalTimes.push(now)
    this.totalArrived++
    this.pending += chunk
    if (this.stalled) {
      this.stalled = false
      this.hooks.onStreamResume?.()
    }
    this.tokenize()
  }

  /** Raw stream ended — the pacer keeps draining until the queue is empty. */
  endRaw() {
    this.rawDone = true
    if (this.cfg.shaping === 'off') this.complete()
  }

  abort() {
    this.finished = true
    caf(this.raf)
    flowDiagnostics.end()
  }

  start() {
    if (this.cfg.shaping === 'off') return
    this.lastRenderAt = performance.now()
    flowDiagnostics.begin()
    const tick = () => {
      if (this.finished) return
      this.pace()
      this.raf = raf(tick)
    }
    this.raf = raf(tick)
  }

  /* ---- rates ---- */
  arrivalRate(): number {
    const now = performance.now()
    this.arrivalTimes = this.arrivalTimes.filter((t) => now - t <= RATE_WINDOW_MS)
    return this.arrivalTimes.length * (1000 / RATE_WINDOW_MS)
  }
  recentRenderRate(): number {
    const now = performance.now()
    this.renderTimes = this.renderTimes.filter((t) => now - t <= RATE_WINDOW_MS)
    return this.renderTimes.length * (1000 / RATE_WINDOW_MS)
  }

  /* ---- tokenization: pending raw text -> emit items with micro-timing ---- */
  private tokenize() {
    const t = TIMING[this.cfg.shaping]
    const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0])

    while (this.pending.length > 0) {
      if (this.inCodeFence) {
        const nl = this.pending.indexOf('\n')
        if (nl === -1) {
          // keep buffering unless the raw stream ended
          if (this.rawDone) { this.queue.push({ text: this.pending, delay: 12 }); this.pending = '' }
          break
        }
        const line = this.pending.slice(0, nl + 1)
        this.pending = this.pending.slice(nl + 1)
        if (line.trimStart().startsWith('```')) this.inCodeFence = false
        // code reveals line-by-line, quickly, never mid-line
        this.queue.push({ text: line, delay: 16 })
        continue
      }

      // fence opener on the plain path
      if (this.pending.startsWith('```')) {
        const nl = this.pending.indexOf('\n')
        if (nl === -1 && !this.rawDone) break // wait for the language tag line to finish arriving
        const cut = nl === -1 ? this.pending.length : nl + 1
        this.queue.push({ text: this.pending.slice(0, cut), delay: t.newline })
        this.pending = this.pending.slice(cut)
        this.inCodeFence = true
        continue
      }

      const m = /^\s*\S+\s*/.exec(this.pending)
      if (!m) { // whitespace only
        if (this.rawDone) { this.queue.push({ text: this.pending, delay: 8 }); this.pending = '' }
        break
      }
      const word = m[0]
      this.pending = this.pending.slice(word.length)

      let delay = rand(t.word)
      const core = word.trimEnd()
      if (this.cfg.punctuationPauses && /[.?!:;,]$/.test(core)) delay = rand(t.punct)
      if (word.includes('\n')) delay = Math.max(delay, t.newline)
      this.queue.push({ text: word, delay })
    }
  }

  /* ---- pacing: fixed rAF cadence, never per-token ---- */
  private pace() {
    const now = performance.now()

    // stall detection: queue dry + raw still open
    if (this.queue.length === 0 && !this.rawDone && this.firstTokenAt && now - this.lastRenderAt > STALL_MS && !this.stalled) {
      this.stalled = true
      this.stalls++
      this.hooks.onStreamStall?.()
    }

    if (this.queue.length === 0) {
      if (this.rawDone) this.complete()
      return
    }

    // backpressure: accelerate smoothly when the buffer grows (capped)
    let speedup = 1
    if (this.queue.length > SPEEDUP_BUFFER_WORDS) {
      const excess = this.queue.length - SPEEDUP_BUFFER_WORDS
      const aggr = 0.35 + this.cfg.sensitivity * 0.65 // sensitivity shapes acceleration
      speedup = 1 + Math.min(3, (excess / 25) * aggr)
    }

    if (now < this.nextEmitAt) return

    // emit everything that is due this frame
    let out = ''
    while (this.queue.length > 0 && now >= this.nextEmitAt) {
      const item = this.queue.shift()!
      out += item.text
      this.emittedWords++
      this.renderTimes.push(now)
      const gap = Math.max(MIN_WORD_GAP_MS, item.delay / speedup)
      this.nextEmitAt = Math.max(now, this.nextEmitAt) + gap
    }
    if (out) {
      this.flush(out)
      this.lastRenderAt = now
    }
  }

  private complete() {
    if (this.finished) return
    this.finished = true
    caf(this.raf)
    flowDiagnostics.end()
    const now = performance.now()
    this.hooks.onComplete?.({
      firstTokenMs: Math.round(this.firstTokenAt - this.startedAt),
      totalMs: Math.round(now - this.startedAt),
      words: this.emittedWords,
      stalls: this.stalls,
      avgArrivalRate: Math.round(this.totalArrived / Math.max(0.001, (now - this.startedAt) / 1000)),
      avgRenderRate: Math.round(this.recentRenderRate()),
    })
  }
}

/* ------------------------------ run orchestrator ---------------------------- */
let activeRun: FlowRun | null = null
export const getActiveRun = () => activeRun

export class FlowRun {
  stage: FlowStage = 'understand'
  private shaper: StreamShaper

  constructor(private cfg: ShapeConfig, flush: (text: string) => void, private hooks: FlowHooks = {}) {
    this.shaper = new StreamShaper(cfg, flush, {
      ...hooks,
      onFirstToken: () => { this.setStage('compose'); hooks.onFirstToken?.() },
    })
    activeRun = this
  }

  arrivalRate() { return this.shaper['arrivalRate']() }
  recentRenderRate() { return this.shaper['recentRenderRate']() }

  setStage(stage: FlowStage) {
    if (this.stage === stage) return
    this.stage = stage
    this.hooks.onStageChange?.(stage)
  }

  begin() { this.shaper.start() }
  ingest(chunk: string) { this.shaper.ingest(chunk) }
  endRaw() { this.shaper.endRaw() }
  abort() {
    this.shaper.abort()
    if (activeRun === this) activeRun = null
  }
  finish() {
    if (activeRun === this) activeRun = null
  }
}

export function createFlowRun(cfg: ShapeConfig, flush: (text: string) => void, hooks: FlowHooks = {}) {
  return new FlowRun(cfg, flush, hooks)
}

export function shapeConfigFrom(settings: {
  flowShaping?: ShapingMode; pacingSensitivity?: number; punctuationPauses?: boolean
}): ShapeConfig {
  return {
    shaping: settings.flowShaping ?? 'standard',
    sensitivity: settings.pacingSensitivity ?? 0.5,
    punctuationPauses: settings.punctuationPauses ?? true,
  }
}
