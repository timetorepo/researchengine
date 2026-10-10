import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BrainCircuit, ChevronRight, Loader2 } from 'lucide-react'
import {
  splitPhases, PHASE_TONE, type ThinkingPhase,
} from '@/lib/chat/thinking-phases'
import { useStore } from '@/stores/useStore'
import { DUR, EASE } from '@/lib/ui/handoff'

/**
 * The chain of thought, as the phases it actually went through.
 *
 * A model reasons, then questions itself, then commits. Those are different
 * things at different times, and the one worth watching is the middle one. This
 * shows them as a timeline: the phase it is in now, the ones it has been
 * through, and the text of whichever you open.
 *
 * The segmentation is inferred from the text — paragraph breaks and the words a
 * model uses to turn a corner — and the UI says so, because claiming to know a
 * model's internal steps would be claiming something this does not do.
 *
 * A provider that exposes no reasoning at all renders nothing here, and the
 * message says that plainly rather than showing an empty box.
 */
export function ThinkingPhases({
  text,
  live = false,
  defaultOpen = false,
}: {
  text: string
  /** True while the provider is still streaming reasoning. */
  live?: boolean
  defaultOpen?: boolean
}) {
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const [open, setOpen] = useState(defaultOpen)
  const [picked, setPicked] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const phases = useMemo(() => splitPhases(text), [text])
  const active = live ? phases[phases.length - 1] : null
  const shown = phases.find((p) => p.id === picked) ?? null

  // Follow the reasoning while it streams. Only when the box is already open,
  // so a reader who closed it is not scrolled against their will.
  useEffect(() => {
    if (!live || !open) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text, live, open])

  if (!phases.length && !live) return null

  const kinds = new Map<string, number>()
  for (const p of phases) kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1)
  const tokens = Math.max(1, Math.round(text.length / 4))

  return (
    <div className="mb-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
        style={{ color: 'var(--text-2)' }}>
        {live && !text
          ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--primary)' }} />
          : <BrainCircuit size={12} style={{ color: 'var(--text-3)' }} />}
        <span className="text-[11.5px] font-medium">
          {live && !text
            ? 'Thinking'
            : phases.length > 1
              ? `Thought in ${phases.length} phases`
              : 'Chain of thought'}
        </span>
        {active && (
          <span className="text-[11px] truncate" style={{ color: PHASE_TONE[active.kind] }}>
            {active.label}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] shrink-0" style={{ color: 'var(--text-3)' }}>
          <span className="tabular-nums">{tokens} tok</span>
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: DUR.fast, ease: EASE }} className="inline-flex">
            <ChevronRight size={11} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: DUR.fast, ease: EASE }}
            style={{ overflow: 'hidden' }}>

            {/* The phases, in order, with the live one marked. */}
            <div className="px-2.5 pb-2 flex flex-col gap-0.5">
              {phases.map((p, i) => {
                const on = shown?.id === p.id
                const isActive = active?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPicked(on ? null : p.id)}
                    className="flex items-center gap-2 px-1.5 py-1 rounded-lg text-left"
                    style={{ background: on ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: PHASE_TONE[p.kind], opacity: isActive ? 1 : 0.45 }} />
                    <span className="text-[11px] truncate flex-1"
                      style={{ color: on ? 'var(--primary)' : 'var(--text-2)' }}>
                      {i + 1}. {p.label}
                    </span>
                    <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>
                      {Math.max(1, Math.round(p.text.length / 4))}
                    </span>
                    {isActive && <Loader2 size={9} className="animate-spin shrink-0" style={{ color: 'var(--primary)' }} />}
                  </button>
                )
              })}
              {!phases.length && live && (
                <div className="px-1.5 py-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                  Waiting for the model to start reasoning.
                </div>
              )}
            </div>

            {/* The text of the phase you opened. Without one picked, the whole
                chain, which is the honest default: the phases are an aid to
                reading it, not a replacement for it. */}
            <div
              ref={scrollRef}
              className="px-2.5 pb-2.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-auto"
              style={{ color: 'var(--text-3)', borderTop: '1px solid var(--surface-border)' }}>
              {shown ? shown.text : text}
            </div>

            <div className="px-2.5 pb-2 text-[10px]" style={{ color: 'var(--text-3)' }}>
              Phases are inferred from paragraph breaks and the words the model uses to turn a corner.
              {' '}{kinds.size} distinct {kinds.size === 1 ? 'kind' : 'kinds'} across {phases.length}{' '}
              {phases.length === 1 ? 'phase' : 'phases'}.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Whether a phase list is worth showing at all. */
export function hasPhases(text: string): boolean {
  return splitPhases(text).length > 0
}

export type { ThinkingPhase }
