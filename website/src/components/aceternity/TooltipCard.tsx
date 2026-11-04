/**
 * Tooltip Card — Aceternity UI, re-implemented for the site (R17/R19).
 *
 * `npx shadcn@latest add @aceternity/tooltip-card-demo` needs
 * ui.aceternity.com, which is unreachable from this build machine, and the
 * published npm copies of the Aceternity set (xlibs-components,
 * multi-ui-bundle, aceternity-ui) do not carry this one item. So this is a
 * faithful re-implementation of the documented behaviour rather than a copy:
 * the card is a hover/focus disclosure that shows a title, a line of context
 * and an optional picture, anchored to the thing it describes.
 *
 * What differs, on purpose:
 *   • It is driven by the AI as a tool call, not by the mouse alone. The chat
 *     renders it from `message.tooltipCards`, so it can only appear when the
 *     model actually summoned one — a model that cannot call tools cannot make
 *     a card appear, which is what the feature is supposed to mean.
 *   • The picture is optional and its absence is a normal state (a card with a
 *     headline and a source is still useful), so nothing is fetched by default.
 *   • Anchoring is viewport-based and clamped, like LinkPreview, so a card can
 *     never be clipped by the answer's own scroller.
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface TooltipCardData {
  /** What the card is about, one line. */
  title: string
  /** The supporting line: a definition, a date, a caveat. */
  body?: string
  /** Optional image URL (a page's og:image, a chart, a diagram). */
  image?: string
  /** Where it came from, shown small at the bottom. */
  source?: string
  /** Optional link, so the card is actionable. */
  url?: string
}

export function TooltipCard({
  data,
  children,
  className,
}: {
  data: TooltipCardData
  children?: React.ReactNode
  className?: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const place = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(300, window.innerWidth - 24)
    setPos({
      left: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)),
      top: Math.max(12, Math.min(r.bottom + 10, window.innerHeight - 200)),
    })
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const enter = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { place(); setOpen(true) }, 120)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 140)
  }

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={enter}
        onBlur={leave}
        tabIndex={0}
        className={cn('relative inline underline decoration-dotted underline-offset-2 cursor-help', className)}
        style={{ textDecorationColor: 'var(--primary)' }}>
        {children ?? data.title}
      </span>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 3, scale: 0.99 }}
              transition={{ duration: 0.15 }}
              onMouseEnter={enter}
              onMouseLeave={leave}
              className="fixed z-[95] rounded-[12px] overflow-hidden"
              style={{
                left: pos.left, top: pos.top, width: 300,
                background: 'var(--surface)', border: '1px solid var(--surface-border)',
                boxShadow: '0 16px 40px -18px rgba(0,0,0,0.5)',
              }}>
              {data.image && (
                <img src={data.image} alt="" loading="lazy" referrerPolicy="no-referrer"
                  className="w-full h-[132px] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <div className="p-3">
                <div className="text-[12px] font-medium leading-snug">{data.title}</div>
                {data.body && <p className="text-[11.5px] mt-1 leading-snug" style={{ color: 'var(--text-2)' }}>{data.body}</p>}
                {(data.source || data.url) && (
                  <div className="text-[10.5px] mt-1.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {data.url ? <a href={data.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--primary)' }}>{data.source ?? data.url}</a> : data.source}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/**
 * The list a message carries. Cards are rendered inline under the answer, and
 * each one opens its own hover card, so a tool call that produced five cards is
 * five anchors rather than five floating panels fighting for the screen.
 */
export function TooltipCardStrip({ cards }: { cards: TooltipCardData[] }) {
  if (!cards.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" data-ui="tooltip-cards">
      {cards.map((c, i) => (
        <span key={i} className="px-2 py-1 rounded-full text-[11px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <TooltipCard data={c}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
              {c.title}
            </span>
          </TooltipCard>
        </span>
      ))}
    </div>
  )
}
