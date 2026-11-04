/**
 * A warm oil-painting backdrop for a panel: the painting sits behind the content,
 * and a theme-coloured wash keeps the text readable on top of it.
 *
 * Used on the Home hero and the Codersa empty state. Painted art is decoration,
 * so the image is always `alt=""` and the content is the only thing a screen
 * reader sees.
 *
 * Cost, kept deliberately small:
 * - one <img> per backdrop, lazy-loaded, WebP with a JPEG fallback;
 * - the drift and fade run on transform and opacity only (compositor work);
 * - both motions switch off under `prefers-reduced-motion`.
 */
import type { CSSProperties, ReactNode } from 'react'
import './PaintedBackdrop.css'

export interface PaintedBackdropProps {
  /** JPEG path under /public, the fallback for browsers without WebP. */
  src: string
  /** Optional WebP path under /public; preferred when supported. */
  webp?: string
  /** Where the painting is anchored when cropped, e.g. "50% 40%". */
  focus?: string
  /** How strongly the painting shows, 0 to 1. The wash sits on top of it. */
  strength?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function PaintedBackdrop({
  src,
  webp,
  focus = '50% 50%',
  strength = 0.55,
  className = '',
  style,
  children,
}: PaintedBackdropProps) {
  const clamped = Math.min(1, Math.max(0, strength))
  return (
    <div
      className={`painted-backdrop relative isolate overflow-hidden rounded-[22px] ${className}`}
      style={style}
      data-painted-backdrop
    >
      <picture
        className="painted-backdrop__art pointer-events-none absolute inset-0 -z-10 block"
        style={{ ['--painted-strength' as string]: clamped }}
      >
        {webp && <source srcSet={webp} type="image/webp" />}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          className="painted-backdrop__img h-full w-full object-cover"
          style={{ objectPosition: focus }}
        />
      </picture>
      {/* The wash: solid at the bottom where most text sits, see-through at the top. */}
      <div
        aria-hidden="true"
        className="painted-backdrop__wash pointer-events-none absolute inset-0 -z-10"
      />
      <div className="relative">{children}</div>
    </div>
  )
}
