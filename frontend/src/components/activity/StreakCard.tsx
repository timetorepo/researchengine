import { useMemo } from 'react'
import { Flame, Star, Trophy, Check } from 'lucide-react'
import { useActivity, dayKey, streakOf, STREAK_MINUTES, FOCUS_LEVELS } from '@/lib/activity/tracker'

const BADGE_NAMES: Record<string, string> = {
  'focus-25': 'Deep focus',
  'focus-60': 'An hour of work',
}

/**
 * The streak, as Duolingo shows it: the flame, the last seven days with a tick
 * on every day that counted, today's minutes toward the focus goal, and the
 * badges already earned.
 */
export function StreakCard({ compact = false }: { compact?: boolean }) {
  const days = useActivity((s) => s.days)
  const badges = useActivity((s) => s.badges)
  const streak = useMemo(() => streakOf(days), [days])
  const today = days[dayKey()] ?? 0
  const goal = FOCUS_LEVELS[0].minutes
  const pct = Math.min(100, Math.round((today / goal) * 100))

  const week = useMemo(() => {
    const out: { key: string; label: string; ok: boolean; today: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const t = Date.now() - i * 86_400_000
      const key = dayKey(t)
      out.push({
        key,
        label: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
        ok: (days[key] ?? 0) >= STREAK_MINUTES,
        today: i === 0,
      })
    }
    return out
  }, [days])

  return (
    <div className={`surface ${compact ? 'p-3' : 'p-4'} rounded-[18px]`} data-ui="streak-card">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: streak ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'var(--elevated)', color: streak ? 'var(--warning)' : 'var(--text-3)' }}>
          <Flame size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tabular-nums" style={{ letterSpacing: '-0.01em' }}>
            {streak} day streak
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {today >= goal
              ? 'Focus goal met today.'
              : `${Math.floor(today)} of ${goal} focus minutes today. Coding, study and writing count.`}
          </div>
        </div>
        <div className="relative w-11 h-11 shrink-0" aria-label={`${pct}% of today's focus goal`}>
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--elevated)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--warning)" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 94.2} 94.2`} style={{ transition: 'stroke-dasharray 600ms ease' }} />
          </svg>
          <Star size={12} className="absolute inset-0 m-auto" style={{ color: 'var(--warning)' }} />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {week.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{
                background: d.ok ? 'var(--warning)' : 'var(--elevated)',
                color: d.ok ? '#fff' : 'var(--text-3)',
                outline: d.today ? '2px solid var(--text-3)' : 'none',
                outlineOffset: 2,
              }}>
              {d.ok ? <Check size={12} strokeWidth={3} /> : ''}
            </span>
            <span className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{d.label}</span>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <Trophy size={12} style={{ color: 'var(--text-3)' }} />
          {badges.length === 0 && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Badges show here as you earn them.</span>}
          {badges.slice(-6).map((b) => (
            <span key={b.id + b.at} className="px-2 py-0.5 rounded-full text-[10.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              {BADGE_NAMES[b.id] ?? (b.id.startsWith('streak-') ? `${b.id.slice(7)}-day streak` : b.id)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
