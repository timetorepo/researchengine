export type ProviderId =
  | 'openai' | 'anthropic' | 'groq' | 'gemini' | 'ollama' | 'nim' | 'openrouter' | 'together' | 'mistral' | 'lmstudio' | 'custom'
  // 0.26.0: the six asked-for providers, plus the FreeRoute gateway that sits
  // in front of every free tier.
  | 'mercury' | 'grok' | 'deepseek' | 'kimi' | 'glm' | 'minimax'
  // 0.37.0: Xiaomi's MiMo open platform — OpenAI-compatible, and the same key
  // also opens an Anthropic-compatible endpoint at /anthropic.
  | 'mimo'
  // Kilo Code's gateway — one OpenAI-compatible endpoint in front of many
  // models, keyed by a single Kilo key.
  | 'kilocode'
  // TypeSafe AI's Jev — a System One decision model. It answers typed questions
  // with calibrated probabilities rather than generating text, so it is a
  // different shape of provider from the rest and is routed as one.
  | 'typesafe'

export interface ProviderConfig {
  id: ProviderId
  name: string
  apiKey?: string // encrypted at rest
  baseUrl?: string
  models: string[]
  enabled: boolean
  /** Optional media credentials, encrypted with the same local vault. */
  imageApiKey?: string
  voiceApiKey?: string
  imageModel?: string
  voiceModel?: string
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
  /** Vision: images attached by the user, sent to models that support them. */
  attachments?: { type: 'image'; name: string; dataUrl: string }[]
  /**
   * What this answer cost. `reported` means the provider told us the counts;
   * false means they are an estimate from the text, and the UI marks them.
   */
  usage?: { prompt: number; completion: number; total: number; reported: boolean }
  /** Chain of thought: whatever the model let us see of its reasoning. */
  thinking?: string
  /**
   * This message *is* the compressed context a fork carried over, not something
   * a model said. It is ordinary content as far as the request is concerned —
   * which is the point: the continuation sees it — but the chat renders it as a
   * card with the numbers, collapsed, instead of as a wall of prose.
   */
  capsule?: {
    fromChatId: string
    fromTitle: string
    savedPct: number
    sourceTokens: number
    capsuleTokens: number
    turns: number
    facts: number
  }
  /** Tool activity for this answer (shown as chips above the text). */
  toolTrace?: { tool: string; label: string; status: 'ok' | 'error' | 'blocked' | 'confirm' }[]
  /** AI-generated questionnaire awaiting the user's answers. */
  questionnaire?: Questionnaire
  /**
   * Cards the model summoned with the `show_tooltip_card` tool.
   *
   * Deliberately a tool call and not a hover on a highlighted span: an answer
   * can only put a card on screen if the conversation can call tools at all, so
   * a model running without them simply never shows one. Nothing renders these
   * by matching text.
   */
  tooltipCards?: {
    title: string
    body?: string
    image?: string
    source?: string
    url?: string
  }[]
  /** Command awaiting explicit user approval (Coding mode safety). */
  pendingExec?: { toolCallId: string; command: string; reason?: string }
  /**
   * This answer switched the conversation into Coding mode (`start_coding_mode`).
   * Carries the project it opened so the transcript can offer the workspace.
   */
  promotedTo?: { project: string; reason?: string }
  /**
   * Humanized rewrite of `content` (Chat only — never Coding). `content` is
   * always kept: it is the "previous response" shown in red on hover.
   */
  humanized?: string
  /** Rewrite is streaming in right now. */
  humanizing?: boolean
  /** Who produced the rewrite ("OpenAI · gpt-4o", "on-device pass"). */
  humanizedBy?: string
  humanizeError?: string
}

export interface QuestionnaireItem {
  id: string
  question: string
  options?: string[]
  allowText?: boolean
}

