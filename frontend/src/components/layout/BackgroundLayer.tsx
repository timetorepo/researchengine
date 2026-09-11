import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/stores/useStore'

/** Custom app background, rendered behind all chrome. */
export function BackgroundLayer() {
  const bg = useStore((s) => s.settings.background)
  if (!bg || bg.kind === 'default') return null

  const key = bg.kind + ('dataUrl' in bg ? bg.dataUrl.slice(0, 48) : '')

  return (
    <AnimatePresence>
      <motion.div
        key={key}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        {bg.kind === 'solid' && (
          <div className="absolute inset-0" style={{ background: bg.color }} />
        )}

        {(bg.kind === 'image' || bg.kind === 'blur') && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bg.dataUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: bg.kind === 'blur' ? 'blur(26px) saturate(1.1)' : undefined,
              transform: bg.kind === 'blur' ? 'scale(1.08)' : undefined,
            }}
          />
        )}

        {bg.kind === 'blur' && (
          // readability aid over blurred imagery
          <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--bg) 30%, transparent)' }} />
        )}

        {bg.kind === 'veil' && (
          <>
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${bg.opacity})` }} />
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(120% 90% at 50% 0%, transparent 40%, rgba(0,0,0,0.35) 100%)',
            }} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
