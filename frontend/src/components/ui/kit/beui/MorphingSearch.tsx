// Beui-style morphing search: a round search button that grows into the full
// input when you focus or click it, and shrinks back when left empty.
import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Search, X } from 'lucide-react'

export function MorphingSearch({ value, onChange, onSubmit, placeholder = 'Search', label = 'Search', width = 280 }: {
  value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder?: string; label?: string; width?: number
}) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const expanded = open || value.length > 0
  return (
    <motion.form role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.() }}
      animate={{ width: expanded ? width : 36 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="relative h-9 rounded-full flex items-center overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <button type="button" aria-label={expanded ? `Focus ${label.toLowerCase()}` : label} onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0) }}
        className="grid place-items-center w-9 h-9 shrink-0" style={{ color: 'var(--text-2)' }}>
        <Search size={15} aria-hidden />
      </button>
      <input ref={input} type="search" value={value} placeholder={placeholder} aria-label={label}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] pr-2" style={{ color: 'var(--text)', opacity: expanded ? 1 : 0 }} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="grid place-items-center w-7 h-7 mr-1 shrink-0" style={{ color: 'var(--text-3)' }}>
          <X size={13} aria-hidden />
        </button>
      )}
    </motion.form>
  )
}
