import React, { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { BookMarked, Lightbulb, Download, Trash2, Search, Layers, Plus } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download, timeAgo, fuzzy } from '@/lib/utils'
import { Select } from '@/components/ui/watermelon/Select'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { Button } from '@/components/ui/heroui/Button'
import { Folder, FlaskConical, BookOpen, Code2, GraduationCap, Briefcase, PlayCircle, Mic } from 'lucide-react'
import { LibraryVideos } from './LibraryVideos'
import { MeetingsPanel } from '@/components/meetings/MeetingsPanel'
import { LibrarySearch } from './LibrarySearch'
import { useScrollKeeper } from '@/hooks/useScrollKeeper'
import { AppleMailTabs } from '@/components/ui/skecher/apple-mail-tabs'

/** The palette spaces are drawn from. Also the swatch row in the dialog. */
const SPACE_COLORS = ['#6C8EEF', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#22D3EE', '#F472B6']
type SpaceIconId = 'layers' | 'folder' | 'flask' | 'book' | 'code' | 'school' | 'work'
const SPACE_ICONS: { id: SpaceIconId; Icon: typeof Layers }[] = [
  { id: 'layers', Icon: Layers },
  { id: 'folder', Icon: Folder },
  { id: 'flask', Icon: FlaskConical },
  { id: 'book', Icon: BookOpen },
  { id: 'code', Icon: Code2 },
  { id: 'school', Icon: GraduationCap },
  { id: 'work', Icon: Briefcase },
]

type Tab = 'search' | 'citations' | 'knowledge' | 'spaces' | 'videos' | 'meetings'

export function LibraryView() {
  // Search is the front door now: one gooey field at the top of the Library,
  // shared with the other tabs so what you typed filters the shelves you are
  // looking at and searches the world when you are on the search tab.
  const [tab, setTab] = useState<Tab>('search')
  const [q, setQ] = useState('')
  /**
   * Which folder of saved sources is open. It lives up here rather than inside
   * the search panel because the scroll keeper needs to know when the page's
   * content changes shape: opening a folder must not move the page, and the
   * fix for that (hooks/useScrollKeeper) has to sit on the element that
   * actually scrolls.
   */
  const [folder, setFolder] = useState<string>('all')
  const scroller = useScrollKeeper<HTMLDivElement>(`${tab}:${folder}`)
  return (
    <div ref={scroller} data-ui="library-scroller" className="h-full overflow-y-auto">
      <div className="max-w-[880px] mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Library</h1>
        <p className="text-[12.5px] mb-5" style={{ color: 'var(--text-2)' }}>Everything your research collects, organized.</p>

        <AppleMailTabs<Tab>
          aria-label="Library sections"
          className="mb-6"
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: 'search', label: 'Search', icon: Search },
            { value: 'citations', label: 'Citations', icon: BookMarked },
            { value: 'knowledge', label: 'Knowledge cards', icon: Lightbulb },
            { value: 'spaces', label: 'Spaces', icon: Layers },
            { value: 'videos', label: 'Videos', icon: PlayCircle },
            { value: 'meetings', label: 'Meetings', icon: Mic },
          ]}
        />

        {tab === 'search' && <LibrarySearch query={q} onQuery={setQ} folder={folder} onFolder={setFolder} />}
        {tab === 'citations' && <Citations q={q} onQuery={setQ} />}
        {tab === 'knowledge' && <Knowledge q={q} onQuery={setQ} />}
        {tab === 'spaces' && <Spaces />}
        {tab === 'videos' && <LibraryVideos />}
        {tab === 'meetings' && <MeetingsPanel />}
      </div>
    </div>
  )
}

/**
 * The old search boxes here were a second and third copy of the same control.
 * The Library now has one field, built on the gooey input, and these shelves
 * read from it: whatever is in it filters what you are looking at, so the tab
 * you are on and the words you typed can never disagree.
 */
