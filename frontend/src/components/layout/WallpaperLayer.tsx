import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { wallpaperOf, wallpaperScrim } from '@/lib/wallpapers'

/**
 * The chosen wallpaper, behind everything.
 *
 * Two decisions worth stating, because both are choices and not defaults:
 *
 * 1. **The home screen only, unless asked otherwise.** An app you work in for
 *    hours is read, and reading happens in the theme's own surface. The
 *    wallpaper is on the landing view (where there is a hero and a composer,
 *    and very little type) and on other pages only if the switch is on.
 * 2. **Scrim by tone.** A wallpaper is a photograph of light. Rather than dim
 *    every image to the same mush, dark art is covered with the page colour at
 *    a fixed strength that fades at the top — so the art is strongest where
 *    nothing is written on it and the contrast under the composer is the
 *    theme's own.
 */
export function WallpaperLayer() {
  const wallpaperId = useStore((s) => s.settings.homeWallpaper)
  const everywhere = useStore((s) => s.settings.wallpaperEverywhere)
  const location = useLocation()
  const wallpaper = wallpaperOf(wallpaperId)

  const isHome = location.pathname === '/' || location.pathname === ''
  const show = !!wallpaper && (isHome || everywhere)

  return (
    <AnimatePresence>
      {show && wallpaper && (
        <motion.div
          key={wallpaper.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          aria-hidden
          data-home-wallpaper={wallpaper.id}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${wallpaper.file})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            // A slow drift, 40 seconds each way: enough that the surface feels
            // alive on a screen you leave open, far too slow to read as motion.
            animate={{ scale: [1.03, 1.07, 1.03] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0" style={{ background: wallpaperScrim(wallpaper.tone === 'dark') }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
