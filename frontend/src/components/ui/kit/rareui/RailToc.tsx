// RareUI · Rail table of contents — thin ticks down the edge of the page; the
// label of each section appears beside its tick on hover or when active.
import { useState } from 'react'
import { motion } from 'motion/react'

export type RailItem = { id: string; label: string }

export function RailToc({ items, activeId, onSelect, fixed = true }: { items: RailItem[]; activeId?: string; onSelect: (id: string) => void; fixed?: boolean }) {
  const [hover, setHover] = useState<string | null>(null)
  return (
    <nav aria-label="Sections" className={`${fixed ? 'fixed right-3 top-1/2 -translate-y-1/2 z-20 hidden xl:flex' : 'flex'} flex-col items-end gap-1.5`}>
      {items.map((it) => {
        const active = it.id === activeId
        const show = active || hover === it.id
        return (
          <button key={it.id} type="button" onClick={() => onSelect(it.id)}
            onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)}
            aria-label={it.label} aria-current={active ? 'true' : undefined}
            className="flex items-center gap-2 h-4">
            <motion.span initial={false} animate={{ opacity: show ? 1 : 0, x: show ? 0 : 6 }} transition={{ duration: 0.18 }}
              className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-2)' }}>{it.label}</motion.span>
            <motion.span initial={false} animate={{ width: active ? 22 : 10, background: active ? 'var(--primary)' : 'var(--text-3)' }}
              transition={{ duration: 0.2 }} className="h-[2px] rounded-full" />
          </button>
        )
      })}
    </nav>
  )
}
