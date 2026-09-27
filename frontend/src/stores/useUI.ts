import { create } from 'zustand'
import { notify, hasToastSink } from '@/lib/notify'

export type IslandState =
  | { kind: 'idle' }
  | { kind: 'streaming'; tokens: number }
  | { kind: 'search'; sources: number }
  | { kind: 'flood'; active: number; total: number }
  | { kind: 'focus'; remaining: number; total: number }
  | { kind: 'skill'; name: string }

interface Toast { id: string; title: string; body?: string; tone: 'info' | 'success' | 'warning' | 'danger' }

/** What the user is doing right now, as the shell sees it. Views set this on
 *  mount and clear it on unmount, so the focus timer can say "Quiz" (or
 *  "Coding") instead of a bare clock — a running timer with no context is one
 *  more thing to wonder about. */
export type ActivityKind = 'idle' | 'quiz' | 'coding' | 'reading' | 'chat' | 'flood' | 'articles' | 'workflows'
export interface Activity { kind: ActivityKind; label?: string; detail?: string }

export interface FlowPipelineState {
  chatId: string
  stage: 'understand' | 'search' | 'read-sources' | 'retrieve' | 'think' | 'compose' | 'done'
  phase: 'thinking' | 'streaming' | 'stalled'
}

interface UIState {
  sidebarCollapsed: boolean
  sidebarOpenMobile: boolean
  /** Route path whose chunk is being fetched for a navigation in flight. */
  routeLoading: string | null
  settingsOpen: boolean
  /** True while the settings page plays its exit motion, before it navigates. */
  settingsClosing: boolean
  settingsSheet: boolean
  settingsTab: string
  paletteOpen: boolean
  shortcutsOpen: boolean
  skillBuilderOpen: string | null // source prompt
  skillRun: { skillId: string } | null
  islandExpanded: boolean
  starfield: boolean
  diagnostics: boolean
  sonar: boolean
  notFound: boolean
  secretsFound: boolean
  toasts: Toast[]
  /** Every notification this session raised, newest last — the trail we look at
   *  when a message is reported that we cannot find in the code. */
  notices: Notice[]
  island: IslandState
  flow: FlowPipelineState | null
  focus: { running: boolean; endsAt: number | null; remaining: number; total: number; mode: 'work' | 'break' }
  shieldClicks: number
  osMinimized: boolean
  /** File handed from another surface (home drag & drop) to Read & Quiz. */
  pendingQuizFile: File | null
  /** Global prompt to unlock the encrypted-key vault passphrase. */
  vaultPrompt: boolean
  /** Questions queued while the AI is busy answering the current one. Not persisted. */
  queue: Record<string, { id: string; prompt: string; mode?: Record<string, unknown>; extra?: Record<string, unknown> }[]>
  /** The surface the user is on, for the focus timer's context label. */
  activity: Activity

  set: (patch: Partial<UIState>) => void
  setActivity: (activity: Activity) => void
  toggleSidebar: () => void
  /** Open the Settings page on a given tab — from anywhere, including the dock. */
  openSettings: (tab?: string) => void
  /** The shared task panel (Research + Coding). */
  tasksOpen: boolean
  /**
   * The version whose "a new release is out" popup is open, or null. Held in
   * the store rather than in the top bar so the popup can be opened from
   * anywhere — the pill, the Updates tab, or the automatic first sighting.
   */
  updatePopup: string | null
  /**
   * Text handed to whichever composer is open — used by the task panel's
   * "Send to AI". The composer clears it once it has been adopted.
   */
  composerSeed: string | null
  /**
   * A prompt that has just left the home screen. While this is set the home
   * view is blurring out and the chat page is fading in over it, which is how
   * a question asked on the landing page becomes an answer without a cut.
   */
  handoff: { chatId: string; prompt: string; at: number } | null
  toast: (title: string, body?: string, tone?: Toast['tone']) => void
  clearNotices: () => void
  dismissToast: (id: string) => void
}

let toastN = 0

/** A toast plus when it happened; survives a reload via sessionStorage. */
export interface Notice { t: number; title: string; body?: string; tone: string }
const NOTICE_KEY = 're.notices'
const NOTICE_MAX = 40

function loadNotices(): Notice[] {
  try {
    const raw = sessionStorage.getItem(NOTICE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Notice[]) : []
    return Array.isArray(parsed) ? parsed.slice(-NOTICE_MAX) : []
  } catch { return [] }
}

function saveNotices(list: Notice[]) {
  try { sessionStorage.setItem(NOTICE_KEY, JSON.stringify(list.slice(-NOTICE_MAX))) } catch { /* quota / private mode */ }
}

export const useUI = create<UIState>((set, get) => ({
  sidebarCollapsed: typeof window !== 'undefined' && window.innerWidth < 1200,
  sidebarOpenMobile: false,
  routeLoading: null,
  settingsOpen: false,
  settingsClosing: false,
  settingsSheet: false,
  settingsTab: 'providers',
  paletteOpen: false,
  shortcutsOpen: false,
  skillBuilderOpen: null,
  skillRun: null,
  islandExpanded: false,
  starfield: false,
  diagnostics: false,
  sonar: false,
  notFound: false,
  secretsFound: false,
  toasts: [],
  notices: loadNotices(),
  island: { kind: 'idle' },
  flow: null,
  focus: { running: false, endsAt: null, remaining: 25 * 60, total: 25 * 60, mode: 'work' },
  shieldClicks: 0,
  osMinimized: false,
  pendingQuizFile: null,
  vaultPrompt: false,
  queue: {},
  activity: { kind: 'idle' },

  set: (patch) => set(patch),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  /**
   * Settings lives on its own route, but the buttons that open it are scattered
   * (sidebar footer, collapsed dock, command palette, message chips). They all
   * used to flip `settingsOpen`, which nothing ever rendered — so Profile and
   * Theme looked dead. One helper: set the tab, close whatever is open, and
   * actually go there.
   */
  tasksOpen: false,
  updatePopup: null,
  composerSeed: null,
  handoff: null,
  openSettings: (tab) => {
    set((s) => ({
      settingsOpen: true,
      settingsClosing: false,
      settingsTab: tab ?? s.settingsTab,
      settingsSheet: false,
      sidebarOpenMobile: false,
    }))
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#/settings')) {
      window.location.hash = '#/settings'
    }
  },
  // Views claim the activity; the last one to mount owns the label, and an
  // unmount only clears it if it is still the one that set it (so a route
  // change that mounts the next view first does not blank the label).
  setActivity: (activity) => set((s) => (s.activity === activity ? s : { activity })),

  toast: (title, body, tone = 'info') => {
    const id = `t${++toastN}`
    // Keep a trail: the on-screen toast is gone in four seconds, the record is
    // what makes a vague bug report ("it said something about 120 characters")
    // searchable later from Settings -> About.
    set((s) => {
      const notices = [...s.notices, { t: Date.now(), title, body, tone }].slice(-NOTICE_MAX)
      saveNotices(notices)
      return { toasts: [...s.toasts, { id, title, body, tone }], notices }
    })
    // The mounted host (Sonner) owns the lifetime — that is what gives us
    // hover-to-pause and swipe-to-dismiss. Without a host (tests, first paint)
    // the store still cleans up after itself.
    notify({ id, title, body, tone })
    if (!hasToastSink()) setTimeout(() => get().dismissToast(id), 4200)
  },
  clearNotices: () => { saveNotices([]); set({ notices: [] }) },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
