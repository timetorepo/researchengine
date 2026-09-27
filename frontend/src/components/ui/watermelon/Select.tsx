import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { scrollChildIntoView } from '@/lib/dom/scroll'

/**
 * Select — rebuilt from Watermelon UI's select-11 for this app's tokens.
 *
 * A native `<select>` cannot be styled past its trigger, opens a menu the page
 * cannot animate, and on some platforms ignores the theme entirely; that is why
 * the same options looked like two different products depending on where they
 * were clicked. This is the one select the app uses instead: a real button +
 * listbox with the ARIA wiring (`aria-expanded`, `aria-activedescendant`,
 * roving focus), theme tokens for colour, and a staggered menu that matches the
 * rest of the shell.
 */
export interface SelectOption<T extends string = string> {
  value: T
  label: string
  hint?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SelectProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  label?: string
  /** Renders the trigger at input height instead of pill height. */
  size?: 'sm' | 'md'
  className?: string
  /** Right-aligned menu (for triggers near the right edge of a pane). */
  align?: 'left' | 'right'
  disabled?: boolean
  id?: string
}

export function Select<T extends string = string>({
  value, onChange, options, placeholder = 'Select…', label, size = 'md', className, align = 'left', disabled, id,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      setActive((i) => {
        const usable = options.map((o, idx) => (o.disabled ? -1 : idx)).filter((i2) => i2 >= 0)
        if (!usable.length) return i
        const at = usable.indexOf(i)
        if (e.key === 'ArrowDown') return usable[(at + 1 + usable.length) % usable.length]
        if (e.key === 'ArrowUp') return usable[(at - 1 + usable.length) % usable.length]
        if (e.key === 'Home') return usable[0]
        return usable[usable.length - 1]
      })
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, options])

  // The active row follows the keyboard, not just the pointer. Scrolled the
  // app's way — the *list* scrolls, never an ancestor (see lib/dom/scroll.ts:
  // scrollIntoView is what used to park the whole app frame at the bottom).
  useEffect(() => {
    if (!open || !listRef.current) return
    scrollChildIntoView(listRef.current, listRef.current.querySelector<HTMLElement>(`[data-index="${active}"]`))
  }, [open, active])

  const commit = (opt: SelectOption<T>) => {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
  }

  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[12px] rounded-[9px]' : 'px-3 py-2 text-[13px] rounded-[10px]'

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      {label && <span className="block text-[11.5px] mb-1" style={{ color: 'var(--text-3)' }}>{label}</span>}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, options.findIndex((o) => o.value === value))) }}
        className={clsx('w-full flex items-center gap-2 text-left disabled:opacity-50', pad)}
        style={{ background: 'var(--elevated)', border: `1px solid ${open ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`, color: 'var(--text)' }}
      >
        {selected?.icon && <span className="shrink-0 flex items-center">{selected.icon}</span>}
        <span className={clsx('flex-1 truncate', !selected && 'opacity-60')}>{selected?.label ?? placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="shrink-0" style={{ color: 'var(--text-3)' }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className={clsx('absolute z-50 mt-1.5 min-w-full max-w-[320px] max-h-[260px] overflow-y-auto p-1 rounded-[12px]', align === 'right' ? 'right-0' : 'left-0')}
            style={{ background: 'var(--surface, var(--elevated))', border: '1px solid var(--surface-border)', boxShadow: '0 18px 40px -18px rgba(0,0,0,0.65)', backdropFilter: 'blur(14px)' }}
          >
            {options.map((opt, i) => {
              const isSel = opt.value === value
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  data-index={i}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.018, 0.14), duration: 0.16 }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt)}
                  disabled={opt.disabled}
                  className={clsx('w-full flex items-center gap-2 px-2.5 py-2 rounded-[9px] text-left text-[12.5px] disabled:opacity-40')}
                  style={{
                    background: active === i ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent',
                    color: isSel ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.hint && <span className="block text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{opt.hint}</span>}
                  </span>
                  {isSel && <Check size={13} className="shrink-0" />}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
