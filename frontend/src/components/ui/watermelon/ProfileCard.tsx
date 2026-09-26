import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Pencil, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { themeGradient, shuffled } from '@/lib/ui/skins'

/**
 * Expandable Profile Card — rebuilt from Watermelon UI's
 * `expandable-profile-card` against this app's tokens.
 *
 * The card is one surface with two sizes. Collapsed it answers "who is this?":
 * avatar, name, handle, one line of bio. Expanded it answers "tell me more":
 * the full bio, hobbies as chips (dealt in one after another), and labelled
 * facts. Height is animated rather than swapped so the page below never jumps —
 * the same complaint the quiz card had.
 *
 * It is used for the person using the app (Settings → Profile) and for the
 * maker (Settings → About), so both stop being a form and a paragraph.
 */
export interface ProfileFact {
  label: string
  value: string
  icon?: React.ReactNode
}

export interface ProfileCardProps {
  name: string
  handle?: string
  bio?: string
  /** Longer text shown only when expanded. */
  longBio?: string
  avatar?: React.ReactNode
  hobbies?: string[]
  facts?: ProfileFact[]
  /** Right-hand actions in the header (e.g. "Edit"). */
  actions?: React.ReactNode
  /** Start expanded. */
  defaultOpen?: boolean
  tone?: 'user' | 'maker'
  className?: string
}

export function ProfileCard({
  name, handle, bio, longBio, avatar, hobbies = [], facts = [], actions, defaultOpen = false, tone = 'user', className,
}: ProfileCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const gradient = useMemo(() => themeGradient(tone === 'maker' ? 'secondary' : 'primary'), [tone])
  // Shuffle once per mount: the same hobbies in a different order each visit
  // keeps a static card from looking like a form.
  const chips = useMemo(() => shuffled(hobbies).slice(0, open ? hobbies.length : 5), [hobbies, open])
  const initial = (name || '?').trim().charAt(0).toUpperCase()

  return (
    <motion.div
      layout
      className={clsx('surface overflow-hidden', className)}
      data-profile-card={tone}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      {/* Header — the gradient is derived from the active theme, so the card
          reads as part of the app in every palette, light ones included. */}
      <div className="relative">
        <div className="h-16 w-full" style={{ background: gradient }} aria-hidden />
        <div className="px-4 pb-3 -mt-8 flex items-end gap-3">
          <motion.div layout className="shrink-0 rounded-full p-[3px]" style={{ background: 'var(--surface)' }}>
            {avatar ?? (
              <span className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-semibold"
                style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>{initial}</span>
            )}
          </motion.div>
          <div className="flex-1 min-w-0 pb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-medium truncate">{name}</span>
              {tone === 'maker' && <ShieldCheck size={13} style={{ color: 'var(--success)' }} aria-label="Maker" />}
            </div>
            {handle && <div className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>@{handle}</div>}
          </div>
          <div className="flex items-center gap-1.5 pb-1">
            {actions}
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? 'Show less' : 'Show more'}
              className="p-1.5 rounded-[9px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}
            >
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }} className="flex">
                <ChevronDown size={14} />
              </motion.span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {bio && <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{bio}</p>}

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="more"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              {longBio && <p className="text-[12.5px] leading-relaxed mt-2.5" style={{ color: 'var(--text-3)' }}>{longBio}</p>}
              {facts.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3.5">
                  {facts.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <dt className="text-[10.5px] uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        {f.icon}{f.label}
                      </dt>
                      <dd className="text-[12.5px] truncate" style={{ color: 'var(--text-2)' }}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map((h, i) => (
              <motion.span
                key={h}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.24), duration: 0.2 }}
                className="px-2 py-0.5 rounded-full text-[11px]"
                style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--text-2)' }}
              >{h}</motion.span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/** The compact "Edit" affordance the card expects in `actions`. */
export function ProfileEditButton({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1.5 rounded-[9px] text-[11.5px]"
      style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
      <Pencil size={12} /> {label}
    </button>
  )
}
