/**
 * Access scoping, from the client side.
 *
 * The user picks what the AI may reach — the open project, a few named folders,
 * or the whole computer — and the choice is stored on the machine that enforces
 * it. "Full" is never the default and never one click away from the others:
 * the panel asks for the sentence first.
 */
import { create } from 'zustand'

export type AccessMode = 'project' | 'selected' | 'full'

export const ACCESS_LABEL: Record<AccessMode, string> = {
  project: 'This project only',
  selected: 'The project and folders I choose',
  full: 'The whole computer',
}

export const FULL_ACCESS_PHRASE = 'I understand'

interface AccessStore {
  mode: AccessMode
  roots: string[]
  reaches: string
  loaded: boolean
  error?: string
  load: () => Promise<void>
  setMode: (mode: AccessMode) => Promise<void>
  addRoot: (path: string) => Promise<void>
  removeRoot: (path: string) => Promise<void>
}

const request = async (init?: RequestInit): Promise<any> => {
  const res = await fetch('/api/agent/access', init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return json
}

const post = (body: unknown): Promise<any> =>
  request({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const useAccess = create<AccessStore>((set, get) => ({
  mode: 'project',
  roots: [],
  reaches: 'Only the open project.',
  loaded: false,

  load: async () => {
    try {
      const json = await request()
      set({ mode: json.mode ?? 'project', roots: json.roots ?? [], reaches: json.reaches ?? '', loaded: true, error: undefined })
    } catch (e) {
      set({ loaded: true, error: String((e as any)?.message ?? e) })
    }
  },

  setMode: async (mode) => {
    try {
      const json = await post({ mode, roots: get().roots })
      set({ mode: json.mode, roots: json.roots ?? [], reaches: json.reaches ?? '', error: undefined })
    } catch (e) {
      set({ error: String((e as any)?.message ?? e) })
    }
  },

  addRoot: async (path) => {
    const trimmed = path.trim()
    if (!trimmed) return
    const roots = Array.from(new Set([...get().roots, trimmed])).slice(0, 32)
    try {
      const json = await post({ mode: get().mode === 'full' ? 'full' : 'selected', roots })
      set({ mode: json.mode, roots: json.roots ?? [], reaches: json.reaches ?? '', error: undefined })
    } catch (e) {
      set({ error: String((e as any)?.message ?? e) })
    }
  },

  removeRoot: async (path) => {
    const roots = get().roots.filter((r) => r !== path)
    try {
      const json = await post({ mode: get().mode, roots })
      set({ mode: json.mode, roots: json.roots ?? [], reaches: json.reaches ?? '', error: undefined })
    } catch (e) {
      set({ error: String((e as any)?.message ?? e) })
    }
  },
}))
