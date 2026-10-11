import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_PROFILE, migrateProfile } from '@/lib/profile'
import { nanoid } from 'nanoid'
import type {
  Article, Chat, ChatMessage, Citation, ConnectionLogEntry, DocumentRecord, FlowStats, IntegrationState, KnowledgeCard, LearnPath, LearnProgress, QuizRecord, Settings, Skill, SkillSecurity, Source, Space, SpacedCard, Squad, Task,
} from '@/types'
import type { Workflow, WorkflowRunRecord } from '@/lib/workflows/types'
import { builtinSkills } from '@/lib/skills/builtins'
import { builtinSquads } from '@/lib/agents/squads'
import { scopedStorage } from '@/lib/security/lock'
import { DEFAULT_BUBBLES } from '@/lib/chat/bubbles'

export const AGENT_COLORS = ['#6C8EEF', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#22D3EE', '#F472B6']

interface StoreState {
  chats: Chat[]
  activeChatId: string | null
  skills: Skill[]
  /**
   * The scan report attached to an imported skill, by skill id.
   *
   * A skill a user brought in is code that will run with this app's
   * permissions, so the verdict from the security scan travels with it and is
   * visible in the Skills list from then on — not shown once during import and
   * forgotten.
   */
  skillSecurity: Record<string, SkillSecurity>
  articles: Article[]
  spaces: Space[]
  citations: Citation[]
  knowledge: KnowledgeCard[]
  documents: DocumentRecord[]
  quizzes: QuizRecord[]
  learnPaths: LearnPath[]
  learnProgress: LearnProgress
  spacedCards: SpacedCard[]
  squads: Squad[]
  workflows: Workflow[]
  workflowRuns: WorkflowRunRecord[]
  /** The shared task list — pinned rows are the main thing to tackle. */
  tasks: Task[]
  integrations: Record<string, IntegrationState>
  connectionLog: ConnectionLogEntry[]
  settings: Settings
  tokensSavedSession: number
  /** Tokens actually spent this session (reported by providers where given). */
  tokensUsedSession: number
  tokensSavedLifetime: number
  totalRequests: number

  // actions
  set: (fn: (s: StoreState) => Partial<StoreState>) => void
  newChat: (spaceId?: string) => string
  /** A coding conversation, kept out of research history by `kind`. */
  newCodingChat: (project: string) => string
  /** Turn an existing chat into a coding chat (or back). */
  setChatKind: (id: string, kind: 'research' | 'coding', project?: string) => void
  deleteChat: (id: string) => void
  renameChat: (id: string, title: string) => void
  addMessage: (chatId: string, msg: ChatMessage) => void
  updateMessage: (chatId: string, msgId: string, patch: Partial<ChatMessage>) => void
  appendToken: (chatId: string, msgId: string, chunk: string) => void
  setActiveChat: (id: string | null) => void
  logConnection: (endpoint: string, purpose: string, bytes: number, status?: 'ok' | 'error' | 'local') => void
  addTokensSaved: (n: number) => void
  addTokensUsed: (n: number) => void
  resetAll: () => void

  // tasks (shared by Research and Coding)
  addTask: (title: string, opts?: { detail?: string; source?: string; pinned?: boolean }) => string
  toggleTask: (id: string, done?: boolean) => void
  pinTask: (id: string, pinned: boolean) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  /** Rewrite the order from a drag: the ids are the list, top to bottom. */
  reorderTasks: (ids: string[]) => void
  clearDoneTasks: () => void

  // workflows
  addWorkflow: (wf: Workflow) => void
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void
  deleteWorkflow: (id: string) => void
  addWorkflowRun: (rec: WorkflowRunRecord) => void
}

const defaultSettings: Settings = {
  smoothCaret: true,
  scrollProgress: { enabled: true, unlocked: false, perSurface: {} },
  theme: 'dark',
  fontScale: 1,
  compact: false,
  reduceMotion: false,
  flowEnabled: true,
  flowMode: 'balanced',
  defaultModel: '',
  modelDefaults: {},
  customSystemPrompts: {},
  searchBackend: 'auto',
  searxngUrl: 'http://localhost:8080',
  searchRegion: 'us',
  searchAuto: true,
  searchKeys: {},
  searchLastEngine: '',
  providers: {},
  providerModels: {},
  dynamicIsland: false,
  themeGradients: false,
  snaffy: { enabled: false, persona: 'manus' },
  bubbles: DEFAULT_BUBBLES,
  passphraseSet: false,
  floodBudget: 200000,
  osWidgets: true,
  osWallpaper: 'aurora',
  soundEffects: false,
  background: { kind: 'default' },
  onboarded: false,
  masterPromptOverrides: {},
  themeFavorites: ['dark', 'light', 'catppuccin-mocha'],
  hiddenModels: [],
  modelTierFilter: 'all',
  modelSort: 'provider',
  modelTiers: {},
  addedProviders: [],
  updates: { autoCheck: true, source: 'github', repo: 'timetorepo/researchengine' },
  fork: { level: 'balanced', keepLast: 3, includeCode: true },
  dockAnimation: true,
  freeRouting: false,
  providerTimeouts: {},
  voice: { enabled: true, mode: 'browser', model: 'whisper-1', language: '', beam: true, pushToTalk: false },
  showTokenUsage: true,
  profileName: 'Researcher',
  profile: DEFAULT_PROFILE,
  homeWidgets: false,
  homeDemo: false,
  wallpaperEverywhere: false,
  composerBeam: true,
  composerBeamVariant: 'ocean',
  quizAutoAdvance: false,
  readerImages: true,
  notifyUpdates: true,
  notifyRecommendations: false,
  performanceProfile: 'balanced',
  adaptiveQuality: true,
  highMemoryMode: false,
  flowShaping: 'standard',
  thinkingStyle: 'standard',
  pacingSensitivity: 0.5,
  punctuationPauses: true,
  privacyMode: 'private',
  glassMode: 'off',
  flowBoost: true,
  mcpServers: [],
  developerMode: false,
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
      skillSecurity: {},
      articles: [],
      spaces: initialSpaces,
      citations: [],
      knowledge: [],
      documents: [],
      quizzes: [],
      learnPaths: [],
      learnProgress: { xp: 0, streak: 0, lessons: {} },
      spacedCards: [],
      squads: builtinSquads,
      workflows: [],
      workflowRuns: [],
      tasks: [],
      integrations: {},
      connectionLog: [],
      settings: defaultSettings,
      tokensSavedSession: 0,
      tokensUsedSession: 0,
      tokensSavedLifetime: 0,
      totalRequests: 0,

      set: (fn) => set(fn as any),

      addTask: (title, opts) => {
        const id = nanoid(10)
        const clean = String(title ?? '').trim().slice(0, 200) || 'Untitled task'
        set((s) => ({
          tasks: [...s.tasks, {
            id, title: clean, detail: opts?.detail?.slice(0, 400), done: false,
            pinned: !!opts?.pinned, source: opts?.source ?? 'you',
            createdAt: Date.now(), order: s.tasks.length,
          }],
        }))
        return id
      },
      toggleTask: (id, done) => set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: done ?? !t.done } : t)),
      })),
      pinTask: (id, pinned) => set((s) => ({
        // Pinning rewrites the order so the pinned task is genuinely first —
        // the AI reads the list top to bottom, and so does the user.
        tasks: (() => {
          const target = s.tasks.find((t) => t.id === id)
          if (!target) return s.tasks
          const others = s.tasks.filter((t) => t.id !== id)
          const next = pinned
            ? [{ ...target, pinned: true }, ...others]
            : [...others.slice(0, Math.max(0, others.findIndex((t) => !t.pinned))), { ...target, pinned: false }, ...others.slice(Math.max(0, others.findIndex((t) => !t.pinned)))]
          return next.map((t, i) => ({ ...t, order: i }))
        })(),
      })),
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id).map((t, i) => ({ ...t, order: i })) })),
      reorderTasks: (ids) => set((s) => {
        const byId = new Map(s.tasks.map((t) => [t.id, t]))
        const ordered = ids.map((id2) => byId.get(id2)).filter(Boolean) as Task[]
        const missing = s.tasks.filter((t) => !ids.includes(t.id))
        return { tasks: [...ordered, ...missing].map((t, i) => ({ ...t, order: i })) }
      }),
      clearDoneTasks: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done).map((t, i) => ({ ...t, order: i })) })),

      newChat: (spaceId) => {
        const id = nanoid(10)
        const chat: Chat = {
          id, title: 'New research', createdAt: Date.now(), updatedAt: Date.now(),
          spaceId, messages: [], kind: 'research',
        }
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }))
        return id
      },

      newCodingChat: (project) => {
        const id = nanoid(10)
        const chat: Chat = {
          id, title: `Coding · ${project}`, createdAt: Date.now(), updatedAt: Date.now(),
          messages: [], kind: 'coding', settings: { project },
        }
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }))
        return id
      },

      setChatKind: (id, kind, project) => set((s) => ({
        chats: s.chats.map((c) => (c.id === id
          ? { ...c, kind, settings: kind === 'coding' ? { ...c.settings, project: project ?? c.settings?.project } : c.settings }
          : c)),
      })),

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

      addTokensUsed: (n) => set((s) => ({ tokensUsedSession: s.tokensUsedSession + Math.max(0, Math.round(n)) })),
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
        documents: [], quizzes: [], learnPaths: [], learnProgress: { xp: 0, streak: 0, lessons: {} }, spacedCards: [], connectionLog: [], workflows: [], workflowRuns: [],
        tokensSavedSession: 0, tokensUsedSession: 0, tokensSavedLifetime: 0, totalRequests: 0,
        skills: builtinSkills, squads: builtinSquads, spaces: initialSpaces, integrations: {},
      }),
    }),
    {
      name: 'research-engine-v1',
      // Scoped to whoever unlocked the app: the main user's state and a guest's
      // state are different data in different namespaces, so a guest session
      // cannot read the main user's chats and the main user can read a guest's.
      storage: createJSONStorage(() => scopedStorage),
      partialize: (s) => ({
        chats: s.chats, skills: s.skills, articles: s.articles, spaces: s.spaces,
        citations: s.citations, knowledge: s.knowledge, documents: s.documents,
        quizzes: s.quizzes, learnPaths: s.learnPaths, learnProgress: s.learnProgress, spacedCards: s.spacedCards,
        squads: s.squads, integrations: s.integrations,
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
        // The profile gained nested fields over time (avatar motion, kind…) and
        // began life as a bare `profileName`; migrate rather than overwrite.
        mergedSettings.profile = migrateProfile(mergedSettings.profileName, mergedSettings.profile)
        mergedSettings.profileName = mergedSettings.profile.name
        // Built-in skills come from the code, custom ones from the user's own
        // file. Seeding them into a persisted store would freeze whatever the
        // built-in list looked like on the day the user first ran the app, so
        // the library is re-synced on every load and custom skills are kept.
        const persistedSkills = Array.isArray(p.skills) ? p.skills : []
        const customSkills = persistedSkills.filter((sk) => !sk.builtin)
        const customisedBuiltin = new Map(
          persistedSkills.filter((sk) => sk.builtin && sk.promptTemplate && !builtinSkills.some((b) => b.id === sk.id)).map((sk) => [sk.id, sk]),
        )
        const library = [
          ...builtinSkills.map((b) => customisedBuiltin.get(b.id) ?? b),
          ...customisedBuiltin.values(),
        ]
        return {
          ...currentState,
          ...p,
          settings: mergedSettings,
          skills: [...library, ...customSkills],
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
