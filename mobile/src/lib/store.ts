// Mobile app store. Deliberately minimal in R1: appearance + posture state only.
// Library/chat/quiz state arrives with re-core (R2) and the desktop parity work;
// the zustand persist pattern mirrors frontend/src/stores/useStore.ts so the
// two stores merge cleanly later without a format fight.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quality } from './quality'
import { setHapticsEnabled } from './haptics'

export interface Settings {
  theme: string
  fontScale: number
  compact: boolean
  reduceMotion: boolean
  surface: 'off' | 'liquid' | 'blur'
  qualityOverride: Quality | 'auto'
  haptics: boolean
  soundEffects: boolean
  profileName: string
  themeFavorites: string[]
  onboarded: boolean
}

export interface Snack {
  id: number
  title: string
  body?: string
  tone: 'info' | 'success' | 'warning' | 'error'
  action?: { label: string; run: () => void }
}

interface Store {
  settings: Settings
  snacks: Snack[]
  update: (patch: Partial<Settings>) => void
  toast: (title: string, body?: string, tone?: Snack['tone']) => void
  dismiss: (id: number) => void
}

const DEFAULTS: Settings = {
  theme: 'dark',
  fontScale: 1,
  compact: false,
  reduceMotion: false,
  surface: 'blur',
  qualityOverride: 'auto',
  haptics: true,
  soundEffects: false, // off by default, docs/mobile/07: nothing plays unless asked
  profileName: 'Researcher',
  themeFavorites: ['dark', 'light', 'catppuccin-mocha'],
  onboarded: false,
}

let snackId = 1

export const useStore = create<Store>()(persist(
  (set, get) => ({
    settings: DEFAULTS,
    snacks: [],
    update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    toast: (title, body, tone = 'info') =>
      set((s) => ({ snacks: [...s.snacks.slice(-2), { id: snackId++, title, body, tone }] })),
    dismiss: (id) => set((s) => ({ snacks: s.snacks.filter((k) => k.id !== id) })),
  }),
  {
    name: 're.mobile.v1',
    partialize: (s) => ({ settings: s.settings }),
    onRehydrateStorage: () => (state) => {
      if (state) setHapticsEnabled(state.settings.haptics !== false)
    },
  },
))

export const useSettings = () => useStore((s) => s.settings)
export const useUpdate = () => useStore((s) => s.update)
export { DEFAULTS }
