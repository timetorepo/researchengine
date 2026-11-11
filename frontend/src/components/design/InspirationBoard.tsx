/**
 * References, from the places the user named — Awwwards, Dribbble and
 * unicorn.studio — plus Refero, which files real product screens by flow.
 *
 * Until this round the panel built the *right search URL* and opened it in a
 * browser tab, on the honest grounds that none of these sites offers a public
 * search API. That was still the wrong answer to "browse them in the app", and
 * the app already had the right one: the reader the Library opens sources with.
 * So the references open here, in a pane of this studio, two ways —
 *
 *   Read    — the page reduced to text and pictures on the server. No third
 *             party scripts, no trackers, no layout fights: what the site says,
 *             which is what a reference is usually for.
 *   Browser — the real page in a sandboxed frame, for what text cannot carry:
 *             the motion, the interaction, the actual composition.
 *
 * The address bar takes any URL, back walks this session's history, and any
 * page you are reading can be kept as a reference with one click — title, URL
 * and the site it came from, straight into the brief the agent receives.
 */
import React, { useMemo, useState } from 'react'
import { ExternalLink, Plus, Trash2, Search, Globe, ArrowLeft, Boxes, Lightbulb, CornerDownRight } from 'lucide-react'
import { useDesign, type Inspiration } from '@/stores/useDesign'
import { SourceViewer, type OpenSource } from '@/components/library/SourceViewer'

interface Browse {
  label: string
  url: string
}

interface Source {
  id: Inspiration['source']
  name: string
  what: string
  /** Builds the search URL for a query — where the site supports one. */
  search?: (q: string) => string
  /** Pages worth opening first, so the pane is never an empty box. */
  browses: Browse[]
  home: string
}

const SOURCES: Source[] = [
  {
    id: 'awwwards',
    name: 'Awwwards',
    what: 'Award-winning sites. Use it for craft, layout courage and motion with a reason.',
    search: (q) => `https://www.awwwards.com/websites/?search=${encodeURIComponent(q)}`,
    browses: [
      { label: 'Sites of the day', url: 'https://www.awwwards.com/websites/' },
      { label: 'Nominations', url: 'https://www.awwwards.com/websites/nominees/' },
      { label: 'Collections', url: 'https://www.awwwards.com/collections/' },
    ],
    home: 'https://www.awwwards.com/websites/',
  },
  {
    id: 'dribbble',
    name: 'Dribbble',
    what: 'Component and screen details: tab bars, empty states, charts, motion shots.',
    search: (q) => `https://dribbble.com/search/${encodeURIComponent(q)}`,
    browses: [
      { label: 'Popular', url: 'https://dribbble.com/shots/popular' },
      { label: 'Web design', url: 'https://dribbble.com/shots/popular/web-design' },
      { label: 'Mobile', url: 'https://dribbble.com/shots/popular/mobile' },
    ],
    home: 'https://dribbble.com',
  },
  {
    id: 'refero',
    name: 'Refero',
    what: 'Real product screens filed by page type, flow and UX pattern — the closest thing to a reference library for an app.',
    browses: [
      { label: 'Screens', url: 'https://refero.design/' },
      { label: 'Apps', url: 'https://refero.design/apps' },
      { label: 'Flows', url: 'https://refero.design/flows' },
    ],
    home: 'https://refero.design',
  },
  {
    id: 'unicorn',
    name: 'unicorn.studio',
    what: 'Shader and WebGL looks. Use it for the background or the one signature effect, not the layout.',
    browses: [{ label: 'Explore', url: 'https://www.unicorn.studio' }],
    home: 'https://www.unicorn.studio',
  },
]

/** Which source a URL came from, so a kept page is filed correctly. */
function sourceOf(url: string): Inspiration['source'] {
  const host = url.toLowerCase()
  if (host.includes('awwwards')) return 'awwwards'
  if (host.includes('dribbble')) return 'dribbble'
  if (host.includes('unicorn')) return 'unicorn'
  if (host.includes('refero')) return 'refero'
  return 'other'
}

const hostOf = (url: string) => {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return '' }
}

