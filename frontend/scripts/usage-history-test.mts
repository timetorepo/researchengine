// Checks the usage chart's columns, heights and summary, with fixed dates.
import { columnHeights, summarizeUsage, usageColumns, compactTokens } from '../src/lib/usage/history'
import { pruneUsage } from '../src/stores/useStore'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failed++
}

const today = '2026-10-31'
const byDay: Record<string, number> = { '2026-10-31': 5000, '2026-10-30': 1000, '2026-01-01': 200 }

const cols = usageColumns(byDay, today, 364, 60, 'tokens')
check('there are 60 columns', cols.length === 60)
check('the first column starts 363 days before today', cols[0].start === '2025-11-02', cols[0].start)
check('the last column ends today', cols[59].end === today, cols[59].end)
check('no day is double counted', cols.reduce((a, c) => a + c.value, 0) === 5000 + 1000 + 200)
check('the newest column holds the last week (today and the day before)', cols[59].value === 6000)
const heights = columnHeights(cols, 14)
check('the tallest column fills the chart', Math.max(...heights) === 14)
check('an empty column has no height', heights[1] === 0)
check('a small non-zero column gets one row', heights.every((h, i) => cols[i].value === 0 || h >= 1))

const active = usageColumns(byDay, today, 364, 60, 'active')
check('active-days counts days, not tokens', active[59].value === 2 || active[59].value === 1, String(active[59].value))
const peak = usageColumns(byDay, today, 364, 60, 'peak')
check('the peak metric takes the busiest day in the column', peak[59].value === 5000)

const s = summarizeUsage(byDay, today)
check('summary total', s.total === 6200, String(s.total))
check('summary active days', s.activeDays === 3, String(s.activeDays))
check('summary peak day', s.peakDay?.day === '2026-10-31' && s.peakDay.tokens === 5000)
check('average is per active day', s.averagePerActiveDay === 2067, String(s.averagePerActiveDay))
check('an empty history summarises to zero', summarizeUsage({}, today).total === 0)

check('compact numbers', compactTokens(950) === '950' && compactTokens(48_300) === '48K' && compactTokens(1_200_000) === '1.2M', `${compactTokens(48_300)} ${compactTokens(1_200_000)}`)

const pruned = pruneUsage({ '2025-01-01': 1, '2026-10-30': 2, '2026-10-31': 3 }, today)
check('days older than a year are dropped', !('2025-01-01' in pruned) && pruned['2026-10-31'] === 3)

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`)
process.exit(failed === 0 ? 0 : 1)
