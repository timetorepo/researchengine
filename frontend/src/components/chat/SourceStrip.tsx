import React from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import type { Source } from '@/types'
// SmoothUI's AISources — the collapsed index for the same list the cards show.
import AISources from '@/components/smoothui/ai-sources'

export function SourceStrip({ sources, hoverId, onHover, onDelete }: {
  sources: Source[]
  hoverId: string | null
  onHover: (id: string | null) => void
  onDelete?: (id: string) => void
}) {
  /** The number badge, reused as the favicon in the index so the two views
   *  are obviously the same sources. */
  const mark = (s: Source, i: number) => (
    <span className="flex h-4 w-4 items-center justify-center rounded-[5px] text-[9px] font-bold text-white"
      style={{ background: `hsl(${s.faviconHue} 60% 45%)` }}>{i + 1}</span>
  )

  return (
    <div className="mb-1">
      {/* The list view: titles and addresses, collapsed until asked for — the
          cards below stay the visual layer and keep the citation hover link. */}
      <AISources
        className="mb-2"
        label={`${sources.length} source${sources.length === 1 ? '' : 's'}`}
        sources={sources.map((s, i) => ({
          id: s.id, title: s.title, url: s.url, snippet: s.snippet, favicon: mark(s, i),
        }))}
      />
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-3" role="list" aria-label="Sources">
      {sources.map((s, i) => {
        const active = hoverId === s.id
        return (
          <motion.a
            key={s.id}
            role="listitem"
            href={s.url} target="_blank" rel="noreferrer"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', damping: 25, stiffness: 300 }}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            className="group relative shrink-0 w-[210px] p-3 rounded-[14px] block transition-transform duration-200"
            style={{
              background: `linear-gradient(135deg, hsl(${s.faviconHue} 45% ${active ? 26 : 20}% / 0.55), var(--surface))`,
              border: `1px solid ${active ? `hsl(${s.faviconHue} 60% 55% / 0.6)` : 'var(--surface-border)'}`,
              transform: active ? 'scale(1.02)' : undefined,
              boxShadow: active ? `0 8px 24px -8px hsl(${s.faviconHue} 60% 40% / 0.4)` : undefined,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-4 h-4 rounded-[5px] text-[9px] font-bold flex items-center justify-center shrink-0"
                style={{ background: `hsl(${s.faviconHue} 60% 45%)`, color: '#fff' }}>
                {i + 1}
              </span>
              <span className="text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{s.domain}</span>
            </div>
            <div className="text-[12px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{s.title}</div>
            <div className="text-[10.5px] mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.snippet}</div>
            {onDelete && <button type="button" aria-label={`Delete citation for ${s.domain}`} title="Delete citation"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(s.id) }}
              className="absolute right-2 bottom-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity"
              style={{ color: 'var(--text-3)' }}><Trash2 size={11} /></button>}
          </motion.a>
        )
      })}
      </div>
    </div>
  )
}
