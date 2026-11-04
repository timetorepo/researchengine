// The chat backdrop choice, persisted per browser. Off by default. Components
// that change it dispatch `chat-backdrop-change`, so every open view follows.
import { useEffect, useState } from 'react'

export type ChatBackdropKind = 'off' | 'halftone' | 'erosion'
export const CHAT_BACKDROP_KEY = 'chats.backdrop'
export const CHAT_BACKDROP_OPTIONS: { value: ChatBackdropKind; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'halftone', label: 'Halftone flow' },
  { value: 'erosion', label: 'Recursive erosion' },
]

export function readChatBackdrop(): ChatBackdropKind {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAT_BACKDROP_KEY) : null
    return raw === 'halftone' || raw === 'erosion' ? raw : 'off'
  } catch { return 'off' }
}

export function writeChatBackdrop(kind: ChatBackdropKind) {
  try { localStorage.setItem(CHAT_BACKDROP_KEY, kind) } catch { /* private mode */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('chat-backdrop-change'))
}

export function useChatBackdrop(): [ChatBackdropKind, (k: ChatBackdropKind) => void] {
  const [kind, setKind] = useState<ChatBackdropKind>(readChatBackdrop)
  useEffect(() => {
    const sync = () => setKind(readChatBackdrop())
    window.addEventListener('chat-backdrop-change', sync)
    return () => window.removeEventListener('chat-backdrop-change', sync)
  }, [])
  return [kind, writeChatBackdrop]
}
