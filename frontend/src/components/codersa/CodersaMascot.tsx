import React from 'react'
import './codersa.css'

export type MascotState = 'idle' | 'busy' | 'done' | 'error'

/**
 * Codersa's mascot: a rounded code window with a `>_` prompt for a face,
 * a pair of braces for arms, and a four-point star that twinkles. It is an
 * SVG, so it stays crisp at any size, and its motion follows the agent's state.
 */
export function CodersaMascot({ state = 'idle', size = 72, title = 'Codersa' }: { state?: MascotState; size?: number; title?: string }) {
  const id = React.useId().replace(/:/g, '')
  return (
    <svg
      className="codersa-mascot shrink-0"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`cm-body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--primary) 55%, #5b5bf0)" />
        </linearGradient>
        <linearGradient id={`cm-star-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE38A" />
          <stop offset="1" stopColor="#FFB547" />
        </linearGradient>
      </defs>
      <g className="cm-bob">
        {/* Braces as arms. */}
        <path d="M14 46 Q8 46 8 54 L8 66 Q8 72 14 72" fill="none" stroke="var(--text-2)" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M106 46 Q112 46 112 54 L112 66 Q112 72 106 72" fill="none" stroke="var(--text-2)" strokeWidth="4.5" strokeLinecap="round" />
        {/* The window. */}
        <rect x="20" y="30" width="80" height="66" rx="20" fill={`url(#cm-body-${id})`} />
        <rect x="20" y="30" width="80" height="66" rx="20" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <path d="M22 50 H98" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="30" cy="40" r="2.4" fill="rgba(255,255,255,0.7)" />
        <circle cx="38" cy="40" r="2.4" fill="rgba(255,255,255,0.45)" />
        {/* The face: a `>_` prompt for the eyes, a small smile. */}
        <g className="cm-eyes">
          {state === 'error' ? (
            <path d="M36 66 L46 76 M46 66 L36 76 M74 66 L84 76 M84 66 L74 76" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          ) : state === 'done' ? (
            <path d="M34 72 Q40 64 46 72 M74 72 Q80 64 86 72" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          ) : (
            <>
              <path d="M32 62 L42 70 L32 78" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M52 80 H64" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
            </>
          )}
        </g>
        {state === 'busy' && <rect className="cm-cursor" x="70" y="58" width="5" height="12" rx="1.5" fill="#fff" />}
        {state === 'idle' && <path d="M68 74 Q76 80 84 74" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />}
        {state === 'busy' && <path d="M68 76 H84" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />}
        {/* The star. */}
        <g className="cm-star" transform="translate(96 22)">
          <path d="M0 -15 C1.8 -5 5 -1.8 15 0 C5 1.8 1.8 5 0 15 C-1.8 5 -5 1.8 -15 0 C-5 -1.8 -1.8 -5 0 -15 Z" fill={`url(#cm-star-${id})`} />
        </g>
      </g>
    </svg>
  )
}
