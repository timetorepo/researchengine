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
  dismissToast: (id: string) => void
}

let toastN = 0

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
    set((s) => ({ toasts: [...s.toasts, { id, title, body, tone }] }))
    setTimeout(() => get().dismissToast(id), 4200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
