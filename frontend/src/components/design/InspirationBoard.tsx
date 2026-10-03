/**
 * References, from the three places the user named — Awwwards, Dribbble and
 * unicorn.studio — plus Refero, which organises real product screens by flow.
 *
 * Two honest constraints shaped this panel:
 *
 *   • none of these sites offers a public search API, so the app does not
 *     pretend to browse them. It builds the *right search URL* for your brief
 *     and opens it, which is what you would do by hand, faster.
 *   • what you find there is worth keeping, so references you paste in are
 *     stored locally — title, URL, the decision it settles, and a palette if it
 *     has one — and they become part of the brief that reaches the agent.
 */
import React, { useMemo, useState } from 'react'
import { ExternalLink, Plus, Trash2, Search } from 'lucide-react'
import { useDesign, type Inspiration } from '@/stores/useDesign'

interface Source {
  id: Inspiration['source']
  name: string
  what: string
  /** Builds the search URL for a query — where the site supports one. */
  search?: (q: string) => string
  home: string
}

const SOURCES: Source[] = [
  {
    id: 'awwwards', name: 'Awwwards', what: 'Award-winning sites. Use it for craft, layout courage and motion with a reason.',
    search: (q) => `https://www.awwwards.com/websites/?search=${encodeURIComponent(q)}`, home: 'https://www.awwwards.com/websites/',
  },
  {
    id: 'dribbble', name: 'Dribbble', what: 'Component and screen details: tab bars, empty states, charts, motion shots.',
    search: (q) => `https://dribbble.com/search/${encodeURIComponent(q)}`, home: 'https://dribbble.com',
  },
  {
    id: 'unicorn', name: 'unicorn.studio', what: 'Shader and WebGL looks. Use it for the background or the one signature effect, not the layout.',
    home: 'https://www.unicorn.studio',
  },
  {
    id: 'refero', name: 'Refero', what: 'Real product screens filed by page type, flow and UX pattern — the closest thing to a reference library for an app.',
    home: 'https://refero.design',
  },
]

export function InspirationBoard({ onDone }: { onDone?: () => void }) {
  const brief = useDesign((s) => s.brief)
  const inspirations = useDesign((s) => s.inspirations)
  const addInspiration = useDesign((s) => s.addInspiration)
  const removeInspiration = useDesign((s) => s.removeInspiration)
  const [draft, setDraft] = useState<{ source: Inspiration['source']; title: string; url: string; note: string; palette: string }>({
    source: 'awwwards', title: '', url: '', note: '', palette: '',
  })

  // The query is the brief, not "design" — the references have to be for *this*
  // thing.
  const query = useMemo(() => {
    const parts = [brief.subject, brief.style, brief.theme].filter(Boolean).join(' ').trim()
    return parts || 'product website'
  }, [brief.subject, brief.style, brief.theme])

  const save = () => {
    if (!draft.title.trim() && !draft.url.trim()) return
    addInspiration({
      source: draft.source,
      title: draft.title.trim() || draft.url.trim(),
      url: draft.url.trim(),
      note: draft.note.trim(),
      palette: draft.palette.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^#?[0-9a-f]{3,8}$/i.test(s)).map((s) => (s.startsWith('#') ? s : `#${s}`)),
    })
    setDraft({ source: draft.source, title: '', url: '', note: '', palette: '' })
  }

  return (
    <div className="flex flex-col gap-3 min-h-0" data-inspiration-board>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Inspirations</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          {inspirations.length ? `${inspirations.length} kept` : 'nothing kept yet'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {SOURCES.map((s) => (
          <div key={s.id} className="p-2.5 rounded-[10px] flex flex-col gap-1.5"
            style={{ background: 'var(--ide-hover, var(--elevated))' }} data-inspiration-source={s.id}>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{s.name}</span>
              <a href={s.home} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--primary)' }}>
                open <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{s.what}</p>
            {s.search ? (
              <a href={s.search(query)} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-[7px] text-[11px]"
                style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-text, var(--text))' }}>
                <Search size={10} /> Search “{query}”
              </a>
            ) : (
              <span className="text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                No search URL to build — browse it, then paste what you find below.
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-[10px] flex flex-col gap-2"
        style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
        <span className="text-[11.5px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Keep a reference</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {(SOURCES.map((s) => s.id) as Inspiration['source'][]).concat('other').map((id) => (
            <button key={id} onClick={() => setDraft((d) => ({ ...d, source: id }))}
              className="px-2 py-0.5 rounded-full text-[10.5px]"
              style={{
                background: draft.source === id ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--ide-hover, var(--elevated))',
                color: draft.source === id ? 'var(--primary)' : 'var(--ide-dim, var(--text-2))',
              }}>
              {id}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <input className="ide-input" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} data-inspiration-field="title" />
          <input className="ide-input" placeholder="https://…" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} data-inspiration-field="url" />
        </div>
        <input className="ide-input" placeholder="The one decision it settles — layout, type, motion, density" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} data-inspiration-field="note" />
        <input className="ide-input font-mono" placeholder="#0A0A0B #6C8EEF (optional palette)" value={draft.palette} onChange={(e) => setDraft((d) => ({ ...d, palette: e.target.value }))} />
        <button onClick={save} disabled={!draft.title.trim() && !draft.url.trim()}
          className="self-start inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
          <Plus size={11} /> Keep it
        </button>
      </div>

      {inspirations.length > 0 && (
        <div className="min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
          {inspirations.map((i) => (
            <div key={i.id} className="p-2 rounded-[9px] flex items-start gap-2" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-faint, var(--text-3))' }}>{i.source}</span>
                  <span className="text-[11.5px] font-medium truncate" style={{ color: 'var(--ide-text, var(--text))' }}>{i.title}</span>
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--primary)' }}><ExternalLink size={10} /></a>
                  )}
                </div>
                {i.note && <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{i.note}</p>}
                {!!i.palette?.length && (
                  <div className="flex gap-1 mt-1">
                    {i.palette.map((c) => <span key={c} title={c} className="w-3.5 h-3.5 rounded-full" style={{ background: c, border: '1px solid var(--ide-line, var(--surface-border))' }} />)}
                  </div>
                )}
              </div>
              <button onClick={() => removeInspiration(i.id)} className="p-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {onDone && (
        <button onClick={onDone} className="self-start text-[11.5px] underline decoration-dotted" style={{ color: 'var(--ide-dim, var(--text-2))' }}>
          Done — back to the board
        </button>
      )}
    </div>
  )
}
