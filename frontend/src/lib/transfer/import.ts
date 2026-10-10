/**
 * Bring conversations in from other AI products. Each export has its own
 * shape; both are read into ordinary Research Engine chats:
 *   • ChatGPT: conversations.json, a tree of messages. We walk the branch each
 *     conversation ended on, from current_node back to the root.
 *   • Claude: the account export's conversations.json, a flat chat_messages
 *     list per conversation with sender "human" or "assistant".
 * Parsing happens in the browser. Nothing is uploaded.
 */
import type { Chat, ChatMessage } from '@/types'

export type ImportSource = 'chatgpt' | 'claude'
export interface ImportResult { source: ImportSource; chats: Chat[]; skipped: number }

const secs = (v: unknown): number => (typeof v === 'number' && v > 0 ? Math.round(v * 1000) : 0)
const isoMs = (v: unknown): number => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : 0
}

function toChat(
  title: unknown, messages: ChatMessage[], createdAt: number, updatedAt: number,
  source: ImportSource, makeId: () => string,
): Chat {
  const first = messages.find((m) => m.role === 'user')?.content ?? ''
  const label = (typeof title === 'string' && title.trim()) || first.split('\n')[0] || 'Imported chat'
  const now = Date.now()
  return {
    id: makeId(),
    title: label.trim().slice(0, 60),
    createdAt: createdAt || now,
    updatedAt: updatedAt || createdAt || now,
    kind: 'research',
    importedFrom: source,
    messages,
  }
}

function fromChatGPT(list: any[], makeId: () => string): { chats: Chat[]; skipped: number } {
  let skipped = 0
  const chats: Chat[] = []
  for (const conv of list) {
    const map: Record<string, any> = conv?.mapping ?? {}
    const chain: any[] = []
    const seen = new Set<string>()
    let id: string | null = conv?.current_node ?? null
    while (id && map[id] && !seen.has(id)) {
      seen.add(id)
      chain.push(map[id])
      id = map[id].parent ?? null
    }
    chain.reverse()
    const messages: ChatMessage[] = []
    for (const node of chain) {
      const m = node?.message
      const role = m?.author?.role
      if (role !== 'user' && role !== 'assistant') continue
      const parts: unknown[] = Array.isArray(m?.content?.parts) ? m.content.parts : []
      const content = parts.filter((p): p is string => typeof p === 'string').join('\n').trim()
      if (!content) continue
      messages.push({ id: makeId(), role, content, createdAt: secs(m?.create_time) || secs(conv?.create_time) || Date.now() })
    }
    if (!messages.length) { skipped++; continue }
    chats.push(toChat(conv?.title, messages, secs(conv?.create_time), secs(conv?.update_time), 'chatgpt', makeId))
  }
  return { chats, skipped }
}

function fromClaude(list: any[], makeId: () => string): { chats: Chat[]; skipped: number } {
  let skipped = 0
  const chats: Chat[] = []
  for (const conv of list) {
    const created = isoMs(conv?.created_at)
    const messages: ChatMessage[] = []
    for (const m of Array.isArray(conv?.chat_messages) ? conv.chat_messages : []) {
      const role = m?.sender === 'human' ? 'user' : m?.sender === 'assistant' ? 'assistant' : null
      if (!role) continue
      let content = typeof m.text === 'string' ? m.text : ''
      if (!content && Array.isArray(m.content)) {
        content = m.content
          .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
          .map((b: any) => b.text)
          .join('\n')
      }
      content = content.trim()
      if (!content) continue
      messages.push({ id: makeId(), role, content, createdAt: isoMs(m.created_at) || created || Date.now() })
    }
    if (!messages.length) { skipped++; continue }
    chats.push(toChat(conv?.name, messages, created, isoMs(conv?.updated_at), 'claude', makeId))
  }
  return { chats, skipped }
}

/** Recognise the export by its shape and read it. Null for anything else. */
export function readExport(json: unknown, makeId: () => string): ImportResult | null {
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as any)?.conversations) ? (json as any).conversations : null
  if (!list || list.length === 0) return null
  const first = list[0]
  if (first && typeof first === 'object' && 'mapping' in first) {
    return { source: 'chatgpt', ...fromChatGPT(list, makeId) }
  }
  if (first && typeof first === 'object' && 'chat_messages' in first) {
    return { source: 'claude', ...fromClaude(list, makeId) }
  }
  return null
}

/** A .json export, or the .zip ChatGPT hands over (conversations.json inside). */
export async function readExportFile(file: File, makeId: () => string): Promise<ImportResult | null> {
  let text: string
  if (/\.zip$/i.test(file.name)) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const entry = zip.file(/(^|\/)conversations\.json$/i)[0]
    if (!entry) return null
    text = await entry.async('string')
  } else {
    text = await file.text()
  }
  return readExport(JSON.parse(text), makeId)
}
