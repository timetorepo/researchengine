import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import type { Source } from '@/types'
// SmoothUI's AISources — the collapsed index for the same list the cards show.
import AISources from '@/components/smoothui/ai-sources'

/** The site's icon, from the same favicon service the backend uses for sources. */
export function faviconSrc(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`
  } catch {
    return ''
  }
}

/**
 * The site's icon, asked for as soon as the sources are known (not when the card
 * scrolls into view). If the icon cannot be loaded, the numbered badge stays, so
 * a source always has a mark.
 */
function SourceIcon({ url, index, hue, size = 16 }: { url: string; index: number; hue: number; size?: number }) {
  const src = faviconSrc(url)
  const [failed, setFailed] = useState(false)
  const badge = (
    <span className="flex items-center justify-center rounded-[5px] text-[9px] font-bold text-white shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue} 60% 45%)` }}>{index + 1}</span>
  )
  if (!src || failed) return badge
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className="rounded-[5px] shrink-0 bg-white/90 object-contain"
      style={{ width: size, height: size }}
    />
  )
}

export function SourceStrip({ sources, hoverId, onHover, onDelete }: {
  sources: Source[]
  hoverId: string | null
  onHover: (id: string | null) => void
  onDelete?: (id: string) => void
}) {
  // Start the icon downloads now. The strip is drawn with the badge first, and each
  // icon replaces it as soon as it has arrived.
  useEffect(() => {
    for (const s of sources) {
      const src = faviconSrc(s.url)
      if (src) { const img = new Image(); img.src = src }
    }
  }, [sources])

  /** The icon in the collapsed index: the site's favicon, numbered when it is missing. */
  const mark = (s: Source, i: number) => <SourceIcon url={s.url} index={i} hue={s.faviconHue} size={16} />

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
              <SourceIcon url={s.url} index={i} hue={s.faviconHue} size={16} />
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
