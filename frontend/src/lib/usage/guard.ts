// Daily token budget. A runaway loop (an agent that keeps calling tools, a bot
// that keeps replying) costs money on real providers, so each day's real token
// use is counted and new real requests stop at the limit the user chose.
// The on-device engine is free and never counts.
import { useStore } from '@/stores/useStore'
import { localDay } from './day'

export { localDay }

/** Choices offered in Settings. 0 means no limit. */
export const DAILY_BUDGET_CHOICES = [0, 1_000_000, 2_000_000, 5_000_000, 10_000_000] as const
export const DEFAULT_DAILY_BUDGET = 2_000_000


export interface BudgetState {
  limit: number
  used: number
  /** off: no limit · ok · warn: over 80% · blocked: at or over the limit */
  state: 'off' | 'ok' | 'warn' | 'blocked'
}

export function budgetState(): BudgetState {
  const s = useStore.getState()
  const limit = s.settings.dailyTokenBudget ?? DEFAULT_DAILY_BUDGET
  const used = s.dailyUsage.day === localDay() ? s.dailyUsage.tokens : 0
  if (!limit) return { limit, used, state: 'off' }
  if (used >= limit) return { limit, used, state: 'blocked' }
  if (used >= limit * 0.8) return { limit, used, state: 'warn' }
  return { limit, used, state: 'ok' }
}

export class BudgetExceededError extends Error {
  readonly status = 429
  constructor(limit: number) {
    super(`Daily token budget reached (${limit.toLocaleString()} tokens). Raise it in Settings → AIFlowEngine, or try again tomorrow. The on-device engine still works.`)
    this.name = 'BudgetExceededError'
  }
}

/** Throw before a real request if today's budget is already spent. */
export function assertBudget(): void {
  const b = budgetState()
  if (b.state === 'blocked') throw new BudgetExceededError(b.limit)
}

/** Count real tokens used. Called once per finished request. */
export function recordTokens(total: number): void {
  if (!(total > 0)) return
  useStore.getState().addDailyTokens(total)
}
