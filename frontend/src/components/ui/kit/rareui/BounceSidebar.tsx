// RareUI · Bounce sidebar — a table-of-contents sidebar whose active marker
// springs between entries. Used for wiki-style pages in Library search.
import { motion } from 'motion/react'

export type TocItem = { id: string; label: string; depth?: number }

export function BounceSidebar({ items, activeId, onSelect, title = 'On this page' }: {
  items: TocItem[]; activeId?: string; onSelect: (id: string) => void; title?: string
}) {
  return (
    <nav aria-label={title} className="text-[12.5px]">
      <div className="text-[10.5px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--text-3)' }}>{title}</div>
      <ul className="relative">
        {items.map((it) => {
          const active = it.id === activeId
          return (
            <li key={it.id} className="relative">
              {active && (
                <motion.span layoutId="bounce-toc-marker" className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
                  style={{ background: 'var(--primary)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18, mass: 0.6 }} />
              )}
              <button type="button" onClick={() => onSelect(it.id)} aria-current={active ? 'true' : undefined}
                className="block w-full text-left py-1 pr-2 truncate"
                style={{ paddingLeft: 12 + (it.depth ?? 0) * 10, color: active ? 'var(--text)' : 'var(--text-2)', fontWeight: active ? 600 : 400 }}>
                {it.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
