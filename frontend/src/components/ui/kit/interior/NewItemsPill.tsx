// Interior-style new-items pill: when items arrive while you have scrolled up,
// a pill offers to jump to them instead of yanking the view down.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown } from 'lucide-react'

/** Counts items that arrived while the reader was away from the bottom. */
export function useNewItems(itemCount: number, atBottom: boolean) {
  const [count, setCount] = useState(0)
  const last = useRef(itemCount)
  useEffect(() => {
    if (atBottom) { setCount(0); last.current = itemCount; return }
    if (itemCount > last.current) setCount((c) => c + (itemCount - last.current))
    last.current = itemCount
  }, [itemCount, atBottom])
  return { count, clear: () => setCount(0) }
}

export function NewItemsPill({ count, onClick, label = 'new' }: { count: number; onClick: () => void; label?: string }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button type="button" onClick={onClick}
          initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] shadow-md"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <ArrowDown size={12} aria-hidden /> {count} {label}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
