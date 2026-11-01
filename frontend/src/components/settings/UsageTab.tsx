/**
 * Settings → Usage: tokens per day over the last year, drawn as a column chart.
 *
 * The chart idea (a grid of small cells, one column per bucket of days, a dashed
 * guide and a tooltip that follows the pointer) follows the morphin.dev dashboard
 * chart. It is rebuilt here with the app's own tokens and styles rather than copied:
 * the app has no shadcn/AlignUI layer, so the markup is plain and the numbers are real.
 */
import React, { useMemo, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { AnimatedCounter } from '@/components/ui/kit/rareui/AnimatedCounter'
import { ReceiptPrinter } from '@/components/ui/kit/dqnamo/ReceiptPrinter'
import { localDay } from '@/lib/usage/day'
import {
  columnHeights, compactTokens, summarizeUsage, usageColumns, USAGE_COLUMNS, type UsageMetric,
} from '@/lib/usage/history'

const ROWS = 14
const METRICS: { id: UsageMetric; label: string; unit: string }[] = [
  { id: 'tokens', label: 'Tokens', unit: 'tokens' },
  { id: 'active', label: 'Active days', unit: 'days with usage' },
  { id: 'peak', label: 'Busiest day', unit: 'tokens on the busiest day' },
]

function fmtDay(day: string): string {
  const d = new Date(`${day}T00:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function UsageTab() {
  const byDay = useStore((s) => s.usageByDay)
  const [metric, setMetric] = useState<UsageMetric>('tokens')
  const [active, setActive] = useState<number | null>(null)
  const today = localDay()

  const cols = useMemo(() => usageColumns(byDay, today, 364, USAGE_COLUMNS, metric), [byDay, today, metric])
  const heights = useMemo(() => columnHeights(cols, ROWS), [cols])
  const summary = useMemo(() => summarizeUsage(byDay, today), [byDay, today])
  const selected = active ?? cols.length - 1
  const col = cols[selected]
  const meta = METRICS.find((m) => m.id === metric)!
  const shown = (n: number) => (metric === 'active' ? String(n) : compactTokens(n))
  const months = useMemo(() => {
    // One label at the first column of each month, so the axis reads without crowding.
    const out: { index: number; label: string }[] = []
    let last = ''
    cols.forEach((c, i) => {
      const m = c.start.slice(0, 7)
      if (m !== last) { out.push({ index: i, label: new Date(`${c.start}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }) }); last = m }
    })
    return out
  }, [cols])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Usage</h2>
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
          Tokens this app sent and received, per day, for the last year. Counted on this computer; nothing is sent anywhere to count it.
        </p>
      </div>

      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{meta.label}, last 12 months</div>
            <div className="font-mono text-[22px] font-medium">
              {metric === 'tokens' ? <AnimatedCounter value={summary.total} /> : metric === 'active' ? String(summary.activeDays) : compactTokens(summary.peakDay?.tokens ?? 0)}
            </div>
          </div>
          <div role="tablist" aria-label="Chart metric" className="flex gap-1 rounded-full p-1" style={{ background: 'var(--elevated)' }}>
            {METRICS.map((m) => (
              <button key={m.id} role="tab" aria-selected={metric === m.id} onClick={() => { setMetric(m.id); setActive(null) }}
                className="px-3 py-1 rounded-full text-[12px]"
                style={{ background: metric === m.id ? 'var(--surface)' : 'transparent', color: metric === m.id ? 'var(--text)' : 'var(--text-3)' }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {summary.total === 0 ? (
          <p className="text-[12.5px] py-10 text-center" style={{ color: 'var(--text-3)' }}>
            No usage yet. Send a message with a provider key and the days will fill in here.
          </p>
        ) : (
          <>
            <div
              className="relative grid h-[180px] cursor-crosshair"
              style={{ gridTemplateColumns: `repeat(${USAGE_COLUMNS}, minmax(0, 1fr))`, gap: 2 }}
              onMouseLeave={() => setActive(null)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const i = Math.min(USAGE_COLUMNS - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * USAGE_COLUMNS)))
                setActive(i)
              }}
              role="img"
              aria-label={`${meta.label} per column, ${cols.length} columns over the last year. Hover to read a column.`}
            >
              {cols.map((c, i) => (
                <div key={i} className="grid h-full grid-rows-[repeat(14,minmax(0,1fr))] gap-[2px]">
                  {Array.from({ length: ROWS }, (_, row) => {
                    const on = row >= ROWS - heights[i]
                    return (
                      <div key={row} className="rounded-[2px]"
                        style={{ background: on ? (i === selected ? 'var(--primary)' : 'var(--text-2)') : 'var(--elevated)', opacity: on ? 1 : 0.7 }} />
                    )
                  })}
                </div>
              ))}
              {col && (
                <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed" style={{ left: `${((selected + 0.5) / USAGE_COLUMNS) * 100}%`, borderColor: 'var(--text-3)' }} />
              )}
              {col && (
                <div className="pointer-events-none absolute top-2 w-44 rounded-[10px] px-3 py-2 text-[12px] shadow-md"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', left: selected > USAGE_COLUMNS - 12 ? undefined : `${((selected + 0.5) / USAGE_COLUMNS) * 100}%`, right: selected > USAGE_COLUMNS - 12 ? `${(1 - (selected + 0.5) / USAGE_COLUMNS) * 100}%` : undefined, transform: selected > USAGE_COLUMNS - 12 ? 'translateX(-8px)' : 'translateX(8px)' }}>
                  <div style={{ color: 'var(--text-3)' }}>{fmtDay(col.start)}{col.end !== col.start ? ` – ${fmtDay(col.end)}` : ''}</div>
                  <div className="font-mono text-[15px] font-semibold">{shown(col.value)}</div>
                  <div style={{ color: 'var(--text-3)' }}>{meta.unit}{metric === 'tokens' ? ` · ${col.activeDays} active` : ''}</div>
                </div>
              )}
            </div>
            <div className="relative h-4 mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
              {months.map((m) => (
                <span key={m.index} className="absolute" style={{ left: `${(m.index / USAGE_COLUMNS) * 100}%` }}>{m.label}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <h3 className="text-[14px] font-semibold mb-2">Today</h3>
        <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>
          {compactTokens(byDay[today] ?? 0)} tokens today. Average on an active day: {compactTokens(summary.averagePerActiveDay)}.
          {summary.peakDay ? ` Busiest day: ${fmtDay(summary.peakDay.day)} with ${compactTokens(summary.peakDay.tokens)}.` : ''}
        </p>
        <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>
          The daily token budget is set under Settings → AIFlowEngine. Providers bill their own tokens; this page counts what the app saw.
        </p>
      </section>

      <section aria-label="Usage receipt" className="max-w-md">
        <ReceiptPrinter
          title="Research Engine · usage"
          lines={[
            { label: 'Tokens, 12 months', value: summary.total.toLocaleString() },
            { label: 'Active days', value: String(summary.activeDays) },
            { label: 'Busiest day', value: summary.peakDay ? `${fmtDay(summary.peakDay.day)} · ${summary.peakDay.tokens.toLocaleString()}` : 'none yet' },
          ]}
          footer="Counted on this computer."
        />
      </section>
    </div>
  )
}
