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
            {/* Designed dark base so the veil is visible over ANY theme,
                not just an invisible black-on-black overlay. */}
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(130% 90% at 50% -10%, color-mix(in srgb, var(--primary) 9%, transparent) 0%, transparent 48%),
                radial-gradient(130% 90% at 50% 115%, color-mix(in srgb, var(--secondary) 10%, transparent) 0%, transparent 48%),
                linear-gradient(180deg, #101015 0%, #060608 55%, #020203 100%)
              `,
            }} />
            {/* Intensity layer — the slider deepens the veil, never hides content. */}
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${Math.min(0.6, bg.opacity * 0.75)})` }} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
