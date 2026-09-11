import React from 'react'
import { motion } from 'framer-motion'
import type { Source } from '@/types'

export function SourceStrip({ sources, hoverId, onHover }: {
  sources: Source[]
  hoverId: string | null
  onHover: (id: string | null) => void
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-3 mb-1" role="list" aria-label="Sources">
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
            className="shrink-0 w-[210px] p-3 rounded-[14px] block transition-transform duration-200"
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
          </motion.a>
        )
      })}
    </div>
  )
}
