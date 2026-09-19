import { create } from 'zustand'

export type IslandState =
  | { kind: 'idle' }
  | { kind: 'streaming'; tokens: number }
  | { kind: 'search'; sources: number }
  | { kind: 'flood'; active: number; total: number }
  | { kind: 'focus'; remaining: number; total: number }
  | { kind: 'skill'; name: string }

interface Toast { id: string; title: string; body?: string; tone: 'info' | 'success' | 'warning' | 'danger' }

export interface FlowPipelineState {
  chatId: string
  stage: 'understand' | 'search' | 'read-sources' | 'retrieve' | 'think' | 'compose' | 'done'
  phase: 'thinking' | 'streaming' | 'stalled'
}

interface UIState {
  sidebarCollapsed: boolean
  sidebarOpenMobile: boolean
  settingsOpen: boolean
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

  set: (patch: Partial<UIState>) => void
  toggleSidebar: () => void
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
  settingsOpen: false,
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

  set: (patch) => set(patch),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

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
    setTimeout(() => get().dismissToast(id), 4200)
  },
  clearNotices: () => { saveNotices([]); set({ notices: [] }) },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
