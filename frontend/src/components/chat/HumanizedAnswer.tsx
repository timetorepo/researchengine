import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Eye, Feather, History, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { Markdown } from './Markdown'

/**
 * The humanized view of an answer.
 *
 * Green text is the rewrite; the model's original answer stays in `msg.content`
 * and is never shown in green — it is the "previous response", printed in red
 * inside the tooltip that opens when you hover (or tap, or focus) the rewrite.
 */
export function HumanizedAnswer({
  msg, onRestore, onShowOriginal,
}: {
  msg: ChatMessage
  /** Drop the rewrite and go back to the original answer. */
  onRestore: () => void
  /** Toggle the inline red "previous response" block. */
  onShowOriginal?: () => void
}) {
  const [hover, setHover] = useState(false)
  const [showPrev, setShowPrev] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tipPos, setTipPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  const text = msg.humanized ?? ''

  /** Keep the tooltip on screen no matter where the message sits. */
  const place = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(620, Math.max(280, r.width))
    const left = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - width - 12))
    // Below the text when there is room, above it otherwise.
    const room = window.innerHeight - r.bottom
    const top = room > 260 ? r.bottom + 8 : Math.max(12, r.top - 8 - Math.min(360, window.innerHeight * 0.5))
    setTipPos({ left, top, width })
  }

  const open = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null }
    place()
    setHover(true)
  }
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setHover(false), 120)
  }
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])

  useEffect(() => {
    if (!hover) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHover(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [hover])

  return (
    <div className="humanized-block ios-rise">
      {/* provenance row — what this is, and how to get back */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="humanize-badge">
          <Feather size={10} /> Humanized
        </span>
        {msg.humanizedBy && (
          <span className="text-[10.5px] font-mono" style={{ color: 'var(--text-3)' }}>{msg.humanizedBy}</span>
        )}
        <span className="text-[10.5px] hidden sm:inline" style={{ color: 'var(--text-3)' }}>
          hover the green text for the previous response
        </span>
        <div className="flex-1" />
        <button onClick={() => { setShowPrev((v) => !v); onShowOriginal?.() }} className="humanize-mini">
          <History size={10} /> {showPrev ? 'Hide previous' : 'Show previous'}
        </button>
        <button onClick={onRestore} className="humanize-mini" title="Go back to the original answer">
          <RotateCcw size={10} /> Restore original
        </button>
      </div>

      <div
        ref={anchorRef}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        onClick={() => { if (window.matchMedia('(hover: none)').matches) open() }}
        tabIndex={0}
        role="group"
        aria-label="Humanized answer — focus for the previous response"
        className="humanized-text"
      >
        <Markdown content={text} />
      </div>

      {/* The previous response, in red, inline (opt-in) */}
      <AnimatePresence initial={false}>
        {showPrev && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="previous-text mt-3">
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--danger)' }}>
                <History size={10} /> Previous response
              </div>
              <Markdown content={msg.content} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip: the previous response, in red */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {hover && tipPos && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              onMouseEnter={open}
              onMouseLeave={scheduleClose}
              className="humanize-tip ios-material"
              style={{ left: tipPos.left, top: tipPos.top, width: tipPos.width }}
              role="tooltip"
            >
              <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <History size={11} style={{ color: 'var(--danger)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--danger)' }}>Previous response</span>
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>what the model wrote before the rewrite</span>
                <div className="flex-1" />
                <button
                  onClick={() => { navigator.clipboard?.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
                  className="humanize-mini" title="Copy the original">
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                </button>
                <button onClick={() => setHover(false)} className="humanize-mini" aria-label="Close"><X size={10} /></button>
              </div>
              <div className="previous-text max-h-[300px] overflow-y-auto px-3 py-2.5">
                <Markdown content={msg.content} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** The live "rewriting…" state, so the wait is visible and cancellable. */
export function HumanizingIndicator({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px] py-1" style={{ color: 'var(--text-2)' }}>
      <span className="relative flex items-center justify-center">
        <Loader2 size={13} className="animate-spin" style={{ color: 'var(--success)' }} />
      </span>
      <span>Rewriting this answer so it reads like a person wrote it…</span>
      <button onClick={onCancel} className="humanize-mini">Cancel</button>
    </div>
  )
}

/** Shown instead of the green text when the rewrite failed. */
export function HumanizeError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2 mt-2 p-2.5 rounded-[12px] text-[12px]"
      style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--text-2)' }}>
      <Sparkles size={12} className="mt-0.5" style={{ color: 'var(--danger)' }} />
      <span className="flex-1">{message}</span>
      <button onClick={onRetry} className="humanize-mini"><Eye size={10} /> Retry</button>
    </div>
  )
}