function Citations({ q, onQuery }: { q: string; onQuery: (q: string) => void }) {
  const citations = useStore((s) => s.citations)
  const [collection, setCollection] = useState('All')
  const ui = useUI()

  const collections = useMemo(() => ['All', ...new Set(citations.map((c) => c.collection))], [citations])
  const filtered = citations.filter((c) => (collection === 'All' || c.collection === collection) && fuzzy(q, c.title + c.domain))

  const exportAs = (format: 'apa' | 'mla' | 'chicago' | 'ieee' | 'bibtex') => {
    const year = new Date().getFullYear()
    const lines = filtered.map((c, i) => {
      const author = c.domain.split('.')[0]
      const t = c.title
      switch (format) {
        case 'apa': return `${author}. (${year}). ${t}. ${c.url}`
        case 'mla': return `${author}. "${t}." ${c.domain}, ${year}. ${c.url}`
        case 'chicago': return `${author}. "${t}." ${c.domain}. Accessed ${year}. ${c.url}.`
        case 'ieee': return `[${i + 1}] ${author}, "${t}," ${c.domain}, ${year}. [Online]. Available: ${c.url}`
        case 'bibtex': return `@misc{${author}${year}${i},\n  title={${t}},\n  author={${author}},\n  year={${year}},\n  url={${c.url}}\n}`
      }
    })
    download(`citations.${format === 'bibtex' ? 'bib' : 'txt'}`, lines.join('\n\n'), 'text/plain')
    ui.toast(`Exported ${format.toUpperCase()}`, `${filtered.length} citations.`, 'success')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* One search field for the whole Library — the gooey input on the
            Search tab. This shelf simply reads it. */}
        <span className="text-[11.5px] flex-1 min-w-[200px]" style={{ color: 'var(--text-3)' }}>
          {q.trim() ? <>Filtered by “{q.trim()}” from the Library search on the Search tab.</> : 'Type in the gooey search field on the Search tab to filter this shelf.'}
        </span>
        <Select
          value={collection}
          onChange={(v) => setCollection(v)}
          options={collections.map((c) => ({ value: c, label: c }))}
          size="sm"
          className="min-w-[150px]"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['apa', 'mla', 'chicago', 'ieee', 'bibtex'] as const).map((f) => (
          <button key={f} onClick={() => exportAs(f)} disabled={filtered.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide disabled:opacity-40"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Download size={10} /> {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14">
          <BookMarked size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>No citations yet.</p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>Every web-search source is auto-saved here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="surface p-3.5 flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                {c.domain.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <a href={c.url} target="_blank" rel="noreferrer" className="block text-[13px] font-medium truncate hover:underline">{c.title}</a>
                <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{c.domain} · {c.collection} · {timeAgo(c.savedAt)}</div>
              </div>
              <button onClick={() => useStore.setState((s) => ({ citations: s.citations.filter((x) => x.id !== c.id) }))}
                aria-label="Remove citation" className="p-1.5 rounded opacity-40 hover:opacity-100" style={{ color: 'var(--text-3)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Knowledge({ q }: { q: string; onQuery: (q: string) => void }) {
  const cards = useStore((s) => s.knowledge)
  const filtered = cards.filter((c) => fuzzy(q, c.title + c.insight + c.tags.join(' ')))

  return (
    <div>
      {q.trim() && (
        <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
          Filtered by “{q.trim()}” from the gooey search on the Search tab.
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="text-center py-14">
          <Lightbulb size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>No knowledge cards yet.</p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>Hover any AI response and hit the lightbulb to extract an insight.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="surface p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[13px] font-medium flex-1 leading-snug">{c.title}</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                  style={{
                    background: c.confidence === 'high' ? 'color-mix(in srgb, var(--success) 16%, transparent)' : c.confidence === 'medium' ? 'color-mix(in srgb, var(--warning) 16%, transparent)' : 'color-mix(in srgb, var(--danger) 14%, transparent)',
                    color: c.confidence === 'high' ? 'var(--success)' : c.confidence === 'medium' ? 'var(--warning)' : 'var(--danger)',
                  }}>{c.confidence}</span>
              </div>
              <p className="text-[12px] leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>{c.insight}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(c.tags ?? []).map((t) => <span key={t} className="px-1.5 py-0.5 rounded-full text-[9.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>#{t}</span>)}
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-3)' }}>{c.source}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Spaces (folders).
 *
 * These used to be created with the browser's own `prompt()`, which is a URL
 * bar dialog with the app's name in it ("127.0.0.1:3847 says"). It cannot be
 * themed, it cannot be styled, it blocks the whole window, and on the desktop
 * shell it is not even the same window. This is the app's own dialog: name,
 * colour and icon, in one panel, with the folder appearing behind it.
 */
function Spaces() {
  const spaces = useStore((s) => s.spaces)
  const chats = useStore((s) => s.chats)
  const ui = useUI()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(SPACE_COLORS[0])
  const [icon, setIcon] = useState<SpaceIconId>('layers')

  const create = () => {
    const clean = name.trim()
    if (!clean) return
    useStore.setState((st) => ({
      spaces: [...st.spaces, { id: nanoid(8), name: clean, icon, color }],
    }))
    ui.toast('Space created', `${clean} is ready for chats and documents.`, 'success')
    setOpen(false)
    setName('')
    setColor(SPACE_COLORS[0])
    setIcon('layers')
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {spaces.map((sp) => {
          const count = chats.filter((c) => c.spaceId === sp.id).length
          const Icon = SPACE_ICONS.find((i2) => i2.id === sp.icon)?.Icon ?? Layers
          return (
            <motion.div key={sp.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              className="surface p-4 relative overflow-hidden"
              style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sp.color} 22%, transparent)` }}>
              <span className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-[0.10]" style={{ background: sp.color }} />
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: `${sp.color}22`, color: sp.color }}>
                  <Icon size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[13.5px] truncate">{sp.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {count} chat{count === 1 ? '' : 's'}
                    {sp.id === 'general' ? ' · the default space' : ''}
                  </div>
                </div>
                {sp.id !== 'general' && (
                  <button
                    aria-label={`Delete ${sp.name}`}
                    title="Delete this space"
                    onClick={() => {
                      useStore.setState((st) => ({
                        spaces: st.spaces.filter((x) => x.id !== sp.id),
                        chats: st.chats.map((c) => (c.spaceId === sp.id ? { ...c, spaceId: undefined } : c)),
                      }))
                      ui.toast('Space removed', 'Its chats moved back to General.', 'info')
                    }}
                    className="p-1.5 rounded-full opacity-60 hover:opacity-100 hover:bg-[var(--elevated)]"
                    style={{ color: 'var(--text-3)' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
        <motion.button
          whileHover={{ y: -2 }}
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 p-4 rounded-[14px] text-[13px]"
          style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
          <Plus size={14} /> New space
        </motion.button>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} size="md" placement="center">
        <ModalContent>
          <ModalHeader className="text-[14px]">New space</ModalHeader>
          <ModalBody>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>
              A space keeps a project together: its chats, its documents, its saved sources.
            </p>
            <label className="block text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create() }}
              placeholder="Thesis, Q3 research, Biology notes"
              className="w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            />
            <div className="mt-4 text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Colour</div>
            <div className="flex gap-2">
              {SPACE_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{ background: c, transform: color === c ? 'scale(1.12)' : undefined, boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined }} />
              ))}
            </div>
            <div className="mt-4 text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Icon</div>
            <div className="flex gap-2">
              {SPACE_ICONS.map(({ id, Icon }) => (
                <button key={id} onClick={() => setIcon(id)} aria-label={`Icon ${id}`}
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{
                    background: icon === id ? `${color}22` : 'var(--surface)',
                    border: `1px solid ${icon === id ? color : 'var(--surface-border)'}`,
                    color: icon === id ? color : 'var(--text-3)',
                  }}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2">
              <Button variant="ghost" color="default" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={create} disabled={!name.trim()}>Create space</Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
