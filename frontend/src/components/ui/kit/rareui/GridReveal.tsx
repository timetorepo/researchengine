// RareUI · Grid reveal — a placeholder grid of tiles while an image is being
// generated; when the image is ready the tiles fade out in a staggered wave.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function GridReveal({ src, ready, cols = 8, rows = 6, alt = 'Generated image', label = 'Generating image' }: {
  src?: string; ready: boolean; cols?: number; rows?: number; alt?: string; label?: string
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { if (ready) setRevealed(true) }, [ready])
  const tiles = Array.from({ length: cols * rows })

  return (
    <div className="relative rounded-[16px] overflow-hidden" style={{ aspectRatio: '4 / 3', background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      {src && revealed && <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        <AnimatePresence>
          {!revealed && tiles.map((_, i) => {
            const r = Math.floor(i / cols), c = i % cols
            return (
              <motion.span key={i} className="border"
                style={{ borderColor: 'var(--surface-border)', background: 'color-mix(in srgb, var(--primary) 9%, var(--elevated))' }}
                initial={{ opacity: 0.25 }}
                animate={{ opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: ((r + c) % 7) * 0.12 }}
                exit={{ opacity: 0, transition: { duration: 0.35, delay: (r + c) * 0.035 } }}
              />
            )
          })}
        </AnimatePresence>
      </div>
      {!revealed && (
        <div className="absolute bottom-2 left-3 text-[11.5px]" style={{ color: 'var(--text-2)' }} role="status">{label}…</div>
      )}
    </div>
  )
}
