/**
 * The reply a bot is writing right now, while the model streams it. Kept outside
 * the bots store on purpose: a draft changes on every token, and it is not part of
 * the conversation until the reply is finished and saved as a message.
 *
 * Keys: `bot:<botId>` for a one-to-one thread, `room:<roomId>` for a group room.
 * A draft with empty text means "working, nothing to show yet".
 */
import { create } from 'zustand'

export interface BotDraft { botId?: string; text: string }

interface DraftState {
  drafts: Record<string, BotDraft>
  set: (key: string, draft: BotDraft | null) => void
}

export const useBotDrafts = create<DraftState>((set) => ({
  drafts: {},
  set: (key, draft) => set((s) => {
    const next = { ...s.drafts }
    if (draft) next[key] = draft
    else delete next[key]
    return { drafts: next }
  }),
}))

/**
 * A reply that is starting out as a tool line (SEARCH:, OPEN:, …) is not shown:
 * the person sees the step in the trace instead. Partial keywords count too, so
 * "SEA" is held back until it is clear whether it is a tool line.
 */
const TOOL_KEYS = ['SEARCH:', 'OPEN:', 'FIND:', 'APPS', 'TOOLS:', 'RUN:', 'DOCS:']
export function looksLikeToolLine(text: string): boolean {
  const t = text.trimStart().toUpperCase()
  if (!t) return false
  return TOOL_KEYS.some((k) => k.startsWith(t.slice(0, k.length)))
}
