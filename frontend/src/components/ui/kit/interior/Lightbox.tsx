// Interior-style lightbox: a full-screen view of one image. Opens with a quick
// fade and scale (0.22s, a touch quicker than the default); Escape closes it.
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

export function Lightbox({ src, alt, onClose }: { src: string | null; alt?: string; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [src, onClose])
  return (
    <AnimatePresence>
      {src && (
        <motion.div role="dialog" aria-modal="true" aria-label={alt ?? 'Image'} onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[80] grid place-items-center p-6 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.78)' }}>
          <motion.img src={src} alt={alt ?? ''} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }} transition={{ duration: 0.22, ease: 'easeOut' }}
            className="max-h-full max-w-full rounded-[12px] cursor-default" />
          <button type="button" onClick={onClose} aria-label="Close image" className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}><X size={16} aria-hidden /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