export function InspirationBoard({ onDone, onOpenComponents }: {
  onDone?: () => void
  /** Reach the app's own components from here instead of from another tab. */
  onOpenComponents?: () => void
}) {
  const brief = useDesign((s) => s.brief)
  const inspirations = useDesign((s) => s.inspirations)
  const addInspiration = useDesign((s) => s.addInspiration)
  const removeInspiration = useDesign((s) => s.removeInspiration)
  const [draft, setDraft] = useState<{ source: Inspiration['source']; title: string; url: string; note: string; palette: string }>({
    source: 'awwwards', title: '', url: '', note: '', palette: '',
  })
  /** The page the in-app reader is on, and where it has been this session. */
  const [reading, setReading] = useState<OpenSource | null>(null)
  const [trail, setTrail] = useState<OpenSource[]>([])
  const [address, setAddress] = useState('')

  // The query is the brief, not "design" — the references have to be for *this*
  // thing.
  const query = useMemo(() => {
    const parts = [brief.subject, brief.style, brief.theme].filter(Boolean).join(' ').trim()
    return parts || 'product website'
  }, [brief.subject, brief.style, brief.theme])

  const open = (s: OpenSource) => {
    setReading(s)
    setTrail((t) => [...t, s].slice(-40))
    setAddress(s.url)
  }

  // Back walks the pages this session opened, and the step before the first of
  // them is the list of sources — so one page in, Back is already useful.
  const back = () => {
    const next = trail.slice(0, -1)
    const prev = next[next.length - 1] ?? null
    setTrail(next)
    setReading(prev)
    setAddress(prev?.url ?? '')
  }

  const go = (url: string) => {
    const clean = url.trim()
    if (!clean) return
    const withScheme = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
    open({ url: withScheme, title: hostOf(withScheme) || withScheme, kind: 'screens' })
  }

  /** A page read in the pane becomes a reference with its real title. */
  const keepRead = (s: OpenSource) => {
    addInspiration({
      source: sourceOf(s.url),
      title: s.title || hostOf(s.url) || s.url,
      url: s.url,
      note: '',
      palette: [],
    })
  }

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

  /* ------------------------------------------------------------- reading --- */

  if (reading) {
    return (
      <div className="flex flex-col gap-2 min-h-0 h-full" data-inspiration-board data-inspiration-reading>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={back} disabled={trail.length < 1} title="Back"
            className="ide-btn outlined" style={{ height: 24, opacity: trail.length < 1 ? 0.5 : 1 }}>
            <ArrowLeft size={11} /> Back
          </button>
          <div className="flex items-center gap-1 flex-1 min-w-0 px-2 rounded-[8px] h-6"
            style={{ background: 'var(--ide-hover, var(--elevated))', border: '1px solid var(--ide-border, var(--surface-border))' }}>
            <Globe size={10} className="shrink-0" style={{ color: 'var(--ide-faint, var(--text-3))' }} />
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') go(address) }}
              aria-label="Browse a URL here"
              className="flex-1 min-w-0 bg-transparent outline-none text-[10.5px] font-mono"
              style={{ color: 'var(--ide-text, var(--text))' }} />
          </div>
          <button onClick={() => go(address)} className="ide-btn outlined" style={{ height: 24 }}>Go</button>
        </div>
        <div className="flex-1 min-h-0">
          <SourceViewer
            inline
            source={reading}
            onClose={() => setReading(null)}
            onKeep={keepRead}
          />
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------- pick one --- */

  return (
    <div className="flex flex-col gap-3 min-h-0" data-inspiration-board>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Inspirations</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          {inspirations.length ? `${inspirations.length} kept` : 'nothing kept yet'}
        </span>
        <div className="flex-1" />
        <span className="text-[10.5px] inline-flex items-center gap-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          <CornerDownRight size={10} /> opens here, not in a tab
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {SOURCES.map((s) => (
          <div key={s.id} className="p-2.5 rounded-[10px] flex flex-col gap-1.5"
            style={{ background: 'var(--ide-hover, var(--elevated))' }} data-inspiration-source={s.id}>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{s.name}</span>
              <a href={s.home} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--primary)' }}>
                new tab <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{s.what}</p>
            <div className="flex flex-wrap gap-1">
              {s.browses.map((b) => (
                <button key={b.url} onClick={() => open({ url: b.url, title: `${s.name} · ${b.label}`, kind: 'screens' })}
                  data-inspiration-browse={`${s.id}:${b.label}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[7px] text-[11px]"
                  style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-text, var(--text))' }}>
                  <Globe size={10} /> {b.label}
                </button>
              ))}
            </div>
            {s.search && (
              <button onClick={() => open({ url: s.search!(query), title: `${s.name} · ${query}`, kind: 'screens' })}
                className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-[7px] text-[11px]"
                style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                <Search size={10} /> Search “{query}”
              </button>
            )}
            {!s.search && (
              <span className="text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                No search URL to build — browse it above, then keep what you find below.
              </span>
            )}
          </div>
        ))}
      </div>

      {/* The app's own components are the other half of a reference: the thing
          you are about to build with. */}
      {onOpenComponents && (
        <button onClick={onOpenComponents} data-inspiration-components
          className="p-2.5 rounded-[10px] flex items-center gap-2.5 text-left"
          style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-border, var(--surface-border))' }}>
          <Boxes size={14} style={{ color: 'var(--ide-accent, var(--primary))' }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Reach the UI components</span>
            <span className="block text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
              Search the component registry, read the install line, put one in this project.
            </span>
          </span>
          <Chevron />
        </button>
      )}

      <div className="p-2.5 rounded-[10px] flex flex-col gap-2"
        style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
        <span className="text-[11.5px] font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--ide-text, var(--text))' }}>
          <Lightbulb size={12} style={{ color: 'var(--ide-accent, var(--primary))' }} /> Keep a reference
        </span>
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
                    <>
                      <button onClick={() => open({ url: i.url, title: i.title, kind: 'screens' })}
                        title="Read it here" className="shrink-0" style={{ color: 'var(--ide-accent, var(--primary))' }}>
                        <Globe size={10} />
                      </button>
                      <a href={i.url} target="_blank" rel="noreferrer noopener" title="New tab" style={{ color: 'var(--primary)' }}><ExternalLink size={10} /></a>
                    </>
                  )}
                </div>
                {i.note && <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{i.note}</p>}
                {!!(i.palette ?? []).length && (
                  <div className="flex gap-1 mt-1">
                    {(i.palette ?? []).map((c) => <span key={c} title={c} className="w-3.5 h-3.5 rounded-full" style={{ background: c, border: '1px solid var(--ide-line, var(--surface-border))' }} />)}
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

/** The chevron the components row ends with. Its own thing so the row stays flat. */
function Chevron() {
  return (
    <span className="shrink-0" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </span>
  )
}
