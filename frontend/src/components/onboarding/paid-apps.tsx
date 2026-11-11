/**
 * The paid look-alikes, drawn as favicons.
 *
 * Onboarding asks the user to notice one thing: every app on this screen does
 * what Research Engine does, and every one of them charges monthly. The icons
 * are the familiar favicon-sized brand marks, so the tiles read at a glance
 * the way a browser tab does.
 *
 * They are bundled here as inline SVG on purpose. Fetching the real favicon
 * from each vendor's site would mean the first run of a local-first, no-ping
 * app quietly calls six companies — the exact thing step 2 of this wizard
 * promises not to do. A browser tab's icon, drawn offline.
 *
 * Prices are the vendors' published entry tiers, shown as context only; the
 * point of the step is the "free" line at the bottom, not the arithmetic.
 */
import React from 'react'

export interface PaidApp {
  id: string
  /** The app, as it appears in a browser tab. */
  name: string
  /** What it does, in the same words Research Engine would use for itself. */
  does: string
  /** Published entry price, kept short — it is a chip, not a quote. */
  price: string
  /** Tile background, from the brand's own mark. */
  bg: string
  /** The mark itself. */
  glyph: React.ReactNode
}

const GLYPH_FILL = '#fff'

export const PAID_APPS: PaidApp[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    does: 'Answers, search, files',
    price: '$20/mo',
    bg: '#10a37f',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={GLYPH_FILL} aria-hidden>
        <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 17.25a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 18.9a4.5 4.5 0 0 1-6.14-1.65zM2.34 6.82a4.49 4.49 0 0 1 2.37-1.97V10.5a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L4 12.91a4.5 4.5 0 0 1-1.66-6.1zm16.6 3.86-5.83-3.39L15.12 6.1a.07.07 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.62a.79.79 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 8.17V5.83a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM7.08 12.68 5.06 11.5a.08.08 0 0 1-.04-.05V5.87a4.5 4.5 0 0 1 7.4-3.45l-.14.08L7.5 5.26a.79.79 0 0 0-.4.68zm1.09-2.36 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
      </svg>
    ),
  },
  {
    id: 'claude',
    name: 'Claude Pro',
    does: 'Long documents, writing',
    price: '$20/mo',
    bg: '#d97757',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={GLYPH_FILL} aria-hidden>
        {/* the sunburst mark: twelve rays from a centre gap */}
        {[0, 30, 60, 90, 120, 150].map((a) => (
          <rect key={a} x="11.35" y="2.4" width="1.3" height="8.2" rx="0.65" transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="2.1" fill={GLYPH_FILL} />
      </svg>
    ),
  },
  {
    id: 'perplexity',
    name: 'Perplexity Pro',
    does: 'Search with citations',
    price: '$20/mo',
    bg: '#20808d',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={GLYPH_FILL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* the knot: one line through the middle, two loops crossing it */}
        <path d="M12 3.2v17.6" />
        <path d="M12 7.4 7 3.4v6.2h10V3.4l-5 4z" />
        <path d="M7 20.6v-6.2h10v6.2l-5-4z" />
      </svg>
    ),
  },
  {
    id: 'gemini',
    name: 'Google AI Pro',
    does: 'Search, docs, email',
    price: '$19.99/mo',
    bg: '#1a73e8',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={GLYPH_FILL} aria-hidden>
        <path d="M12 2c.35 4.9 5.1 7.65 8.5 7.65.35 0 .7.35.7.7s-.35.7-.7.7c-3.4 0-8.15 2.75-8.5 7.65-.04.4-.35.7-.7.7s-.66-.3-.7-.7C10.25 13.75 5.5 11 2.1 11c-.35 0-.7-.35-.7-.7s.35-.7.7-.7c3.4 0 8.15-2.75 8.5-7.65.04-.4.35-.7.7-.7s.66.3.7.7z" />
      </svg>
    ),
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM Plus',
    does: 'Read & quiz your sources',
    price: 'in Google AI Pro',
    bg: '#f0a04b',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <rect x="4.6" y="3.4" width="14.8" height="17.2" rx="2.6" fill={GLYPH_FILL} />
        <path d="M8.4 8h7.2M8.4 11.6h7.2M8.4 15.2h4.4" stroke="#f0a04b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'notion',
    name: 'Notion AI',
    does: 'Notes with an assistant',
    price: '$10/mo add-on',
    bg: '#2f2f2f',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={GLYPH_FILL} aria-hidden>
        {/* the N: a white page with a slanted stroke through it */}
        <path d="M6.2 5.1 15.6 4l2.6 1.7v11.9l-2.4 1.1-7.1-.6-3.1 1.1V7.4l.6-2.3zm1.9 1.8v9.9l1.5-.5.3-6.6 4.6 6.2 1.5-.5V8.3l-1.4.4-.4 6.3-4.4-6-1.7.7z" />
      </svg>
    ),
  },
  {
    id: 'elicit',
    name: 'Elicit',
    does: 'Literature review',
    price: '$12/mo',
    bg: '#4b3fd6',
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.4" stroke={GLYPH_FILL} strokeWidth="1.6" />
        <path d="M8.4 12.4h7.2M8.4 9.2h7.2M8.4 15.6h4.4" stroke={GLYPH_FILL} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
]

/** One favicon tile: brand background, brand mark, tab-sized. */
export function Favicon({ app, size = 38 }: { app: PaidApp; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-[11px]"
      style={{
        width: size,
        height: size,
        background: app.bg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
      aria-hidden
    >
      <span style={{ transform: `scale(${size / 44})` }} className="flex items-center justify-center">
        {app.glyph}
      </span>
    </span>
  )
}
