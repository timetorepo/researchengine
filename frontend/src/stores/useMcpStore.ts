import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { McpServerConfig } from '@/types'
import { useStore } from './useStore'

interface McpState {
  servers: McpServerConfig[]
  addServer: (server: McpServerConfig) => void
  updateServer: (id: string, patch: Partial<McpServerConfig>) => void
  setServerEnv: (id: string, key: string, value: string) => void
  toggleServer: (id: string) => void
  removeServer: (id: string) => void
}

function sanitizeServers(value: unknown): McpServerConfig[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap((raw: any, index): McpServerConfig[] => {
    if (!raw || typeof raw !== 'object') return []
    const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 100) : `mcp-${index}`
    const command = typeof raw.command === 'string' ? raw.command.slice(0, 240) : ''
    if (!command) return []
    const env: Record<string, string> = {}
    if (raw.env && typeof raw.env === 'object') {
      for (const [key, value] of Object.entries(raw.env)) {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof value === 'string') env[key] = value.slice(0, 16_000)
      }
    }
    const approved = raw.approved === true
    return [{
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 120) : command,
      command,
      args: Array.isArray(raw.args) ? raw.args.filter((a: unknown): a is string => typeof a === 'string').slice(0, 24) : [],
      env: Object.keys(env).length ? env : undefined,
      // Older persisted configs never required an explicit start. Keep them
      // saved, but do not let the assistant launch them during migration.
      enabled: approved && raw.enabled !== false,
      approved,
      ...(typeof raw.catalogId === 'string' ? { catalogId: raw.catalogId.slice(0, 100) } : {}),
    }]
  })
}

function legacyServers(): McpServerConfig[] {
  // Profiles created before the Marketplace kept this list in Settings. Adopt
  // their configs, but require the new explicit Connect action before a server
  // can be launched by the assistant.
  return sanitizeServers(useStore.getState().settings.mcpServers).map((server) => ({ ...server, enabled: false }))
}

export const useMcpStore = create<McpState>()(
  persist(
    (set) => ({
      servers: legacyServers(),
      addServer: (server) => set((state) => {
        if (state.servers.some((item) => item.id === server.id || (!!server.catalogId && item.catalogId === server.catalogId))) return state
        return { servers: [...state.servers, ...sanitizeServers([server])] }
      }),
      updateServer: (id, patch) => set((state) => ({
        servers: state.servers.map((server) => server.id === id ? { ...server, ...patch } : server),
      })),
      setServerEnv: (id, key, value) => set((state) => ({
        servers: state.servers.map((server) => server.id !== id ? server : {
          ...server,
          env: { ...(server.env ?? {}), [key]: value },
        }),
      })),
      toggleServer: (id) => set((state) => ({
        servers: state.servers.map((server) => server.id === id ? { ...server, enabled: !server.enabled } : server),
      })),
      removeServer: (id) => set((state) => ({ servers: state.servers.filter((server) => server.id !== id) })),
    }),
    {
      name: 'research-engine-mcp-v1',
      partialize: (state) => ({ servers: state.servers }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<McpState> | undefined
        return {
          ...current,
          ...saved,
          servers: Array.isArray(saved?.servers) ? sanitizeServers(saved.servers) : legacyServers(),
        }
      },
    },
  ),
)
