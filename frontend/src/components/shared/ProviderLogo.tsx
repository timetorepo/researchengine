import React from 'react'
import { BRAND_MARKS } from './brandMarks'

/** Official brand path from brandMarks.ts, sized and tinted like the others. */
function BrandMark({ id, size }: { id: string; size: number }) {
  const m = BRAND_MARKS[id]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={m.title}>
      <path d={m.path} />
    </svg>
  )
}

// Bundled as inline SVG — never fetched. Tint-able via currentColor where possible.
export function ProviderLogo({ id, size = 16 }: { id: string; size?: number }) {
  const s = { width: size, height: size }
  switch (id) {
    case 'openai':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 17.25a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 18.9a4.5 4.5 0 0 1-6.14-1.65zM2.34 6.82a4.49 4.49 0 0 1 2.37-1.97V10.5a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L4 12.91a4.5 4.5 0 0 1-1.66-6.1zm16.6 3.86-5.83-3.39L15.12 6.1a.07.07 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.62a.79.79 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 8.17V5.83a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM7.08 12.68 5.06 11.5a.08.08 0 0 1-.04-.05V5.87a4.5 4.5 0 0 1 7.4-3.45l-.14.08L7.5 5.26a.79.79 0 0 0-.4.68zm1.09-2.36 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
        </svg>
      )
    case 'anthropic':
      return <BrandMark id="anthropic" size={size} />
    case 'groq':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.3 0 2.54-.25 3.68-.7v-4.1a6.05 6.05 0 0 1-3.68 1.25A6.45 6.45 0 0 1 5.55 12 6.45 6.45 0 0 1 12 5.55 6.45 6.45 0 0 1 18.45 12v8.82A10 10 0 0 0 22 12C22 6.48 17.52 2 12 2z" />
        </svg>
      )
    case 'ollama':
      return <BrandMark id="ollama" size={size} />
    case 'nim':
      return <BrandMark id="nim" size={size} />
    case 'gemini':
      return <BrandMark id="gemini" size={size} />
    case 'mistral':
    case 'perplexity':
    case 'lmstudio':
      return <BrandMark id={id} size={size} />
    default:
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1M6.3 17.7l2.1-2.1m7.2-7.2 2.1-2.1" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      )
  }
}
