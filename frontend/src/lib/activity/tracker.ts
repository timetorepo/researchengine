/**
 * Focus streak and rewards, after the idea in Opal (the screen-time app): the
 * app rewards time spent doing the work, not time spent with the app open.
 *
 * A moment counts as active only when all of these hold:
 *  - the tab is visible,
 *  - the person pressed, typed or scrolled in the last two minutes, and
 *  - the current view is one where work happens: a quiz or lesson, coding,
 *    reading a source, chatting or writing an article, or a workflow.
 * A dashboard left open, or the home page with nothing going on, earns nothing.
 *
 * Rewards: XP for each active minute (through the same XP the lessons use), a
 * streak for every day with five active minutes, and badges for focus
 * sessions (25 and 60 minutes in one day) and for streak milestones. Everything
 * is kept on this device.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useUI, type ActivityKind } from '@/stores/useUI'
import { awardXp } from '@/lib/learn/path'

export const STREAK_MINUTES = 5
const IDLE_MS = 120_000
export const TICK_MS = 15_000
const WORK_KINDS: ActivityKind[] = ['quiz', 'coding', 'reading', 'chat', 'articles', 'workflows', 'flood']

export interface EarnedBadge { id: string; at: number }

export interface ActivityState {
  /** Active minutes per local day, keyed YYYY-MM-DD. */
  days: Record<string, number>
  badges: EarnedBadge[]
  /** Focus badges already given today, so a session earns each one once. */
  todayBadges: Record<string, string[]>
  lastXpMinute: number
}

interface ActivityActions {
  addMinutes: (day: string, minutes: number) => void
  earn: (id: string, day: string) => boolean
}

export const useActivity = create<ActivityState & ActivityActions>()(
  persist(
    (set, get) => ({
      days: {},
      badges: [],
      todayBadges: {},
      lastXpMinute: 0,
      addMinutes: (day, minutes) =>
        set((s) => ({ days: { ...s.days, [day]: Math.round(((s.days[day] ?? 0) + minutes) * 100) / 100 } })),
      earn: (id, day) => {
        const s = get()
        const today = s.todayBadges[day] ?? []
        if (today.includes(id)) return false
        set({ todayBadges: { ...s.todayBadges, [day]: [...today, id] }, badges: [...s.badges, { id, at: Date.now() }] })
        return true
      },
    }),
    { name: 're.activity.v1', storage: createJSONStorage(() => localStorage) },
  ),
)

export const dayKey = (t = Date.now()) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive qualifying days ending today. Today counts only once it qualifies. */
export function streakOf(days: Record<string, number>, now = Date.now()): number {
  let n = 0
  let t = now
  if ((days[dayKey(t)] ?? 0) < STREAK_MINUTES) t -= 86_400_000
  while ((days[dayKey(t)] ?? 0) >= STREAK_MINUTES) {
    n++
    t -= 86_400_000
  }
  return n
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 100]
export const FOCUS_LEVELS = [
  { minutes: 25, id: 'focus-25', title: 'Deep focus', body: '25 active minutes today. The streak is safe and the day is yours.', xp: 25 },
  { minutes: 60, id: 'focus-60', title: 'An hour of real work', body: '60 active minutes in one day.', xp: 60 },
]

let lastInput = 0
let started = false
let timer: number | undefined

/** Start the tracker once for the whole app. Returns a stop function. */
export function startActivityTracker(): () => void {
  if (started || typeof window === 'undefined') return () => {}
  started = true
  const mark = () => { lastInput = Date.now() }
  const opts: AddEventListenerOptions = { passive: true, capture: true }
  window.addEventListener('pointerdown', mark, opts)
  window.addEventListener('keydown', mark, opts)
  window.addEventListener('scroll', mark, opts)
  timer = window.setInterval(tick, TICK_MS)

  return () => {
    window.removeEventListener('pointerdown', mark, opts)
    window.removeEventListener('keydown', mark, opts)
    window.removeEventListener('scroll', mark, opts)
    if (timer) window.clearInterval(timer)
    started = false
  }
}

/** Is this moment active by the rules above? Exported so the rules are testable. */
export function isActive(opts: { visible: boolean; lastInput: number; kind: ActivityKind; now: number }): boolean {
  return opts.visible && opts.now - opts.lastInput < IDLE_MS && WORK_KINDS.includes(opts.kind)
}

function tick() {
  const now = Date.now()
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  const kind = useUI.getState().activity?.kind ?? 'idle'
  if (!isActive({ visible, lastInput, kind, now })) return

  const day = dayKey(now)
  const before = useActivity.getState().days[day] ?? 0
  const minutes = TICK_MS / 60_000
  useActivity.getState().addMinutes(day, minutes)
  const after = before + minutes

  // one XP per whole active minute, as the lessons give
  const wholeMinutes = Math.floor(after)
  if (wholeMinutes > Math.floor(before)) awardXp(1)

  const ui = useUI.getState()
  if (before < STREAK_MINUTES && after >= STREAK_MINUTES) {
    const days = { ...useActivity.getState().days }
    const streak = streakOf(days, now)
    ui.toast('Streak kept', `${streak} day${streak === 1 ? '' : 's'} in a row. Five active minutes is all a day needs.`, 'success')
    if (STREAK_MILESTONES.includes(streak) && useActivity.getState().earn(`streak-${streak}`, day)) {
      awardXp(streak * 5)
      ui.toast(`${streak}-day streak`, 'A badge for keeping the streak going.', 'success')
    }
  }
  for (const level of FOCUS_LEVELS) {
    if (before < level.minutes && after >= level.minutes && useActivity.getState().earn(level.id, day)) {
      awardXp(level.xp)
      ui.toast(level.title, level.body, 'success')
    }
  }
}

/** Test hook: run one tick with the given inputs. */
export const _tickForTest = tick
