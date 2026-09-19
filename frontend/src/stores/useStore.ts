import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PROFILE, withProfileDefaults } from '@/lib/profile'
import { nanoid } from 'nanoid'
import type {
  Chat, ChatMessage, Skill, Article, Space, Settings, ConnectionLogEntry,
  KnowledgeCard, Citation, DocumentRecord, QuizRecord, Squad, IntegrationState, Source, FlowStats,
} from '@/types'
import type { Workflow, WorkflowRunRecord } from '@/lib/workflows/types'
import { builtinSkills } from '@/lib/skills/builtins'
import { builtinSquads } from '@/lib/agents/squads'

export const AGENT_COLORS = ['#6C8EEF', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#22D3EE', '#F472B6']

interface StoreState {
  chats: Chat[]
  activeChatId: string | null
  skills: Skill[]
  articles: Article[]
  spaces: Space[]
  citations: Citation[]
  knowledge: KnowledgeCard[]
  documents: DocumentRecord[]
  quizzes: QuizRecord[]
  squads: Squad[]
  workflows: Workflow[]
  workflowRuns: WorkflowRunRecord[]
  integrations: Record<string, IntegrationState>
  connectionLog: ConnectionLogEntry[]
  settings: Settings
  tokensSavedSession: number
  tokensSavedLifetime: number
  totalRequests: number

  // actions
  set: (fn: (s: StoreState) => Partial<StoreState>) => void
  newChat: (spaceId?: string) => string
  deleteChat: (id: string) => void
  renameChat: (id: string, title: string) => void
  addMessage: (chatId: string, msg: ChatMessage) => void
  updateMessage: (chatId: string, msgId: string, patch: Partial<ChatMessage>) => void
  appendToken: (chatId: string, msgId: string, chunk: string) => void
  setActiveChat: (id: string | null) => void
  logConnection: (endpoint: string, purpose: string, bytes: number, status?: 'ok' | 'error' | 'local') => void
  addTokensSaved: (n: number) => void
  resetAll: () => void

  // workflows
  addWorkflow: (wf: Workflow) => void
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void
  deleteWorkflow: (id: string) => void
  addWorkflowRun: (rec: WorkflowRunRecord) => void
}

const defaultSettings: Settings = {
  theme: 'dark',
  fontScale: 1,
  compact: false,
  reduceMotion: false,
  flowEnabled: true,
  flowMode: 'balanced',
  defaultModel: '',
  modelDefaults: {},
  customSystemPrompts: {},
  searchBackend: 'demo',
  searxngUrl: 'http://localhost:8080',
  searchRegion: 'us',
  providers: {},
  providerModels: {},
  dynamicIsland: false,
  themeGradients: false,
  passphraseSet: false,
  floodBudget: 200000,
  osWidgets: true,
  osWallpaper: 'aurora',
  soundEffects: false,
  background: { kind: 'default' },
  onboarded: false,
  masterPromptOverrides: {},
  themeFavorites: ['dark', 'light', 'catppuccin-mocha'],
  profileName: 'Researcher',
  profile: DEFAULT_PROFILE,
  composerBeam: true,
  composerBeamVariant: 'ocean',
  quizAutoAdvance: false,
  readerImages: true,
  performanceProfile: 'balanced',
  highMemoryMode: false,
  flowShaping: 'standard',
  thinkingStyle: 'standard',
  pacingSensitivity: 0.5,
  punctuationPauses: true,
  privacyMode: 'private',
  glassMode: 'off',
  flowBoost: true,
  mcpServers: [],
}

const initialSpaces: Space[] = [
  { id: 'sp-general', name: 'General', icon: 'compass', color: '#6C8EEF' },
]

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,
      skills: builtinSkills,
      articles: [],
      spaces: initialSpaces,
      citations: [],
      knowledge: [],
      documents: [],
      quizzes: [],
      squads: builtinSquads,
      workflows: [],
      workflowRuns: [],
      integrations: {},
      connectionLog: [],
      settings: defaultSettings,
      tokensSavedSession: 0,
      tokensSavedLifetime: 0,
      totalRequests: 0,

      set: (fn) => set(fn as any),

      newChat: (spaceId) => {
        const id = nanoid(10)
        const chat: Chat = {
          id, title: 'New research', createdAt: Date.now(), updatedAt: Date.now(),
          spaceId, messages: [],
        }
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }))
        return id
      },

      deleteChat: (id) => set((s) => ({
        chats: s.chats.filter((c) => c.id !== id),
        activeChatId: s.activeChatId === id ? null : s.activeChatId,
      })),

      renameChat: (id, title) => set((s) => ({
        chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)),
      })),

      setActiveChat: (id) => set({ activeChatId: id }),

      addMessage: (chatId, msg) => set((s) => ({
        chats: s.chats.map((c) => {
          if (c.id !== chatId) return c
          const messages = [...c.messages, msg]
          const title = c.messages.length === 0 && msg.role === 'user'
            ? msg.content.slice(0, 48) + (msg.content.length > 48 ? '…' : '')
            : c.title
          return { ...c, messages, title, updatedAt: Date.now() }
        }),
      })),

      updateMessage: (chatId, msgId, patch) => set((s) => ({
        chats: s.chats.map((c) => c.id !== chatId ? c : {
          ...c,
          messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
        }),
      })),

      appendToken: (chatId, msgId, chunk) => set((s) => ({
        chats: s.chats.map((c) => c.id !== chatId ? c : {
          ...c,
          messages: c.messages.map((m) => (m.id === msgId ? { ...m, content: m.content + chunk } : m)),
        }),
      })),

      logConnection: (endpoint, purpose, bytes, status = 'ok') => set((s) => {
        // Top Secret: the connection history itself is a privacy surface —
        // never persist it. We still count requests for the diagnostics UI.
        if (s.settings.privacyMode === 'topsecret') {
          return { totalRequests: s.totalRequests + 1, connectionLog: [] }
        }
        return {
          totalRequests: s.totalRequests + 1,
          connectionLog: [
            { id: nanoid(8), t: Date.now(), endpoint, purpose, bytes, status },
            ...s.connectionLog,
          ].slice(0, 400),
        }
      }),

      addTokensSaved: (n) => set((s) => ({
        tokensSavedSession: s.tokensSavedSession + n,
        tokensSavedLifetime: s.tokensSavedLifetime + n,
      })),

      // ---- workflows ----
      addWorkflow: (wf) => set((s) => ({ workflows: [wf, ...s.workflows] })),
      updateWorkflow: (id, patch) => set((s) => ({
        workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w)),
      })),
      deleteWorkflow: (id) => set((s) => ({
        workflows: s.workflows.filter((w) => w.id !== id),
        workflowRuns: s.workflowRuns.filter((r) => r.workflowId !== id),
      })),
      addWorkflowRun: (rec) => set((s) => ({ workflowRuns: [rec, ...s.workflowRuns].slice(0, 100) })),

      resetAll: () => set({
        chats: [], activeChatId: null, articles: [], citations: [], knowledge: [],
        documents: [], quizzes: [], connectionLog: [], workflows: [], workflowRuns: [],
        tokensSavedSession: 0, tokensSavedLifetime: 0, totalRequests: 0,
        skills: builtinSkills, squads: builtinSquads, spaces: initialSpaces, integrations: {},
      }),
    }),
    {
      name: 'research-engine-v1',
      partialize: (s) => ({
        chats: s.chats, skills: s.skills, articles: s.articles, spaces: s.spaces,
        citations: s.citations, knowledge: s.knowledge, documents: s.documents,
        quizzes: s.quizzes, squads: s.squads, integrations: s.integrations,
        workflows: s.workflows,
        settings: s.settings, tokensSavedLifetime: s.tokensSavedLifetime,
        totalRequests: s.totalRequests,
      }),
      // Deep-merge persisted state over fresh defaults so settings fields added
      // in newer versions (themeFavorites, masterPromptOverrides, …) are never
      // wiped out by an older persisted settings object.
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<StoreState> & { settings?: Partial<StoreState['settings']> }
        const mergedSettings = { ...currentState.settings, ...(p.settings ?? {}) }
        // The profile gained nested fields over time (avatar motion, kind…);
        // merge it explicitly so an older stored profile still renders.
        mergedSettings.profile = withProfileDefaults(mergedSettings.profile)
        mergedSettings.profileName = mergedSettings.profile.name || mergedSettings.profileName
        return {
          ...currentState,
          ...p,
          settings: mergedSettings,
        }
      },
    },
  ),
)

// Convenience selectors
export const useSettings = () => useStore((s) => s.settings)
export const useActiveChat = () => useStore((s) => s.chats.find((c) => c.id === s.activeChatId) ?? null)

export function modelLabel(m: string) {
  const [provider, model] = m.split(':')
  return model ?? m
}

export type { Source, FlowStats }
