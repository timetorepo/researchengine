import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AnimatedBgKind } from '@/types'
import type { BgThemeProps, Vec3 } from '@/lib/backgrounds/themeProps'

/**
 * ReactBits backgrounds, vendored from DavidHDev/react-bits (JS-CSS variants,
 * see components/reactbits/LICENSE-REACTBITS.md). Each one is lazy-loaded, so
 * a kind only ships its code when it is the active background.
 *
 * Colours come from the active theme's swatches, so switching themes re-tints
 * these live, the same as the built-in kinds.
 */

type Props = { theme: BgThemeProps }
type RB = LazyExoticComponent<ComponentType<Props>>

const hex = (v: Vec3) => '#' + v.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
const pal = (t: BgThemeProps) => ({ p: hex(t.primary), s: hex(t.secondary), bg: hex(t.bg) })

/** Build a lazy background from a ReactBits module and a theme → props mapping. */
function rb(
  load: () => Promise<{ default: ComponentType<any> }>,
  mapProps: (t: BgThemeProps) => Record<string, unknown>,
): RB {
  return lazy(async () => {
    const mod = await load()
    const Bg = mod.default
    return {
      default: function ReactBitsBackground({ theme }: Props) {
        return <Bg {...mapProps(theme)} />
      },
    }
  })
}

export const REACTBITS_BACKGROUNDS: Partial<Record<AnimatedBgKind, RB>> = {
  'gradient-ascii': rb(() => import('@/components/reactbits/GradientASCII/GradientASCII'), (t) => {
    const c = pal(t)
    return { colors: [c.bg, c.p, c.s] }
  }),
  'ghost-fibers': rb(() => import('@/components/reactbits/GhostFibers/GhostFibers'), (t) => {
    const c = pal(t)
    return { glowColor: c.p, secondaryColor: c.s }
  }),
  topography: rb(() => import('@/components/reactbits/Topography/Topography'), (t) => ({ color: pal(t).p })),
  prism: rb(() => import('@/components/reactbits/Prism/Prism'), (t) => {
    const c = pal(t)
    return { colors: [c.p, c.s] }
  }),
  'light-pillar': rb(() => import('@/components/reactbits/LightPillar/LightPillar'), (t) => {
    const c = pal(t)
    return { topColor: c.p, bottomColor: c.s }
  }),
  antigravity: rb(() => import('@/components/reactbits/Antigravity/Antigravity'), (t) => {
    const c = pal(t)
    return { colors: [c.p, c.s] }
  }),
  silk: rb(() => import('@/components/reactbits/Silk/Silk'), (t) => ({
    color: pal(t).p,
    clickRipple: false,
  })),
  'pixel-blast': rb(() => import('@/components/reactbits/PixelBlast/PixelBlast'), (t) => ({ color: pal(t).p })),
  'color-bends': rb(() => import('@/components/reactbits/ColorBends/ColorBends'), (t) => {
    const c = pal(t)
    return { colors: [c.p, c.s] }
  }),
  plasma: rb(() => import('@/components/reactbits/Plasma/Plasma'), (t) => ({ color: pal(t).p })),
  'prismatic-burst': rb(() => import('@/components/reactbits/PrismaticBurst/PrismaticBurst'), (t) => {
    const c = pal(t)
    return { colors: [c.p, c.s] }
  }),
  galaxy: rb(() => import('@/components/reactbits/Galaxy/Galaxy'), (t) => {
    const c = pal(t)
    return { starColors: [c.p, c.s, '#ffffff'], mouseRepulsion: false }
  }),
  'liquid-chrome': rb(() => import('@/components/reactbits/LiquidChrome/LiquidChrome'), (t) => ({
    color: pal(t).p,
    interactive: false,
  })),
  'floating-lines': rb(() => import('@/components/reactbits/FloatingLines/FloatingLines'), (t) => {
    const c = pal(t)
    return { linesGradient: [c.p, c.s] }
  }),
}
