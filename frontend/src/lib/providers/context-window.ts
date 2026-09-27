/**
 * How full a model's window is.
 *
 * Providers do not report the window over the API, and model names change
 * faster than any table can, so this is a family lookup with an honest default
 * — not a promise. The UI that shows it says the number is an estimate.
 */
export const DEFAULT_CONTEXT_WINDOW = 128_000

const FAMILIES: [RegExp, number][] = [
  [/gemini/i, 1_000_000],
  [/claude|sonnet|opus|haiku/i, 200_000],
  [/mistral|mixtral|codestral/i, 32_000],
]

export function contextWindowFor(model?: string): number {
  if (!model) return DEFAULT_CONTEXT_WINDOW
  for (const [re, size] of FAMILIES) if (re.test(model)) return size
  return DEFAULT_CONTEXT_WINDOW
}
