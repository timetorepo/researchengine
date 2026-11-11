/**
 * Will a model fit this machine? A rough, honest estimate, not a benchmark.
 *
 * A GGUF file is roughly parameters × bytes-per-parameter for its quantisation,
 * and running it needs room on top for the context cache and the runtime. The
 * constants below are the common rule of thumb for a default context length.
 * canirun.ai-style checkers do the same arithmetic; this one runs in the app, so
 * recommendations need no network call.
 */

export type Quant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'

export const QUANTS: { id: Quant; label: string; hint: string; bytesPerParam: number }[] = [
  { id: 'Q4_K_M', label: 'Q4', hint: 'Smallest that still works well. The default.', bytesPerParam: 0.6 },
  { id: 'Q5_K_M', label: 'Q5', hint: 'A little sharper, a little larger.', bytesPerParam: 0.7 },
  { id: 'Q8_0', label: 'Q8', hint: 'Close to the original. Roughly twice the Q4 memory.', bytesPerParam: 1.05 },
]

/** Context cache and runtime overhead at a default context length, in GB. */
export const OVERHEAD_GB = 1.2

export function estimateGB(paramsB: number, quant: Quant): number {
  const q = QUANTS.find((x) => x.id === quant) ?? QUANTS[0]
  return Math.round((paramsB * q.bytesPerParam + OVERHEAD_GB) * 10) / 10
}

export type Fit = 'comfortable' | 'tight' | 'too-heavy' | 'unknown'

/** The budget is the memory we are willing to give one model (see hardware.ts). */
export function fitFor(gb: number | null, budgetGB: number): Fit {
  if (gb === null) return 'unknown'
  if (gb <= budgetGB * 0.75) return 'comfortable'
  if (gb <= budgetGB) return 'tight'
  return 'too-heavy'
}

export const FIT_LABEL: Record<Fit, string> = {
  comfortable: 'Fits comfortably',
  tight: 'Tight',
  'too-heavy': 'Too heavy',
  unknown: 'Size unknown',
}

export interface Candidate { repo: string; paramsB: number | null }

/**
 * The model to suggest: the largest that fits comfortably, otherwise the largest
 * that fits tightly. Bigger is not always better for a given job, so this is a
 * starting point the person can change.
 */
export function recommend<T extends Candidate>(models: T[], budgetGB: number, quant: Quant): T | null {
  const sized = models
    .filter((m): m is T & { paramsB: number } => m.paramsB !== null)
    .map((m) => ({ m, fit: fitFor(estimateGB(m.paramsB, quant), budgetGB) }))
  const best = (fit: Fit) => sized.filter((x) => x.fit === fit).sort((a, b) => b.m.paramsB - a.m.paramsB)[0]?.m ?? null
  return best('comfortable') ?? best('tight')
}
