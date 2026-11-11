/**
 * Batched JSON persistence for zustand's `persist`.
 *
 * zustand writes the whole persisted state after every change. During a
 * streamed answer that is dozens of changes a second, and each one serialises
 * every chat in the store: on a long session that is ~10 ms of blocking work
 * per token, which shows up as stutter. This storage keeps the latest value
 * per key, writes it at most once per `delayMs`, and writes straight away when
 * the page is hidden or closing so nothing is lost.
 *
 * Each pending write remembers the namespace that was active when the change
 * happened, so a guest/main switch cannot move data into the other account.
 */
export interface DeferredJsonIO {
  /** The namespace a change belongs to, read at the moment of the change. */
  namespace: () => string
  read: (name: string) => string | null
  write: (ns: string, name: string, json: string) => void
  remove: (ns: string, name: string) => void
}

interface Pending { ns: string; name: string; value: unknown }

interface Writer { discardAndFreeze: () => void }
const writers = new Set<Writer>()

/**
 * Stop every batched store from writing again until the page reloads, and drop
 * anything still pending. Called before a wipe: a write that was still waiting
 * would otherwise put the deleted data back.
 */
export function freezePendingWrites(): void {
  for (const w of writers) w.discardAndFreeze()
}

export function createDeferredJsonStorage(io: DeferredJsonIO, delayMs = 400) {
  const pending = new Map<string, Pending>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let frozen = false

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (frozen || pending.size === 0) return
    const batch = [...pending.values()]
    pending.clear()
    for (const p of batch) io.write(p.ns, p.name, JSON.stringify(p.value))
  }

  // Non-browser hosts (tests, the Node tooling) may have one of these and not the other.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
  }

  const storage = {
    getItem(name: string): unknown | null {
      const raw = io.read(name)
      if (raw === null) return null
      try { return JSON.parse(raw) } catch { return null }
    },
    setItem(name: string, value: unknown): void {
      if (frozen) return
      const ns = io.namespace()
      pending.set(`${ns}\u0000${name}`, { ns, name, value })
      if (!timer) timer = setTimeout(flush, delayMs)
    },
    removeItem(name: string): void {
      const ns = io.namespace()
      pending.delete(`${ns}\u0000${name}`)
      io.remove(ns, name)
    },
    /** Write everything now (exports, tests). */
    flush,
  }
  writers.add({
    discardAndFreeze: () => {
      frozen = true
      if (timer) { clearTimeout(timer); timer = null }
      pending.clear()
    },
  })
  return storage
}
