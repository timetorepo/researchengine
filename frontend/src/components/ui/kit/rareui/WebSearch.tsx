// RareUI · Web search — shows the query being searched, a scan line while
// the search runs, and each result landing as it arrives.
import { motion } from 'motion/react'
import { Globe } from 'lucide-react'

export type WebHit = { title: string; url: string }

export function WebSearch({ query, hits, searching }: { query: string; hits: WebHit[]; searching: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] p-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      {searching && (
        <motion.div aria-hidden className="absolute inset-x-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }}
          initial={{ top: 0 }} animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
        <Globe size={13} aria-hidden style={{ color: 'var(--primary)' }} />
        <span className="truncate">{searching ? 'Searching the web for' : 'Searched for'} “{query}”</span>
      </div>
      <ul className="mt-2 space-y-1">
        {hits.slice(0, 6).map((h, i) => (
          <motion.li key={h.url} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.25 }}>
            <a href={h.url} target="_blank" rel="noreferrer" className="block truncate text-[12.5px] hover:underline" style={{ color: 'var(--text)' }}>{h.title}</a>
            <span className="block truncate text-[11px]" style={{ color: 'var(--text-3)' }}>{h.url}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
