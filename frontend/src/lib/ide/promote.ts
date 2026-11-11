/**
 * Turning a research chat into a coding chat.
 *
 * The AI decides when code work starts — one tool call (`start_coding_mode`)
 * and the conversation it is already in becomes a coding conversation with a
 * project behind it. This module is the whole move, in one place, so it can be
 * called by the tool, by the user (⌘K), or by a future button:
 *
 *   1. pick a project name (the model's suggestion, sanitised; else the chat's
 *      own words; else the date) and create it if it does not exist,
 *   2. keep the transcript — the chat is not copied, it is re-labelled `kind:
 *      'coding'` and given the project, so nothing the user said is lost,
 *   3. leave the research history and go to the coding workspace.
 */
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { normalizeProjectName } from '@/lib/ide/names'

export interface PromoteInput {
  chatId: string
  project?: string
  reason?: string
  stack?: string
}

export interface PromoteOutcome {
  project: string
  chatId: string
  url: string
}

/** "make me a landing page for a coffee shop" → "landing-page-coffee-shop" */
export function projectNameFrom(text: string, fallback = 'new-project'): string {
  const STOP = new Set(['make', 'build', 'create', 'the', 'a', 'an', 'me', 'for', 'with', 'and', 'please', 'can', 'you', 'my', 'to', 'in', 'of', 'that', 'this', 'it'])
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 4)
  const slug = words.join('-').slice(0, 40)
  return slug || fallback
}

export async function promoteChatToCoding(input: PromoteInput): Promise<PromoteOutcome> {
  const store = useStore.getState()
  const chat = store.chats.find((c) => c.id === input.chatId)
  const firstUser = chat?.messages.find((m) => m.role === 'user')?.content ?? ''
  // The model's suggestion is a name, not a sentence: normalise it, and if it
  // is unusable fall back to the chat's own words, then to the date.
  const suggestion = input.project ? normalizeProjectName(input.project).name : ''
  const fallback = projectNameFrom(chat?.title || firstUser, `project-${new Date().toISOString().slice(0, 10)}`)
  const wanted = suggestion || fallback

  // Reuse the project when the name is already taken — the user may be asking
  // to work on something that exists. The server returns the freed name when it
  // had to invent one, so the chat records what actually exists on disk.
  let project = wanted
  try {
    const res = await fetch('/api/ide/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: wanted }),
    })
    const data = await res.json()
    if (data?.name) project = String(data.name)
  } catch {
    // Offline or refused: still re-label the chat, the workspace will offer to
    // create the project itself.
  }

  // If a coding chat already exists for this project, adopt that one instead of
  // making a second — one conversation per project is the rule the IDE follows.
  const existing = store.chats.find((c) => c.kind === 'coding' && c.settings?.project === project && c.id !== input.chatId)
  const targetId = existing?.id ?? input.chatId

  if (existing && chat) {
    // The project already has a conversation: move this chat's messages into
    // it rather than splitting the work across two.
    const merged = [...existing.messages, ...chat.messages]
    useStore.setState((s) => ({
      chats: s.chats
        .map((c) => (c.id === existing.id ? { ...c, messages: merged, updatedAt: Date.now() } : c))
        .filter((c) => c.id !== input.chatId),
      activeChatId: existing.id,
    }))
  } else {
    store.setChatKind(input.chatId, 'coding', project)
    useStore.getState().renameChat(input.chatId, `Coding · ${project}`)
  }

  const url = `#/code?project=${encodeURIComponent(project)}`
  useUI.getState().toast(
    'Coding mode',
    input.reason?.trim() || `This conversation is now a coding chat on “${project}”.`,
    'success',
  )
  // The workspace is a route; the CodingView reads ?project= to open it.
  if (typeof window !== 'undefined') window.location.hash = url
  return { project, chatId: targetId, url }
}
