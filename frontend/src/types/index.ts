export type ProviderId =
  | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'nim' | 'together' | 'mistral' | 'lmstudio' | 'custom'

export interface ProviderConfig {
  id: ProviderId
  name: string
  apiKey?: string // encrypted at rest
  baseUrl?: string
  models: string[]
  enabled: boolean
}

export interface FlowStats {
  originalTokens: number
  prunedTokens: number
  promptTokens: number
  completionTokens: number
  savedPct: number
  costSaved: number
}

export interface Source {
  id: string
  title: string
  url: string
  domain: string
  snippet: string
  faviconHue: number
}

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  model?: string
  provider?: string
  createdAt: number
  sources?: Source[]
  flow?: FlowStats
  bookmarked?: boolean
  mode?: { math?: boolean; quality?: boolean; search?: boolean; replicate?: boolean }
  followUps?: string[]
  error?: string
  agentAttribution?: { name: string; color: string }[]
  stages?: ReplicateStage[]
  stopped?: boolean
}

export interface Chat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  spaceId?: string
  pinned?: boolean
  parentId?: string        // branch origin chat
  branchMessageId?: string // message branched from
  messages: ChatMessage[]
}

export type ParamType = 'string' | 'number' | 'boolean' | 'enum' | 'file'
export interface SkillParam {
  name: string
  type: ParamType
  description?: string
  default?: string
  options?: string[]
}
export interface Skill {
  id: string
  name: string
  description: string
  promptTemplate: string
  params: SkillParam[]
  outputFormat: 'natural' | 'json'
  modelBinding?: string
  category: string
  icon: string
  builtin?: boolean
}

export type AgentRole = 'Researcher' | 'Builder' | 'Critic' | 'Synthesizer' | 'Verifier' | 'Explainer' | 'Quizzer' | 'Note-taker' | 'Custom'
export interface AgentSpec {
  id: string
  name: string
  role: AgentRole
  color: string
  modelBinding: string
  temperature: number
  skills: string[]
}
export interface Squad {
  id: string
  name: string
  description: string
  agents: AgentSpec[]
  builtin?: boolean
}

export interface ArticleBlock {
  id: string
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'image'
  content: string
  // image block metadata
  imageUrl?: string
  caption?: string
  attribution?: string
  alt?: string
  align?: 'left' | 'center' | 'right'
}
export interface Article {
  id: string
  title: string
  blocks: ArticleBlock[]
  createdAt: number
  updatedAt: number
  spaceId?: string
  sourceChatId?: string
}

export interface Citation {
  id: string
  title: string
  url: string
  domain: string
  savedAt: number
  collection: string
}

export interface KnowledgeCard {
  id: string
  title: string
  insight: string
  source: string
  tags: string[]
  confidence: 'low' | 'medium' | 'high'
  createdAt: number
}

export interface Space {
  id: string
  name: string
  icon: string
  color: string
}

export interface ConnectionLogEntry {
  id: string
  t: number
  endpoint: string
  purpose: string
  bytes: number
  status: 'ok' | 'error' | 'local'
}

export interface DocumentRecord {
  id: string
  name: string
  kind: string
  text: string
  addedAt: number
  spaceId?: string
}

export interface QuizQuestion {
  id: string
  type: 'mc' | 'tf' | 'short' | 'fill' | 'ordering' | 'matching'
  prompt: string
  options?: string[]
  answer: string
  explanation: string
  section?: string
  /** ordering: the correct order of `options` */
  correctOrder?: string[]
  /** matching: left column terms */
  pairs?: { left: string; right: string }[]
}

export interface QuizRecord {
  id: string
  docId?: string
  title: string
  questions: QuizQuestion[]
  createdAt: number
  bestScore?: number
}

export interface IntegrationState {
  id: string
  connected: boolean
  scopes: string[]
  lastSync?: number
}

export type FlowMode = 'efficient' | 'balanced' | 'fidelity'

export type BackgroundConfig =
  | { kind: 'default' }
  | { kind: 'solid'; color: string }
  | { kind: 'image'; dataUrl: string }
  | { kind: 'blur'; dataUrl: string }
  | { kind: 'veil'; opacity: number }
export type ThemeId =
  | 'dark' | 'light' | 'catppuccin-latte' | 'catppuccin-frappe' | 'catppuccin-macchiato'
  | 'catppuccin-mocha' | 'nord' | 'solarized-dark' | 'solarized-light' | 'high-contrast' | 're-os' | 'perplexity'

export interface ReplicateStage {
  id: string
  title: string
  icon: 'search' | 'layers' | 'book' | 'hammer' | 'shield' | 'map' | 'clock' | 'scale' | 'wrench' | 'flag' | 'sparkles'
  status: 'pending' | 'running' | 'done' | 'error'
  content: string
  ms?: number
  tokens?: number
}

export interface Settings {
  theme: ThemeId
  fontScale: number
  compact: boolean
  reduceMotion: boolean
  flowEnabled: boolean
  flowMode: FlowMode
  defaultModel: string // "provider:model"
  modelDefaults: Record<string, { temperature: number; topP: number; maxTokens: number }>
  customSystemPrompts: Record<string, string>
  searchBackend: 'demo' | 'searxng' | 'brave' | 'serper' | 'tavily' | 'ddg'
  searxngUrl: string
  searchRegion: string
  providers: Record<string, { apiKey: string; baseUrl: string; enabled: boolean }>
  passphraseSet: boolean
  floodBudget: number
  osWidgets: boolean
  osWallpaper: string
  soundEffects: boolean
  background: BackgroundConfig
  onboarded: boolean
  masterPromptOverrides: Record<string, string>
  themeFavorites: ThemeId[]
  profileName: string
  quizAutoAdvance: boolean
  readerImages: boolean
  performanceProfile: 'eco' | 'balanced' | 'performance'
  highMemoryMode: boolean
}
