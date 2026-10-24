// Startup profiles — keep the app light on purpose.
// Mirrors PROFILES in backend/src/runtime.ts so single-process and dev modes agree.
import { useStore } from '@/stores/useStore'

export type PerfProfileId = 'eco' | 'balanced' | 'performance'

export interface PerfCaps {
  floodWorkers: number
  searchResults: number
  concurrentStreams: number
  backgroundIndexing: boolean
  description: string
}

export const PROFILE_CAPS: Record<PerfProfileId, PerfCaps> = {
  eco: {
    floodWorkers: 1, searchResults: 5, concurrentStreams: 1, backgroundIndexing: false,
    description: '1 concurrent stream, smaller retrieval, no background work. Best on 8 GB RAM or less.',
  },
  balanced: {
    floodWorkers: 2, searchResults: 7, concurrentStreams: 2, backgroundIndexing: true,
    description: 'Normal multi-tab use. Background indexing allowed.',
  },
  performance: {
    floodWorkers: 4, searchResults: 9, concurrentStreams: 4, backgroundIndexing: true,
    description: 'Parallel agents, faster preloading, larger caches.',
  },
}

export function perfProfile(): PerfProfileId {
  return useStore.getState().settings.performanceProfile ?? 'balanced'
}

export function perfCaps(): PerfCaps {
  const caps = PROFILE_CAPS[perfProfile()]
  const high = useStore.getState().settings.highMemoryMode
  if (high) return { ...caps, floodWorkers: Math.min(6, caps.floodWorkers + 1), concurrentStreams: caps.concurrentStreams + 1 }
  return caps
}

/* ---- live resource snapshot from the single-process server ---- */
export interface ResourceSnapshot {
  process: { rssMB: number; heapMB: number; uptimeSec: number; node: string }
  dataDir: { path: string; totalMB: number }
  db: { engine: string; sizeMB: number; file?: string }
  cacheMB: number
  profile: string
}

export async function fetchResources(signal?: AbortSignal): Promise<ResourceSnapshot | null> {
  try {
    const res = await fetch('/api/resources', { signal })
    if (!res.ok) return null
    const data = await res.json()
    return data.ok ? data : null
  } catch {
    return null
  }
}

/* ---- low-memory machines ---- */

/** Browsers report RAM in GB (rounded, capped at 8). Undefined where unsupported. */
export function deviceMemoryGB(): number | undefined {
  if (typeof navigator === 'undefined') return undefined
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof mem === 'number' ? mem : undefined
}

/**
 * A laptop with 4 GB of RAM starts on eco: one stream at a time, smaller
 * retrieval, background work off, and the glass blur capped. A choice the user
 * made in Settings always wins, so this only sets the default.
 */
export function applyLowMemoryDefault(): void {
  const mem = deviceMemoryGB()
  if (mem === undefined || mem > 4) return
  const s = useStore.getState().settings
  if (s.performanceProfileChosen || s.performanceProfile === 'eco') return
  useStore.setState((st) => ({ settings: { ...st.settings, performanceProfile: 'eco' } }))
}

/**
 * Mirror the active profile onto <html data-perf>, so CSS can adjust costly
 * effects (backdrop blur) without each component checking the profile.
 */
export function startPerformanceSync(): () => void {
  if (typeof document === 'undefined') return () => {}
  const apply = (profile: PerfProfileId) => { document.documentElement.dataset.perf = profile }
  apply(perfProfile())
  return useStore.subscribe((state, prev) => {
    if (state.settings.performanceProfile !== prev.settings.performanceProfile) {
      apply(state.settings.performanceProfile ?? 'balanced')
    }
  })
}
