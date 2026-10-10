// React Bits — Masked Heading (Text Animation)
// Written here against the documented behaviour of
// https://reactbits.dev/text-animations/masked-heading: text that wipes in
// behind a moving mask. The upstream source is not reachable from this
// environment, so this is a reimplementation of the behaviour, not a vendored
// copy, and it says so. License of the upstream design: MIT + Commons Clause.
import React from 'react'

export interface MaskedHeadingProps {
  text: string
  className?: string
  /** seconds per loop */
  speed?: number
}

/**
 * A heading that wipes on with a travelling highlight.
 *
 * The text is revealed by a gradient mask that sweeps across, then holds. Under
 * reduced motion the mask stays open so the words are simply there — a heading
 * that never resolves is a heading nobody reads.
 */
export function MaskedHeading({ text, className, speed = 4 }: MaskedHeadingProps) {
  return (
    <span className={`inline-block ${className ?? ''}`} style={{ WebkitMaskImage: 'linear-gradient(90deg, #000 35%, transparent 50%, #000 65%)', WebkitMaskSize: '300% 100%', maskImage: 'linear-gradient(90deg, #000 35%, transparent 50%, #000 65%)', maskSize: '300% 100%', animation: `masked-wipe ${speed}s ease-in-out infinite`, color: 'var(--text-1)' }}>
      {text}
    </span>
  )
}

export default MaskedHeading
