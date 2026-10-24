// Pure helpers for browser-storage pressure (no DOM access, so they can be tested).
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
}

/** Keep at most this many chats, and this many messages in each older chat. */
const KEEP_CHATS = 60
const KEEP_RECENT_MESSAGES = 120
const KEEP_RECENT_FULL = 6

/**
 * Shrink the persisted chats until they fit. Order of cuts: drop tool traces and
 * reasoning from older messages first (the answers stay), then the oldest chats,
 * then the oldest messages of each chat. Returns what was kept and what was cut.
 */
export function trimForQuota(value: string): { value: string; note: string } {
  let state: any
  try { state = JSON.parse(value) } catch { return { value, note: 'Storage was full; the state could not be trimmed.' } }
  const root = state?.state ?? state
  const chats: any[] = Array.isArray(root?.chats) ? root.chats : []
  let droppedChats = 0
  let droppedMsgs = 0
  let stripped = 0

  for (const c of chats) {
    const msgs: any[] = Array.isArray(c.messages) ? c.messages : []
    msgs.forEach((m, i) => {
      if (i >= msgs.length - KEEP_RECENT_FULL) return
      if (m.toolTrace || m.thinking) { delete m.toolTrace; delete m.thinking; stripped++ }
    })
  }
  if (chats.length > KEEP_CHATS) {
    droppedChats = chats.length - KEEP_CHATS
    chats.splice(0, droppedChats)
  }
  for (const c of chats) {
    const msgs: any[] = Array.isArray(c.messages) ? c.messages : []
    if (msgs.length > KEEP_RECENT_MESSAGES) {
      droppedMsgs += msgs.length - KEEP_RECENT_MESSAGES
      c.messages = msgs.slice(-KEEP_RECENT_MESSAGES)
    }
  }
  if (root && typeof root === 'object') root.chats = chats
  const out = JSON.stringify(state)
  const parts: string[] = []
  if (stripped) parts.push(`tool traces from ${stripped} older messages`)
  if (droppedMsgs) parts.push(`${droppedMsgs} older messages`)
  if (droppedChats) parts.push(`${droppedChats} oldest chats`)
  return {
    value: out,
    note: parts.length
      ? `Browser storage was full, so ${parts.join(', ')} were trimmed from the saved copy. Export chats to keep everything.`
      : 'Browser storage was full. Export chats to keep a full copy.',
  }
}

