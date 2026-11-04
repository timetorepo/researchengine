/**
 * Turns the daily token totals into the columns the usage chart draws.
 *
 * The chart shows a fixed span of days split into equal buckets. Each bucket is one
 * column; its height is its value scaled to the largest bucket, so the shape reads the
 * same whatever the scale of the numbers. Everything here is pure, so it is tested
 * without the browser (scripts/usage-history-test.mts).
 */
export type UsageMetric = 'tokens' | 'active' | 'peak'

export interface UsageColumn {
  /** First and last local day in the bucket, YYYY-MM-DD. */
  start: string
  end: string
  /** The metric for this bucket. */
  value: number
  /** Days in the bucket that had any usage. */
  activeDays: number
}

export const USAGE_COLUMNS = 60

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

/** Columns covering the `span` days that end on `today`, oldest first. */
export function usageColumns(
  byDay: Record<string, number>,
  today: string,
  span = 364,
  buckets = USAGE_COLUMNS,
  metric: UsageMetric = 'tokens',
): UsageColumn[] {
  const first = addDays(today, -(span - 1))
  const perBucket = span / buckets
  const cols: UsageColumn[] = []
  for (let b = 0; b < buckets; b++) {
    const startOffset = Math.floor(b * perBucket)
    // The last bucket runs to the end of the span, so no day is dropped by rounding.
    const endExclusive = b === buckets - 1 ? span : Math.floor((b + 1) * perBucket)
    const endOffset = Math.max(startOffset, endExclusive - 1)
    const start = addDays(first, startOffset)
    const end = addDays(first, endOffset)
    let sum = 0
    let active = 0
    let peak = 0
    for (let o = startOffset; o <= endOffset; o++) {
      const n = byDay[addDays(first, o)] ?? 0
      sum += n
      if (n > 0) active++
      if (n > peak) peak = n
    }
    const value = metric === 'tokens' ? sum : metric === 'active' ? active : peak
    cols.push({ start, end, value, activeDays: active })
  }
  return cols
}

/** Column heights from 0 to `rows`, scaled to the largest value. A non-zero value always gets at least one row. */
export function columnHeights(cols: UsageColumn[], rows: number): number[] {
  const max = Math.max(0, ...cols.map((c) => c.value))
  return cols.map((c) => {
    if (c.value <= 0 || max <= 0) return 0
    return Math.max(1, Math.round((c.value / max) * rows))
  })
}

export interface UsageSummary {
  total: number
  activeDays: number
  averagePerActiveDay: number
  peakDay: { day: string; tokens: number } | null
}

/** Totals for the whole span, used by the summary row. */
export function summarizeUsage(byDay: Record<string, number>, today: string, span = 364): UsageSummary {
  const first = addDays(today, -(span - 1))
  let total = 0
  let activeDays = 0
  let peakDay: UsageSummary['peakDay'] = null
  for (let o = 0; o < span; o++) {
    const day = addDays(first, o)
    const n = byDay[day] ?? 0
    total += n
    if (n > 0) {
      activeDays++
      if (!peakDay || n > peakDay.tokens) peakDay = { day, tokens: n }
    }
  }
  return { total, activeDays, averagePerActiveDay: activeDays ? Math.round(total / activeDays) : 0, peakDay }
}

/** "1.2M", "48.3K", "950" — compact numbers for labels. */
export function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(Math.round(n))
}
