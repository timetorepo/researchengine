import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { getPropsForTheme, mixVec3, ANIMATED_BG_META, type BgThemeProps } from '@/lib/backgrounds/themeProps'
import type { AnimatedBgKind } from '@/types'
import { REACTBITS_BACKGROUNDS } from './reactBitsBackgrounds'

/**
 * BackgroundManager — mounts the active animated background.
 * - WebGL kinds are lazy-loaded so three.js only ships when one is selected.
 * - Everything unmounts while the tab is hidden (visibility pause).
 * - Eco profile / reduced motion get a static CSS fallback (no rAF, no GL).
 */

const ShapeGrid = lazy(() => import('./ShapeGrid'))
const DarkVeil = lazy(() => import('./DarkVeil'))
const Dither = lazy(() => import('./Dither'))
const AnimatedGradient = lazy(() => import('./AnimatedGradient'))
const EtchedAccretion = lazy(() => import('./EtchedAccretion'))
const CubesGrid = lazy(() => import('./CubesGrid'))

function rgb(v: [number, number, number]) {
  return `rgb(${v.map((c) => Math.round(c * 255)).join(',')})`
}

/** Static CSS approximation per kind — the eco/reduced-motion fallback. */
function EcoFallback({ kind, theme, intensity }: { kind: AnimatedBgKind; theme: BgThemeProps; intensity: number }) {
  const bg = rgb(theme.bg)
  const style = useMemo<React.CSSProperties>(() => {
    switch (kind) {
      case 'shape-grid':
        return {
          background: bg,
          backgroundImage:
            'linear-gradient(rgba(128,128,128,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.07) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          opacity: 0.4 + intensity * 0.5,
        }
      case 'dark-veil': {
        const tint = rgb(mixVec3(theme.bg, theme.primary, 0.12))
        return {
          background: `radial-gradient(120% 90% at 30% 0%, ${tint} 0%, ${bg} 60%), radial-gradient(120% 90% at 75% 100%, ${tint} 0%, ${bg} 55%)`,
          opacity: Math.min(1, intensity + 0.2),
        }
      }
      case 'animated-gradient':
        return {
          background: `radial-gradient(120% 90% at 50% 110%, ${rgb(mixVec3(theme.bg, theme.primary, 0.45))} 0%, ${bg} 65%)`,
          opacity: Math.min(1, intensity + 0.1),
        }
      case 'cubes-grid':
        // Static stand-in: a faint isometric lattice in the theme's tones.
        return {
          background: bg,
          backgroundImage: `linear-gradient(30deg, ${rgb(mixVec3(theme.bg, theme.primary, 0.1))} 25%, transparent 25%), linear-gradient(-30deg, ${rgb(mixVec3(theme.bg, theme.primary, 0.1))} 25%, transparent 25%)`,
          backgroundSize: '64px 37px',
          opacity: Math.min(1, intensity + 0.2),
        }
      case 'etched-accretion':
        return {
          background: `radial-gradient(60% 60% at 50% 50%, ${rgb(mixVec3(theme.bg, theme.primary, 0.18))} 0%, ${bg} 70%)`,
          opacity: Math.min(1, intensity + 0.2),
        }
      case 'dither': {
        const c = rgb(mixVec3(theme.bg, theme.primary, 0.25))
        return {
          background: bg,
          backgroundImage: `repeating-conic-gradient(${c} 0% 25%, transparent 0% 50%)`,
          backgroundSize: '6px 6px',
          opacity: 0.35 * intensity + 0.2,
        }
      }
      default:
        // ReactBits kinds: a static theme-tinted glow when motion is off.
        return {
          background: `radial-gradient(120% 90% at 50% 0%, ${rgb(mixVec3(theme.bg, theme.primary, 0.22))} 0%, ${bg} 65%)`,
          opacity: Math.min(1, intensity + 0.2),
        }
    }
  }, [kind, theme, intensity, bg])
  return <div className="absolute inset-0" style={style} aria-hidden="true" />
}

export function BackgroundManager({ kind, intensity }: { kind: AnimatedBgKind; intensity?: number }) {
  const themeId = useStore((s) => s.settings.theme)
  const profile = useStore((s) => s.settings.performanceProfile)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const theme = useMemo<BgThemeProps>(() => getPropsForTheme(themeId), [themeId])
  const level = intensity ?? ANIMATED_BG_META[kind].defaultIntensity

  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const eco = profile === 'eco' || reduceMotion

  // Pause entirely while hidden — no GPU work for an invisible tab.
  if (!visible) return null
  if (eco) return <EcoFallback kind={kind} theme={theme} intensity={level} />

  const ReactBitsBg = REACTBITS_BACKGROUNDS[kind]

  return (
    <Suspense fallback={null}>
      {kind === 'shape-grid' && <ShapeGrid theme={theme} intensity={level} />}
      {kind === 'dark-veil' && <DarkVeil theme={theme} intensity={level} />}
      {ReactBitsBg && (
        <div className="absolute inset-0" style={{ opacity: 0.35 + level * 0.65 }} aria-hidden="true">
          <ReactBitsBg theme={theme} />
        </div>
      )}
      {kind === 'dither' && <Dither theme={theme} intensity={level} />}
      {kind === 'animated-gradient' && <AnimatedGradient opacity={0.35 + level * 0.65} />}
      {kind === 'etched-accretion' && <EtchedAccretion opacity={0.4 + level * 0.6} />}
      {kind === 'cubes-grid' && <CubesGrid theme={theme} intensity={level} />}
    </Suspense>
  )
}