export interface Questionnaire {
  title?: string
  intro?: string
  items: QuestionnaireItem[]
  answers?: Record<string, string>
  submitted?: boolean
  /** Tool-call id that is resumed when the user submits. */
  toolCallId?: string
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
  /**
   * Coding chats are a different kind of conversation: they carry a project,
   * they drive the IDE tools, and they should not be mixed into research
   * history. `settings.project` is the project they were opened against (the
   * coding panel keeps one chat per project); chats the AI converts keep their
   * own name so the work can move between projects later.
   */
  kind?: 'research' | 'coding'
  settings?: { project?: string }
  /** Session isolation for multitasking: where this chat's work executes. */
  session?: { isolation: 'local' | 'docker' | 'vm'; container?: string; note?: string }
  /** Where an imported conversation came from. */
  importedFrom?: 'chatgpt' | 'claude'
  /** Persona (vendored system prompt) attached to this chat. */
  personaId?: string
  /** MCP server ids enabled for this chat. */
  mcp?: string[]
  /** Vendored upstream skill packs attached to this chat. */
  skillPacks?: string[]
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

/**
 * The report a security scan produced for an imported skill.
 *
 * `scanner` is deliberately explicit: `skillspector` means NVIDIA's tool ran and
 * this is its verdict; `local-static` means only this app's own read-through
 * happened. A verdict is never shown without saying which of the two produced
 * it.
 */
export interface SkillSecurityFinding {
  id?: string
  severity?: string
  title?: string
  why?: string
  file?: string
  line?: number
  evidence?: string
  description?: string
}
export interface SkillSecurity {
  scanner: 'skillspector' | 'local-static'
  scannerNote?: string
  install?: string
  score: number
  severity: string
  recommendation: string
  safeToInstall?: boolean
  llmUsed?: boolean
  at: number
  findings: SkillSecurityFinding[]
  /** Files that were scanned, so an empty report is not mistaken for silence. */
  files?: string[]
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
  // 'rich' is a formatted block: `content` is a small allow-list of inline
  // HTML (bold/italic/underline/link, ordered and bulleted lists), edited with
  // the shadcn-space editor toolbar and sanitised on the way in and out.
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'image' | 'rich'
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
  /** Short summary shown on the article's preview card. */
  description?: string
  /** A picture for the preview card (a data URL). Falls back to the gradient. */
  coverImage?: string
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

/** One step of a duolingo-style path: a short lesson drawn from one part of a document. */
export interface PathLesson {
  id: string
  title: string
  /** What the learner should be able to do after this lesson. */
  goal: string
  /** The passage the lesson's questions were written from, shown on wrong answers. */
  excerpt: string
  questions: QuizQuestion[]
}

export interface PathUnit {
  id: string
  title: string
  lessons: PathLesson[]
}

export interface LearnPath {
  id: string
  docId: string
  docName: string
  title: string
  units: PathUnit[]
  /** "provider:model" when a model wrote the path, or "on-device" when the sentence engine did. */
  builtWith: string
  createdAt: number
}

/** Progress across every path and technique session on this device. */
export interface LearnProgress {
  xp: number
  /** Consecutive days with at least one completed step. */
  streak: number
  lastActiveDay?: string
  /** lessonId → best stars (0–3) and when it was last finished. */
  lessons: Record<string, { stars: number; at: number }>
}

/** A flashcard on the spaced-repetition schedule (SM-2 style). */
export interface SpacedCard {
  id: string
  docId: string
  /** The sentence with its key term blanked out. */
  front: string
  /** The key term that belongs in the blank. */
  answer: string
  /** The full sentence, shown after the attempt. */
  context: string
  ease: number
  intervalDays: number
  reps: number
  lapses: number
  due: number
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
  | { kind: 'shape-grid'; intensity?: number }
  | { kind: 'dark-veil'; intensity?: number }
  | { kind: 'floating-lines'; intensity?: number }
  | { kind: 'dither'; intensity?: number }
  | { kind: 'animated-gradient'; intensity?: number }
  | { kind: 'etched-accretion'; intensity?: number }

export const ANIMATED_BG_KINDS = ['shape-grid', 'dark-veil', 'floating-lines', 'dither', 'animated-gradient', 'etched-accretion'] as const
export type AnimatedBgKind = typeof ANIMATED_BG_KINDS[number]
export type ThemeId =
  | 'dark' | 'light' | 'catppuccin-latte' | 'catppuccin-frappe' | 'catppuccin-macchiato'
  | 'catppuccin-mocha' | 'nord' | 'solarized-dark' | 'solarized-light' | 'high-contrast' | 're-os'
  | 'perplexity' | 'claude' | 'chatgpt' | 'gemini'

export interface ReplicateStage {
  id: string
  title: string
  icon: 'search' | 'layers' | 'book' | 'hammer' | 'shield' | 'map' | 'clock' | 'scale' | 'wrench' | 'flag' | 'sparkles'
  status: 'pending' | 'running' | 'done' | 'error'
  content: string
  ms?: number
  tokens?: number
}

/**
 * A task — the "what am I actually doing" list that both Research and Coding
 * modes share. `pinned` is the user's way of saying *this one first*; the AI
 * receives pinned rows ahead of the rest, in list order.
 */
export interface Task {
  id: string
  title: string
  detail?: string
  done: boolean
  pinned: boolean
  /** Where it came from: 'you', 'chat', 'coding', 'quiz'… */
  source?: string
  createdAt: number
  /** Ordering weight — rewritten by drag-and-drop. */
  order: number
}

export interface Settings {
  theme: ThemeId
  fontScale: number
  /**
   * Snaffy: a router over the providers you already have. Off by default,
   * because a router you did not turn on is a surprise, and a surprise in the
   * middle of a chat is worse than no feature.
   */
  snaffy?: {
    enabled: boolean
    /** Which agent persona Snaffy routes with. */
    persona: string
    /** Pin one model and skip the routing, when you know better than it does. */
    pinned?: string
  }
  compact: boolean
  reduceMotion: boolean
  /** Show the live CPU/RAM meter in the top bar. Off by default. */
  showResourceMeter?: boolean
  /** Show a frames-per-second counter over the app. Off by default. */
  showFps?: boolean
  /** The welcome card on the home screen for AI-product themes. On by default. */
  aiThemeWelcome?: boolean
  flowEnabled: boolean
  flowMode: FlowMode
  /** Real tokens per local day before new requests stop. 0 = no limit. */
  dailyTokenBudget?: number
  defaultModel: string // "provider:model"
  /** Effort level sent to providers that understand it (Claude, OpenAI…). */
  effort?: string
  /** Session switcher shortcut, e.g. "alt+shift". */
  sessionSwitchKey?: string
  /** Persona attached by default to new chats (empty: none). */
  defaultPersonaId?: string
  /** A plain ECC role family (Researcher, Workflow, …) applied to new chats. The ECC members are chosen per request. */
  defaultRoleId?: string
  modelDefaults: Record<string, { temperature: number; topP: number; maxTokens: number }>
  customSystemPrompts: Record<string, string>
  /**
   * Which engine Search uses. `auto` is the ladder (your SearXNG → a public
   * SearXNG → DuckDuckGo), which is why it is the default: search works before
   * anything is configured.
   */
  searchBackend: 'auto' | 'demo' | 'searxng' | 'brave' | 'serper' | 'tavily' | 'ddg'
  searxngUrl: string
  searchRegion: string
  /**
   * Search finds an engine by itself: your instance, then a local one, then the
   * public SearXNG instances (rotated until one answers). Nothing to set up.
   */
  searchAuto?: boolean
  /**
   * Search keys, entered in the UI. They travel with the request, so a backend
   * started with no environment variables still searches.
   */
  searchKeys?: {
    brave?: string
    serper?: string
    tavily?: string
  }
  /** Which engine actually answered last — shown next to the results. */
  searchLastEngine?: string
  providers: Record<string, { apiKey: string; baseUrl: string; enabled: boolean }>
  /** Model ids fetched live from each provider API (never hardcoded). */
  providerModels: Record<string, string[]>
  passphraseSet: boolean
  /**
   * Authenticator lock for the key vault. The TOTP secret is stored only
   * encrypted with the vault passphrase, and unlocking needs a 6-digit code
   * from an authenticator app as well as the passphrase.
   */
  apiKeyAuth?: { enabled: boolean; secretEnc: string; enrolledAt: string }
  dynamicIsland: boolean
  /** Derive card gradients from the active theme instead of fixed hues. */
  themeGradients: boolean
  /**
   * How chat bubbles look. The defaults are the app's own card; `imessage` is
   * the other shape people ask for, with grouped runs and a tail on the last
   * bubble of a run.
   */
  bubbles?: import('@/lib/chat/bubbles').BubblePrefs
  /**
   * Connected accounts (Google Drive / Gmail / Calendar, GitHub, Notion, Slack).
   * Only the credential lives here, and only encrypted when the vault is in use
   * — the backend receives it per request and never keeps a copy.
   */
  integrations?: Record<string, {
    token?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    base?: string
    account?: string
    connectedAt?: number
  }>
  /**
   * Composio (connectors for 1000+ apps). `token` is the project key, encrypted
   * like provider keys; `userId` is this machine's id for its connections.
   */
  composio?: { token?: string; accountUserId?: string }
  /** Optional Context7 key. Documentation search works without one, at lower limits. */
  context7?: { token?: string }
  /**
   * Models the user has taken out of the picker. Refs are "provider:model", so
   * hiding one provider's model never hides another's.
   */
  hiddenModels?: string[]
  /** Which tier filter the model picker opens with. */
  modelTierFilter?: 'all' | 'free' | 'paid'
  /** How the model picker orders rows. */
  modelSort?: 'provider' | 'name' | 'free-first'
  /**
   * Free/paid, where the automatic answer is wrong or unknown. The detector
   * (lib/providers/tiers.ts) only knows what a provider publishes; this is the
   * user's correction, and it wins.
   */
  modelTiers?: Record<string, 'free' | 'paid'>
  /**
   * Providers the user has added. The Providers tab starts empty and fills up
   * from the catalog — this list is the memory of that choice, and the only
   * thing that decides which cards appear.
   */
  addedProviders?: string[]
  /** The updater. Nothing installs without the user pressing the button. */
  updates?: {
    autoCheck?: boolean
    /** Version whose "update available" pill was dismissed. */
    dismissed?: string
    /** Version whose "a new release is out" popup has already been shown once. */
    prompted?: string
    lastChecked?: number
    /**
     * Where updates come from. `github` reads the repository's releases;
     * `manifest` reads a JSON file you host yourself, which is how a build
     * that is not public on GitHub still gets updates.
     */
    source?: 'github' | 'manifest'
    repo?: string
    /** Read-only token, for a repository that is still private. */
    token?: string
    /** URL of an update manifest (see docs in the Updates tab). */
    manifestUrl?: string
    /** Last check result we showed, so a failure is visible without re-checking. */
    lastError?: string
  }
  /**
   * Dock magnification in the model picker. On by default; off gives a plain,
   * still list for anyone who finds the moving rows fussy.
   */
  dockAnimation?: boolean
  /**
   * Free routing — the FreeRoute idea as a feature of chatting rather than a
   * provider: when on, a chat with no model chosen uses the best free model
   * among the providers you have configured, and falls back if it fails.
   */
  freeRouting?: boolean
  /**
   * How long the app waits for a provider before giving up, in seconds, per
   * provider. This is our own patience, not the provider's server setting.
   */
  providerTimeouts?: Record<string, number>
  /** Speech to text — dictation for the composer. */
  voice?: {
    enabled?: boolean
    /** `browser` uses the Web Speech API; `provider` posts audio to a
     *  transcription endpoint; `local` posts to a whisper.cpp server you run. */
    mode?: 'browser' | 'provider' | 'local'
    /** Provider id + model for `provider` mode. */
    provider?: string
    model?: string
    /** whisper.cpp / faster-whisper base URL for `local` mode. */
    localUrl?: string
    language?: string
    /** Keep the microphone glow (voice-glow by Jakub Antalik) around the composer. */
    beam?: boolean
    /** Palette for the microphone glow: Siri-like colourful, or one of the
     *  single-hue variants. */
    beamVariant?: 'colorful' | 'mono' | 'ocean' | 'sunset' | 'forest' | 'candy' | 'ice' | 'gold'
    /** Push-to-talk: hold the mic instead of clicking it. */
    pushToTalk?: boolean
  }
  /**
   * Forking a chat. The capsule carried into the new chat is compressed on
   * this device (lib/chat/fork), and this remembers how hard: `compact`
   * trades detail for tokens, `faithful` errs the other way. Nothing here
   * costs a model call.
   */
  fork?: {
    level?: 'compact' | 'balanced' | 'faithful'
    /** Turns at the end carried close to verbatim. */
    keepLast?: number
    includeCode?: boolean
  }
  /** Per-response token counts, shown in the message footer. */
  showTokenUsage?: boolean
  /** Smooth caret in text fields (Skiper UI's SmoothInput). */
  smoothCaret?: boolean
  /**
   * The scroll-progress indicator (Skiper's scroll progress, adapted). Its
   * position is remembered per surface, because the clear edge differs between
   * the chat composer, the IDE panel and the workflow canvas.
   */
  scrollProgress?: {
    enabled?: boolean
    /** Right-click unlocked: the indicator can be dragged anywhere. */
    unlocked?: boolean
    /** Its shape: a bar on the edge, a ring (with or without a track), or a top bar. */
    mode?: 'bar' | 'circle' | 'dot' | 'top'
    perSurface?: Record<string, { right: number; top: string }>
  }
  floodBudget: number
  osWidgets: boolean
  osWallpaper: string
  soundEffects: boolean
  background: BackgroundConfig
  onboarded: boolean
  masterPromptOverrides: Record<string, string>
  themeFavorites: ThemeId[]
  profileName: string
  /**
   * The home screen, kept minimal by default.
   *
   * Research starts with a question, so the landing view is the hero line, the
   * composer and the suggestions drawn from your own recent work — and nothing
   * else. The widget grid and the offline-demo button are both off until they
   * are asked for, and the wallpaper is opt-in per screen.
   */
  homeWidgets?: boolean
  homeDemo?: boolean
  /** Id from lib/wallpapers — art behind the home screen, with a scrim. */
  homeWallpaper?: string
  /** Wallpapers on the other pages too, not only the home screen. */
  wallpaperEverywhere?: boolean
  /** Border Beam around the home-screen composer (by Jakubantalik). */
  composerBeam: boolean
  composerBeamVariant: 'colorful' | 'ocean' | 'sunset' | 'mono'
  /** Local profile: display name, handle, bio and the generated avatar.
   *  Typed from `@/lib/profile` so the two can never drift. */
  profile: import('@/lib/profile').Profile
  quizAutoAdvance: boolean
  readerImages: boolean
  /**
   * Notifications. `notifyUpdates` is on by default — an app that updates
   * itself should say when there is something to install — and
   * `notifyRecommendations` is off, because an interest is opted into.
   */
  notifyUpdates?: boolean
  notifyRecommendations?: boolean
  performanceProfile: 'eco' | 'balanced' | 'performance'
  /**
   * Set once the user picks a profile in Settings. Until then, a device with
   * 4 GB of RAM or less starts on eco (see lib/system/performance.ts).
   */
  performanceProfileChosen?: boolean
  /**
   * Adaptive quality: sample the real frame rate and let the animated layers
   * thin themselves out on a machine that cannot hold frames (lib/system/
   * frame-budget). On by default; off means every layer always draws fully.
   */
  adaptiveQuality?: boolean
  highMemoryMode: boolean
  flowShaping: 'off' | 'subtle' | 'standard' | 'cinematic'
  thinkingStyle: 'minimal' | 'standard' | 'verbose'
  pacingSensitivity: number
  punctuationPauses: boolean
  /** Privacy Shield: none = no scanning, private = scan + keep local (default),
   *  topsecret = scan everything, block all non-essential outbound traffic. */
  privacyMode: 'none' | 'private' | 'topsecret'
  /** Chatbox / Dynamic Island surface style. */
  glassMode: 'off' | 'liquid' | 'blur'
  /** AIFlowEngine speed booster applied to API model output. */
  flowBoost: boolean
  mcpServers: McpServerConfig[]
  /** Developer Mode: build fingerprint in the top bar, the create-project test
   *  bench in Settings, and request-level detail in error toasts. */
  developerMode: boolean
}

export interface McpServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}
