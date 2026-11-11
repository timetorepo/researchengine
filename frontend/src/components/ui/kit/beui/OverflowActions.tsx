// Beui-style overflow actions: a "more" button that opens a small menu of
// row actions. Escape or a click outside closes it; danger items read red.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'

export type OverflowItem = { id: string; label: string; onSelect: () => void; danger?: boolean }

export function OverflowActions({ items, label = 'More actions' }: { items: OverflowItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={root} className="relative inline-block">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="grid place-items-center w-7 h-7 rounded-[7px]" style={{ color: 'var(--text-2)' }}>
        <MoreHorizontal size={15} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul role="menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }} className="absolute right-0 top-8 z-30 min-w-[160px] rounded-[10px] p-1 origin-top-right"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 28px -12px rgba(0,0,0,0.5)' }}>
            {items.map((it) => (
              <li key={it.id} role="none">
                <button type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect() }}
                  className="w-full text-left px-2.5 py-1.5 rounded-[7px] text-[12.5px] hover:bg-white/5"
                  style={{ color: it.danger ? 'var(--danger, #dc2626)' : 'var(--text)' }}>{it.label}</button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
