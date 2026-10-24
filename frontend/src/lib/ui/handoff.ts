/**
 * One set of motion numbers, and the home → chat handover built from them.
 *
 * The complaint this answers was not "add an animation" — it was that the
 * pieces moved at different speeds, so a transition read as three unrelated
 * events. Timings therefore live here, in one place, and the surfaces that
 * participate in a handover import them instead of inventing their own.
 */
import { useUI } from '@/stores/useUI'

/** Durations, in seconds, for motion/react's `transition.duration`. */
export const DUR = {
  /** State changes inside a control — a tint, a tick, a pressed row. */
  fast: 0.14,
  /** The default for something arriving or leaving. */
  base: 0.26,
  /** A whole view changing place. */
  slow: 0.38,
} as const

/** The standard curve: fast out of the gate, long settle. */
export const EASE = [0.32, 0.72, 0, 1] as const
/** For things that fade rather than travel. */
export const EASE_OUT = 'easeOut' as const

/**
 * How long the home screen spends blurring before the chat page takes over
 * (milliseconds). The route's own entry fade (`DUR.base`) starts underneath
 * while this is still finishing, which is what makes the two overlap into one
 * movement instead of a cut followed by a fade.
 */
export const HANDOFF_BLUR_MS = 190

/** Begin the handover: the home view blurs, then the chat opens. */
export function beginHandoff(chatId: string, prompt: string): void {
  useUI.setState({ handoff: { chatId, prompt, at: Date.now() } })
}

/** The chat has arrived — let the home view settle back for the next visit. */
export function endHandoff(): void {
  const current = useUI.getState().handoff
  if (current) useUI.setState({ handoff: null })
}
