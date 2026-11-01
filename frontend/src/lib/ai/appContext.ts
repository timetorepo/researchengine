/**
 * Screen context for the assistant.
 *
 * Every model call goes through `streamProvider`, which passes `system` along.
 * This module adds one short paragraph that says which part of Research Engine
 * the user is on right now, what that screen is for, and what the assistant can
 * do from it. Without this, the model only sees the chat text and has to guess
 * whether it is inside a coding project, a quiz, a workflow or the settings page.
 *
 * The screen is read from the browser path, the same paths App.tsx routes on.
 * Unknown paths get the general prompt, so the context is never wrong by
 * accident, only less specific.
 */

export type AppSurface =
  | 'home'
  | 'chat'
  | 'chats'
  | 'coding'
  | 'codersa'
  | 'learn'
  | 'articles'
  | 'library'
  | 'compare'
  | 'workflows'
  | 'calendar'
  | 'bots'
  | 'crm'
  | 'flood'
  | 'marketplace'
  | 'settings'
  | 'feedback'
  | 'alpha'
  | 'secrets'
  | 'general'

const SURFACE_PROMPTS: Record<AppSurface, string> = {
  home: 'The user is on the Home screen, the front page of Research Engine. From here they start a new research question, pick a model, or open a recent chat.',
  chat: 'The user is in a single research chat. Answers should cite the sources they used, and say plainly when sources disagree or are missing.',
  chats: 'The user is on the Chats list, which shows every saved conversation. Help them find, group, rename or continue one.',
  coding: 'The user is in Coding, a workspace of local project folders with a real editor, a terminal behind an approval gate, git and a file tree. You can read and edit project files, run commands the user approves, and build or test the project. If no project is open, a request to build something creates a new project folder and builds it there.',
  codersa: 'The user is in Codersa, the design-led coding workspace. Keep the interface work consistent with the project’s brand and the Research Engine style, and prefer changes the user can preview live.',
  learn: 'The user is in Learn, the study area with quizzes and flashcard-style review built from their own notes and sources. Write questions the user can check against the source material.',
  articles: 'The user is in Articles, a writing area with a rich editor. Help draft, tighten and structure long-form text, and keep the user’s own voice.',
  library: 'The user is in the Library, where saved sources, notes and documents live. Help search, tag and reuse them.',
  compare: 'The user is in Compare, which runs the same prompt across several models side by side. Help the user read the differences and decide which answer to keep.',
  workflows: 'The user is in Workflows, a canvas for repeatable routines of triggers, AI steps, logic and outputs. Help design, debug and explain workflow steps.',
  calendar: 'The user is in Calendar, with events from this device and any imported calendar. Help plan, move or summarise events.',
  bots: 'The user is in Bots, where they configure assistant bots that can act on their behalf. Be clear about what a bot may access before suggesting changes.',
  crm: 'The user is in the CRM, a lightweight contact and deal tracker. Help organise contacts and follow-ups, and never invent contact details.',
  flood: 'The user is in Agent Flood, where several agents work on a task in parallel. Help split work, compare results and merge what is useful.',
  marketplace: 'The user is in the Marketplace of skills, workflows and connectors. Help them judge what an item does before installing it.',
  settings: 'The user is in Settings: providers and API keys, appearance, performance and data. Keys stay on this device. Explain a setting before changing it, and never ask the user to paste a key into the chat.',
  feedback: 'The user is on the Feedback page, sending comments about Research Engine. Help them write a clear, specific report.',
  alpha: 'The user is in the RemoverAlpha tool. Help with its inputs and results, and be specific about what it changes.',
  secrets: 'The user is on the Secrets page, where local secrets are stored. Never display or repeat a secret value in the chat.',
  general: 'The user is using Research Engine, a local-first research app with chats, coding, study tools, workflows and agents.',
}

/** The surface for a browser path, e.g. `/code` → `coding`. */
export function surfaceFor(pathname: string): AppSurface {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'home'
  if (path === '/code/codersa') return 'codersa'
  if (path.startsWith('/code')) return 'coding'
  if (path.startsWith('/chat/')) return 'chat'
  if (path === '/chats') return 'chats'
  if (path === '/quiz') return 'learn'
  if (path.startsWith('/articles')) return 'articles'
  if (path === '/library') return 'library'
  if (path === '/compare') return 'compare'
  if (path.startsWith('/workflows')) return 'workflows'
  if (path === '/calendar') return 'calendar'
  if (path === '/bots') return 'bots'
  if (path === '/crm') return 'crm'
  if (path === '/flood') return 'flood'
  if (path.startsWith('/marketplace')) return 'marketplace'
  if (path.startsWith('/settings')) return 'settings'
  if (path === '/feedback') return 'feedback'
  if (path === '/alpha') return 'alpha'
  if (path === '/secrets') return 'secrets'
  return 'general'
}

/**
 * The screen path the user is on. The app routes with hash paths (`/#/code`),
 * so the hash wins; the pathname is only a fallback outside the browser.
 */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const hash = window.location.hash
  if (hash.startsWith('#/')) return hash.slice(1).split('?')[0]
  return window.location.pathname
}

/** The paragraph for the current screen, or the general one outside the browser. */
export function appContextFor(pathname?: string): string {
  const surface = surfaceFor(pathname ?? currentPath())
  return `You are the assistant inside Research Engine. ${SURFACE_PROMPTS[surface]}`
}

/** Put the screen context in front of a system prompt. Idempotent for one call. */
export function withAppContext(system: string, pathname?: string): string {
  const context = appContextFor(pathname)
  if (!system) return context
  if (system.startsWith(context)) return system
  return `${context}\n\n${system}`
}
