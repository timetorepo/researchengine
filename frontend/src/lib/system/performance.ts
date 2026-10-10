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
