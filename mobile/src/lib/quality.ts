// Quality ladder (JS side) — the WebView half of the governor. The deciding
// logic is mirrored in crates/re-core/src/frame_budget.rs (single source of the
// numbers: packages/tokens/tokens.json → frameBudget). The native sampler
// (CADisplayLink / PresentationTimeAnimator) ships in R2; until then this
// rAF loop is the input, and `data-quality` on <html> drives the CSS.
import tokens from '../../../packages/tokens/dist/tokens.json'

export type Quality = 'full' | 'lean' | 'minimum'
const LADDER: Quality[] = ['full', 'lean', 'minimum']

interface Budget { budget: number; noHeadroom: number; cut: number }
export function budgets(refreshHz: number): Budget {
  const f = tokens.frameBudget as Record<string, Budget>
  return (refreshHz >= 110 ? f.hz120 : f.hz60)
}

interface Governor {
  quality: Quality
  over: number
  under: number
  refreshHz: number
  median: number
}

export function createGovernor(refreshHz: number) {
  const g: Governor = { quality: 'full', over: 0, under: 0, refreshHz, median: 0 }
  const window: number[] = []
  let raf = 0
  let last = 0

  const publish = (q: Quality) => {
    g.quality = q
    document.documentElement.dataset.quality = q
    listeners.forEach((fn) => fn(g))
  }
  const listeners = new Set<(g: Governor) => void>()

  const tick = (t: number) => {
    if (last) {
      const dt = t - last
      if (dt > 0 && dt < 1000) {
        window.push(dt)
        if (window.length > 120) window.shift()
        // median only every 30 frames to keep this loop itself free
        if (window.length % 30 === 0) decide()
      }
    }
    last = t
    raf = requestAnimationFrame(tick)
  }

  const decide = () => {
    const sorted = [...window].sort((a, b) => a - b)
    g.median = sorted[Math.floor(sorted.length / 2)]
    const b = budgets(g.refreshHz)
    if (g.median > b.cut) { g.over++; g.under = 0 } else if (g.median <= b.budget) { g.under++; g.over = 0 } else { g.over = 0; g.under = 0 }
    let q = g.quality
    if (g.over >= 2 && g.over % 2 === 0) q = LADDER[Math.min(LADDER.indexOf(q) + 1, 2)]
    else if (g.under >= 4 && g.under % 4 === 0) q = LADDER[Math.max(LADDER.indexOf(q) - 1, 0)]
    if (q !== g.quality) publish(q)
  }

  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick) } },
    stop() { cancelAnimationFrame(raf); raf = 0 },
    subscribe(fn: (g: Governor) => void) { listeners.add(fn); fn(g); return () => listeners.delete(fn) },
    get state() { return { ...g } },
    setRefresh(hz: number) { g.refreshHz = hz },
    // thermal / low-power inputs arrive with re-core (R2); pinned floors are
    // applied here so the UI can already honour a manual override:
    force(q: Quality | 'auto') { if (q === 'auto') return; publish(q) },
  }
}

export type QualityGovernor = ReturnType<typeof createGovernor>
