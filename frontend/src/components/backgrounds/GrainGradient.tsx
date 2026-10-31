/**
 * GrainGradient: a painted, noise-textured backdrop for a panel or a whole screen.
 *
 * It combines three things that already exist in the product's visual language:
 * a warm painted scene (optional, the one bright object), a soft tinted gradient
 * mesh, and a fine film grain. The grain is inline SVG, so it costs no request.
 *
 * The painting is decoration: `alt=""`, lazy, and only shown when a path is given.
 * Pass `grain={0}` and no painting to get a plain gradient.
 */
import type { CSSProperties, ReactNode } from 'react'
import './GrainGradient.css'

export type GrainTint = 'accent' | 'warm' | 'cool'

export interface GrainGradientProps {
  /** Which mesh colours to use. `accent` follows the theme accent. */
  tint?: GrainTint
  /** Grain strength, 0 to 1. Around 0.12 reads as paper; above 0.25 reads as noise. */
  grain?: number
  /** Slow drift of the gradient. Off under prefers-reduced-motion either way. */
  drift?: boolean
  /** Optional painting, a JPEG path under /public. */
  painting?: string
  /** Optional WebP version of the painting, preferred when supported. */
  paintingWebp?: string
  /** Where the painting is anchored when cropped, e.g. "50% 40%". */
  paintingFocus?: string
  /** How strongly the painting shows, 0 to 1. */
  paintingStrength?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function GrainGradient({
  tint = 'accent',
  grain = 0.12,
  drift = true,
  painting,
  paintingWebp,
  paintingFocus = '50% 50%',
  paintingStrength = 0.6,
  className = '',
  style,
  children,
}: GrainGradientProps) {
  const classes = [
    'grain-gradient rounded-[22px]',
    tint !== 'accent' ? `grain-gradient--${tint}` : '',
    drift ? 'grain-gradient--drift' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const cssVars = {
    '--grain-strength': clamp(grain),
    '--grain-painting-strength': clamp(paintingStrength),
    ...style,
  } as CSSProperties

  return (
    <div className={classes} style={cssVars} data-grain-gradient>
      <div aria-hidden="true" className="grain-gradient__mesh" />
      {painting && (
        <>
        <picture className="pointer-events-none" aria-hidden="true">
          {paintingWebp && <source srcSet={paintingWebp} type="image/webp" />}
          <img
            src={painting}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="grain-gradient__painting"
            style={{ objectPosition: paintingFocus }}
          />
        </picture>
        <div aria-hidden="true" className="grain-gradient__wash" />
        </>
      )}
      {grain > 0 && <div aria-hidden="true" className="grain-gradient__grain" />}
      <div className="grain-gradient__content">{children}</div>
    </div>
  )
}
