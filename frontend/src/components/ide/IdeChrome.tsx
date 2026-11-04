/**
 * The coding workspace's chrome.
 *
 * The taste this is drawn from, in one place so it can be argued with:
 *
 *   • Xcode 26 (Tahoe) — controls live in their own rounded groups floating on a
 *     translucent surface, separated by space rather than by rules; icons are
 *     monochrome; the accent appears only on the thing that is active. A row of
 *     twelve equal buttons is not that.
 *   • Zed — the chrome is quiet and the text is the point: no borders around the
 *     editor, small panel buttons in the status bar, nothing that competes with
 *     the document.
 *   • Cursor 3 — the agent is a first-class citizen: an agent is a row with a
 *     status glyph, a name, a timer and the repo it is working in, and its work
 *     ends in a review with a bottom action row rather than a wall of diff.
 *
 * Motion rules, and they are the part the round asked for: **no two interactions
 * repeat the same movement.**
 *
 *   press      → scale down, spring back            (GlassButton)
 *   hover      → a hairline under the label grows   (GlassButton.grow)
 *   switch     → the highlight glides between tabs  (GlassTabs)
 *   toggle     → the thumb slides and squashes      (GlassSwitch)
 *   appear     → segments stagger in from the left  (Breadcrumbs)
 *   activate   → one ring pulse, never a loop       (GlassButton.pulse)
 *   work       → a dot breathes only while it works (AgentGlyph)
 *   review     → the bar rises from the bottom edge (ReviewBar)
 *
 * Everything here is presentation: the state, the handlers and the keyboard
 * shortcuts stay in CodingView.
 */
import React, { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { ChevronRight, Check, Loader2, AlertTriangle, GitMerge, X, GitBranch, ArrowRight } from 'lucide-react'

/* ------------------------------ the glass bar ------------------------------ */

/**
 * A floating bar. In Xcode 26 the toolbar is a glass surface with grouped
 * controls on it, so the app's own panel colour is not enough: this adds the
 * blur, the inner highlight and the soft shadow that make the surface read as
 * glass over the editor underneath it.
 */
export function GlassBar({ children, className = '', 'data-ui': dataUi }: { children: React.ReactNode; className?: string; 'data-ui'?: string }) {
  return (
    <div data-ui={dataUi} className={`re-glassbar shrink-0 flex items-center gap-2 px-2.5 h-12 ${className}`}>
      {children}
    </div>
  )
}

/** A group of controls on the bar. Groups are separated by space, not rules. */
export function GlassGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`re-glassgroup flex items-center gap-0.5 px-1 py-1 ${className}`}>{children}</div>
}

/* --------------------------------- buttons --------------------------------- */

type MotionKind = 'press' | 'grow' | 'pulse'

export function GlassButton({ children, onClick, title, active, disabled, motionKind = 'press', className = '', 'data-ui': dataUi }: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  active?: boolean
  disabled?: boolean
  /** Which movement this button makes. Defaults to press. */
  motionKind?: MotionKind
  className?: string
  'data-ui'?: string
}) {
  const reduce = useReducedMotion()
  const [pulse, setPulse] = useState(0)
  return (
    <button
      data-ui={dataUi}
      onClick={(e) => {
        if (disabled) return
        if (motionKind === 'pulse') setPulse((n) => n + 1)
        onClick?.()
        // The grow movement is anchored where the finger landed, so the line
        // grows out of the click rather than from the middle of the label.
        const el = e.currentTarget as HTMLElement
        el.style.setProperty('--re-grow-x', `${((e.clientX - el.getBoundingClientRect().left) / Math.max(1, el.getBoundingClientRect().width)) * 100}%`)
      }}
      title={title}
      disabled={disabled}
      className={`re-glassbtn ${motionKind === 'grow' ? 'grow' : ''} ${active ? 'is-active' : ''} ${className}`}>
      {children}
      {motionKind === 'pulse' && !reduce && (
        <AnimatePresence>
          <motion.span key={pulse} aria-hidden className="re-pulse-ring"
            initial={{ opacity: 0.5, scale: 0.7 }} animate={{ opacity: 0, scale: 1.5 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }} />
        </AnimatePresence>
      )}
    </button>
  )
}

