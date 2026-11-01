import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { SessionSummary, SearchHit } from '@/lib/codersa/api'
import { MorphingSearch } from '@/components/ui/kit/beui/MorphingSearch'
import { OverflowActions } from '@/components/ui/kit/beui/OverflowActions'

/** Most rows the rail draws at once; the rest are one search away. */
const MAX_ROWS = 200
const SEARCH_DEBOUNCE_MS = 220

interface RailProps {
  sessions: SessionSummary[] | null
  activeId: string | null
  busy: boolean
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onSearch: (q: string) => Promise<SearchHit[]>
}

type Group = { label: string; rows: SessionSummary[] }

function dayStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Today, Yesterday, and Earlier, newest first. Works on the rows it is given. */
export function groupSessions(rows: SessionSummary[], now = Date.now()): Group[] {
  const today = dayStart(now)
  const yesterday = today - 86_400_000
  const groups: Group[] = [
    { label: 'Today', rows: [] },
    { label: 'Yesterday', rows: [] },
    { label: 'Earlier', rows: [] },
  ]
  for (const r of rows) {
    const d = dayStart(r.updatedAt)
    if (d >= today) groups[0].rows.push(r)
    else if (d >= yesterday) groups[1].rows.push(r)
    else groups[2].rows.push(r)
  }
  return groups.filter((g) => g.rows.length > 0)
}

export function SessionRail({ sessions, activeId, busy, onNew, onOpen, onDelete, onSearch }: RailProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  // Search runs after the person pauses typing, and a stale answer never overwrites a newer one.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setHits(null); setSearching(false); return }
    let live = true
    setSearching(true)
    const t = setTimeout(() => {
      onSearch(q)
        .then((r) => { if (live) setHits(r) })
        .catch(() => { if (live) setHits([]) })
        .finally(() => { if (live) setSearching(false) })
    }, SEARCH_DEBOUNCE_MS)
    return () => { live = false; clearTimeout(t) }
  }, [query, onSearch])

  const shown = useMemo(() => (sessions ?? []).slice(0, MAX_ROWS), [sessions])
  const groups = useMemo(() => groupSessions(shown), [shown])

  return (
    <aside className="flex flex-col min-h-0 w-[264px] shrink-0" aria-label="Codersa sessions"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--surface-border)' }}>
      <div className="p-3 space-y-2.5">
        <button onClick={onNew} disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[12px] text-[13px] font-medium disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Plus size={14} /> New session
        </button>
        <MorphingSearch value={query} onChange={setQuery} label="Search sessions" placeholder="Search sessions" width={232} />
      </div>

      <div className="codersa-scroll flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {sessions === null && (
          <div className="flex items-center gap-2 px-2 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}><Loader2 size={13} className="animate-spin" /> Loading…</div>
        )}

        {query.trim() ? (
          <div className="space-y-0.5">
            {searching && <div className="px-2 py-2 text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> Searching…</div>}
            {!searching && hits && hits.length === 0 && <p className="px-2 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>No sessions match “{query.trim()}”.</p>}
            {!searching && hits?.map((h) => (
              <button key={`${h.id}-${h.i}`} onClick={() => onOpen(h.id)} disabled={busy && activeId !== h.id}
                className="w-full text-left px-2.5 py-2 rounded-[10px] hover:bg-[var(--elevated)] disabled:opacity-50">
                <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{h.title}</div>
                <div className="text-[11.5px] line-clamp-2" style={{ color: 'var(--text-3)' }}>{h.snippet}</div>
              </button>
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{g.label}</div>
              {g.rows.map((s) => {
                const on = s.id === activeId
                const project = s.workspace
                return (
                  <div key={s.id} className="group relative">
                    <button onClick={() => onOpen(s.id)} disabled={busy && !on} aria-current={on ? 'true' : undefined}
                      className="w-full text-left px-2.5 py-2 pr-8 rounded-[10px] transition-colors disabled:opacity-50"
                      style={{ background: on ? 'var(--elevated)' : 'transparent', boxShadow: on ? '0 0 0 1px var(--surface-border)' : 'none' }}>
                      <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{s.title}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>
                        {project ? `${project} · ` : ''}{timeAgo(s.updatedAt)}{s.forkedFrom ? ' · fork' : ''}
                      </div>
                    </button>
                    {confirm === s.id ? (
                      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                        <button onClick={() => { setConfirm(null); onDelete(s.id) }} className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: 'var(--danger)', color: '#fff' }}>Delete</button>
                        <button onClick={() => setConfirm(null)} className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ color: 'var(--text-2)' }}>Keep</button>
                      </div>
                    ) : !(busy && on) && (
                      <div className="absolute right-1 top-1.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <OverflowActions label={`Actions for ${s.title}`} items={[{ id: 'delete', label: 'Delete session', danger: true, onSelect: () => setConfirm(s.id) }]} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}

        {sessions && sessions.length > MAX_ROWS && !query.trim() && (
          <p className="px-2.5 py-2 text-[11px]" style={{ color: 'var(--text-3)' }}>Showing the newest {MAX_ROWS}. Search for older sessions.</p>
        )}
        {sessions && sessions.length === 0 && (
          <p className="px-2.5 py-3 text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>No sessions yet. Start one and it will be kept here.</p>
        )}
      </div>
    </aside>
  )
}
