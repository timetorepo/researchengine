/**
 * The notification half of "the agent must tell you when it downloads."
 *
 * The backend writes every clone, install and download into a ledger; this hook
 * watches that ledger while coding mode is on screen and raises a toast for
 * anything new — at the moment it happens, not only when someone opens a panel.
 * It never repeats an event, and it stays silent on the first load so a fresh
 * page does not dump yesterday's history on the screen.
 */
import { useEffect, useRef } from 'react'
import { useUI } from '@/stores/useUI'
import type { DownloadEvent } from '@/lib/ide/downloads'

const seenKey = 're.downloads.seen'

export function useDownloadNotices(enabled: boolean, intervalMs = 6000) {
  const toast = useUI((s) => s.toast)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true

    // Across reloads, remember the last event we announced so a notification
    // for a finished download is not repeated every time the view remounts.
    if (seen.current === null) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(seenKey) ?? '[]')
        seen.current = new Set(Array.isArray(stored) ? stored : [])
      } catch {
        seen.current = new Set()
      }
    }

    const idOf = (e: DownloadEvent) => `${e.at}:${e.kind}:${e.url ?? e.command ?? ''}`

    const poll = async () => {
      try {
        const res = await fetch('/api/ide/downloads')
        if (!res.ok) return
        const json = await res.json()
        const events: DownloadEvent[] = Array.isArray(json?.events) ? json.events : []
        const first = seen.current!.size === 0
        let raised = 0
        for (const e of events) {
          const id = idOf(e)
          if (seen.current!.has(id)) continue
          seen.current!.add(id)
          if (first) continue // do not replay history on load
          raised++
          const dangerous = e.vt === 'malicious' || e.vt === 'suspicious'
          const title = e.refused
            ? 'Download refused'
            : e.kind === 'download'
              ? 'Downloaded'
              : 'Package or clone started'
          toast(title, e.note, dangerous ? 'danger' : e.vt === 'clean' ? 'success' : 'info')
        }
        if (raised > 0 || first) {
          try { sessionStorage.setItem(seenKey, JSON.stringify([...seen.current!].slice(-200))) } catch { /* ignore */ }
        }
      } catch { /* offline: the panel still shows the ledger when it can */ }
    }

    void poll()
    const t = window.setInterval(() => { if (alive) void poll() }, intervalMs)
    return () => { alive = false; window.clearInterval(t) }
  }, [enabled, intervalMs, toast])
}
