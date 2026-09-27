import React, { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { BookMarked, Lightbulb, Download, Trash2, Search, Layers, Plus } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download, timeAgo, fuzzy } from '@/lib/utils'
import { Select } from '@/components/ui/watermelon/Select'

type Tab = 'citations' | 'knowledge' | 'spaces'

export function LibraryView() {
  const [tab, setTab] = useState<Tab>('citations')
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[840px] mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Library</h1>
        <p className="text-[12.5px] mb-5" style={{ color: 'var(--text-2)' }}>Everything your research collects, organized.</p>

        <div className="flex gap-1.5 mb-6">
          {([['citations', 'Citations', BookMarked], ['knowledge', 'Knowledge cards', Lightbulb], ['spaces', 'Spaces', Layers]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px]"
              style={{ background: tab === id ? 'var(--elevated)' : 'transparent', border: '1px solid var(--surface-border)', color: tab === id ? 'var(--text)' : 'var(--text-3)' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === 'citations' && <Citations />}
        {tab === 'knowledge' && <Knowledge />}
        {tab === 'spaces' && <Spaces />}
      </div>
    </div>
  )
}

function Citations() {
  const citations = useStore((s) => s.citations)
  const [q, setQ] = useState('')
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] flex-1 min-w-[200px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <Search size={13} style={{ color: 'var(--text-3)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search citations" className="bg-transparent outline-none text-[13px] flex-1" />
        </div>
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

function Knowledge() {
  const cards = useStore((s) => s.knowledge)
  const [q, setQ] = useState('')
  const filtered = cards.filter((c) => fuzzy(q, c.title + c.insight + c.tags.join(' ')))

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <Search size={13} style={{ color: 'var(--text-3)' }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your knowledge base" className="bg-transparent outline-none text-[13px] flex-1" />
      </div>
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
                {c.tags.map((t) => <span key={t} className="px-1.5 py-0.5 rounded-full text-[9.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>#{t}</span>)}
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-3)' }}>{c.source}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spaces() {
  const spaces = useStore((s) => s.spaces)
  const chats = useStore((s) => s.chats)
  const ui = useUI()
  const COLORS = ['#6C8EEF', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#22D3EE', '#F472B6']

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {spaces.map((sp) => (
          <div key={sp.id} className="surface p-4">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[14px]" style={{ background: `${sp.color}22`, color: sp.color }}>
                <Layers size={15} />
              </span>
              <div className="flex-1">
                <div className="font-medium text-[13.5px]">{sp.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{chats.filter((c) => c.spaceId === sp.id).length} chats</div>
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            const name = prompt('Space name')
            if (!name) return
            useStore.setState((s) => ({
              spaces: [...s.spaces, { id: nanoid(8), name, icon: 'layers', color: COLORS[s.spaces.length % COLORS.length] }],
            }))
          }}
          className="flex items-center justify-center gap-2 p-4 rounded-[14px] text-[13px]"
          style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
          <Plus size={14} /> New space
        </button>
      </div>
    </div>
  )
}
