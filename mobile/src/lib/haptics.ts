// Haptics (docs/mobile/07-haptics-and-sound.md). Single table, event → pattern.
// On Android WebView `navigator.vibrate` is the transport; on iOS Tauri the
// native `haptic` command is used when present. Everything degrades to no-op —
// haptics never carry information alone (07 rule).
export type HapticEvent =
  | 'press' | 'menu-open' | 'detent' | 'send' | 'quiz-correct' | 'quiz-wrong'
  | 'streak' | 'timer-end' | 'highlight' | 'citation' | 'error' | 'paired' | 'agent-done'

const PATTERNS: Record<HapticEvent, { ios: 'light' | 'medium' | 'heavy' | 'notification'; ms: number[] }> = {
  'press':         { ios: 'light', ms: [8] },
  'menu-open':     { ios: 'light', ms: [10, 30, 10] },
  'detent':        { ios: 'light', ms: [6] },
  'send':          { ios: 'medium', ms: [14] },
  'quiz-correct':  { ios: 'light', ms: [10] },
  'quiz-wrong':    { ios: 'medium', ms: [20, 30, 20] },
  'streak':        { ios: 'light', ms: [8, 30, 8] },
  'timer-end':     { ios: 'notification', ms: [20, 80, 20, 80, 40] },
  'highlight':     { ios: 'light', ms: [8] },
  'citation':      { ios: 'light', ms: [6] },
  'error':         { ios: 'heavy', ms: [40, 30, 40] },
  'paired':        { ios: 'notification', ms: [15, 60, 15] },
  'agent-done':    { ios: 'light', ms: [10] },
}

let enabled = true
export const setHapticsEnabled = (v: boolean) => { enabled = v }

export async function haptic(event: HapticEvent) {
  if (!enabled) return
  const p = PATTERNS[event]
  const w = window as any
  try {
    if (w.__TAURI__?.core?.invoke) { await w.__TAURI__.core.invoke('haptic', { event, pattern: p.ios }); return }
  } catch { /* fall through to web transport */ }
  try { navigator.vibrate?.(p.ms) } catch { /* no transport, no problem */ }
}