/* ----------------------------------- tabs ---------------------------------- */

/**
 * A segmented control whose highlight **glides** between options — one layout
 * animation shared by the whole group, so switching twice in a row is one
 * movement, not two fades.
 */
export function GlassTabs<T extends string>({ value, options, onChange, ariaLabel, className = '' }: {
  value: T
  options: { id: T; label: React.ReactNode; title?: string }[]
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <div className={`re-glasstabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} title={o.title} onClick={() => onChange(o.id)}
          className="re-glasstabs-item" data-active={value === o.id}>
          {value === o.id && !reduce && (
            <motion.span layoutId={`glass-tabs-${ariaLabel}`} className="re-glasstabs-pill"
              transition={{ type: 'spring', stiffness: 560, damping: 44 }} />
          )}
          {value === o.id && reduce && <span className="re-glasstabs-pill" />}
          <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- switch ---------------------------------- */

/** A switch whose thumb slides and squashes — Xcode's little steppers, grown up. */
export function GlassSwitch({ checked, onChange, label, title }: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  title?: string
}) {
  const reduce = useReducedMotion()
  return (
    <button onClick={() => onChange(!checked)} title={title ?? label} aria-pressed={checked}
      className="re-glassswitch" data-on={checked}>
      <span className="re-glassswitch-thumb">
        {!reduce && (
          <motion.span layout className="block w-full h-full rounded-full"
            animate={{ scaleX: checked ? 0.86 : 1 }} transition={{ type: 'spring', stiffness: 700, damping: 30 }} />
        )}
      </span>
      {label && <span className="text-[11px]">{label}</span>}
    </button>
  )
}

/* -------------------------------- breadcrumbs ------------------------------- */

/**
 * project › folder › file. Each segment arrives 24 ms after the one before it
 * (a stagger, which nothing else in this file uses), and each segment's label
 * underlines from the left on hover.
 */
export function Breadcrumbs({ path, project, onOpenProject, onPickSegment }: {
  /** The active file's path, split by us. */
  path: string
  project: string
  onOpenProject?: () => void
  onPickSegment?: (segmentIndex: number) => void
}) {
  const reduce = useReducedMotion()
  const parts = [project, ...path.split('/').filter(Boolean)]
  const last = parts.length - 1
  return (
    <nav className="re-breadcrumbs" aria-label="File path">
      {parts.map((part, i) => (
        <React.Fragment key={`${part}-${i}`}>
          {i > 0 && <ChevronRight size={9} className="re-breadcrumbs-sep" aria-hidden />}
          <motion.button
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(0.14, i * 0.024) }}
            onClick={() => (i === 0 ? onOpenProject?.() : onPickSegment?.(i - 1))}
            className="re-breadcrumbs-item"
            data-last={i === last}
            title={parts.slice(0, i + 1).join('/')}>
            {part}
          </motion.button>
        </React.Fragment>
      ))}
    </nav>
  )
}

/* --------------------------------- status bar -------------------------------- */

/** One Zed-style panel button: quiet until you point at it. */
export function StatusItem({ icon, children, onClick, title, tone, motionKind = 'press' }: {
  icon: React.ReactNode
  children?: React.ReactNode
  onClick?: () => void
  title?: string
  tone?: string
  motionKind?: MotionKind
}) {
  if (!onClick) {
    return (
      <span className="re-statusitem" title={title} style={{ color: tone }}>
        {icon}{children}
      </span>
    )
  }
  return (
    <GlassButton motionKind={motionKind} onClick={onClick} title={title}>
      <span className="re-statusitem" style={{ color: tone }}>{icon}{children}</span>
    </GlassButton>
  )
}

/* ---------------------------------- agents ---------------------------------- */

/**
 * An agent, as Cursor 3 draws one: a status glyph, what it is doing, the timer,
 * and the folder it is working in. The glyph is the state — a spinner that
 * turns while it works, a tick when its work is ready to review, a triangle when
 * it needs attention — and it breathes only in the state it describes.
 */
export function AgentGlyph({ state, size = 12 }: { state: 'working' | 'ready' | 'blocked' | 'idle'; size?: number }) {
  const reduce = useReducedMotion()
  if (state === 'working') return <Loader2 size={size} className={reduce ? '' : 'animate-spin'} style={{ color: 'var(--ide-accent)' }} />
  if (state === 'ready') return <Check size={size} style={{ color: 'var(--ide-cyan)' }} />
  if (state === 'blocked') return <AlertTriangle size={size} style={{ color: 'var(--ide-warn)' }} />
  return <span className="re-agentdot" style={{ width: size - 4, height: size - 4 }} />
}

export function AgentRow({ name, note, state, elapsed, repo, onOpen, actions }: {
  name: string
  note?: string
  state: 'working' | 'ready' | 'blocked' | 'idle'
  elapsed?: string
  repo?: string
  onOpen?: () => void
  actions?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div layout className="re-agentrow group" data-state={state}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}>
      <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 text-left" title={note ?? name}>
        <AgentGlyph state={state} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] truncate" style={{ color: 'var(--ide-text)' }}>{name}</span>
          {note && <span className="block text-[10px] truncate" style={{ color: 'var(--ide-faint)' }}>{note}</span>}
        </span>
        {repo && (
          <span className="re-chip" title="The folder this agent is working in">
            <GitBranch size={8} /> {repo}
          </span>
        )}
        {elapsed && <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--ide-faint)' }}>{elapsed}</span>}
      </button>
      {actions && <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">{actions}</span>}
    </motion.div>
  )
}

/* --------------------------------- the review -------------------------------- */

/**
 * The bottom action row Cursor 3 puts under an agent's work: what changed, and
 * the two things you can do about it. It rises from the bottom edge (nothing
 * else in this file moves upward), and the counts are the real diff numbers.
 */
export function ReviewBar({ added, removed, files, included, onReview, onMerge, onDiscard, busy }: {
  added: number
  removed: number
  files?: number
  /** How many files are ticked for the merge, when the count matters. */
  included?: number
  onReview?: () => void
  onMerge?: () => void
  onDiscard?: () => void
  busy?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      data-ui="ide-review-bar"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="re-reviewbar">
      <span className="re-reviewbar-count">
        {files ? <><b>{files}</b> file{files === 1 ? '' : 's'}</> : 'changes'}
        <span style={{ color: 'var(--ide-cyan)' }}>+{added}</span>
        <span style={{ color: 'var(--ide-danger)' }}>−{removed}</span>
      </span>
      <div className="flex-1" />
      {onReview && (
        <button onClick={onReview} className="re-reviewbar-btn">
          Review <ArrowRight size={10} />
        </button>
      )}
      {onDiscard && (
        <button onClick={onDiscard} className="re-reviewbar-btn ghost" title="Throw this agent's changes away">
          <X size={10} /> Discard
        </button>
      )}
      {onMerge && (
        <button onClick={onMerge} disabled={busy} className="re-reviewbar-btn primary"
          title="Merge the ticked files into the project">
          {busy ? <Loader2 size={10} className="animate-spin" /> : <GitMerge size={10} />}
          {typeof included === 'number' && typeof files === 'number' ? `Merge ${included}/${files}` : 'Merge'}
        </button>
      )}
    </motion.div>
  )
}

/* ---------------------------------- helpers --------------------------------- */

/** Elapsed time for an agent, ticking once a second and only while it works. */
export function useElapsed(startedAt?: number | null, live = true) {
  const [, force] = useState(0)
  const running = useRef(false)
  useEffect(() => {
    if (!startedAt || !live) { running.current = false; return }
    running.current = true
    const iv = setInterval(() => { if (running.current) force((n) => n + 1) }, 1000)
    return () => { running.current = false; clearInterval(iv) }
  }, [startedAt, live])
  if (!startedAt) return ''
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}
