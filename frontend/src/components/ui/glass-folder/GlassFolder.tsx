"use client"

/**
 * GlassFolder: a frosted-glass folder for the Library shelf.
 *
 * Written for ResearchEngine to the public API of the 21st.dev component
 * "Glassmorphism Folder Cards" by Kedhareswer Naidu (MIT). The registry's
 * source could not be fetched from the build sandbox, so this file is an
 * independent implementation of the same props and behaviour, not a copy of
 * the registry's code. Props: label, meta, tone, files, menu, labelPlacement,
 * appearDelay, open / defaultOpen, onOpenChange, onFileOpen.
 *
 * Behaviour: the folder drops in after `appearDelay`, leans its glass toward
 * the pointer, and opens on click or Enter to fan its files out as buttons.
 * The menu button opens a list of actions. Reduced motion turns the lean and
 * the drop-in off.
 */
import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MoreHorizontal, FileText } from 'lucide-react'

export interface GlassFolderFile {
  id?: string
  name: string
  meta?: string
}

export interface GlassFolderMenuItem {
  label: string
  danger?: boolean
  onSelect: () => void
}

export interface GlassFolderProps {
  label: string
  meta?: string
  tone?: 'light' | 'dark'
  files?: GlassFolderFile[]
  menu?: GlassFolderMenuItem[]
  labelPlacement?: 'top-left' | 'bottom'
  appearDelay?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onFileOpen?: (file: GlassFolderFile) => void
  className?: string
}

export default function GlassFolder({
  label,
  meta,
  tone = 'light',
  files = [],
  menu,
  labelPlacement = 'bottom',
  appearDelay = 0,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onFileOpen,
  className,
}: GlassFolderProps) {
  const reduce = useReducedMotion()
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen)
  const open = controlledOpen ?? innerOpen
  const [lean, setLean] = React.useState({ x: 0, y: 0 })
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [landed, setLanded] = React.useState(!appearDelay)
  const ref = React.useRef<HTMLDivElement>(null)
  const dark = tone === 'dark'

  React.useEffect(() => {
    if (landed) return
    const t = window.setTimeout(() => setLanded(true), appearDelay)
    return () => window.clearTimeout(t)
  }, [appearDelay, landed])

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInnerOpen(next)
    onOpenChange?.(next)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setLean({ x: py * -10, y: px * 12 })
  }

  const glass = dark
    ? 'linear-gradient(160deg, rgba(40,40,48,0.78), rgba(14,14,18,0.82))'
    : 'linear-gradient(160deg, rgba(255,255,255,0.46), rgba(255,255,255,0.14))'
  const edge = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)'
  const ink = dark ? '#f5f5f5' : 'var(--text-1, #1b1b1f)'

  return (
    <div
      ref={ref}
      className={`relative inline-flex flex-col items-center ${className ?? ''}`}
      style={{ width: 190 }}
      onPointerMove={onMove}
      onPointerLeave={() => setLean({ x: 0, y: 0 })}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 26, scale: 0.96 }}
        animate={landed ? { opacity: 1, y: 0, scale: 1 } : undefined}
        transition={{ type: 'spring', damping: 22, stiffness: 240 }}
        className="relative w-full"
        style={{ perspective: 900 }}
      >
        {/* files, fanned out above the folder when it is open */}
        <AnimatePresence>
          {open && files.length > 0 && (
            <div className="absolute inset-x-2 bottom-[62%] z-10 flex flex-col gap-1.5">
              {files.slice(0, 4).map((f, i) => (
                <motion.button
                  key={f.id ?? `${f.name}-${i}`}
                  type="button"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: -(i + 1) * 2 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: reduce ? 0 : i * 0.05, type: 'spring', damping: 24, stiffness: 300 }}
                  onClick={(e) => { e.stopPropagation(); onFileOpen?.(f) }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] text-left text-[11.5px] truncate"
                  style={{
                    background: dark ? 'rgba(30,30,36,0.92)' : 'rgba(255,255,255,0.92)',
                    color: dark ? '#f5f5f5' : '#1b1b1f',
                    border: `1px solid ${edge}`,
                    boxShadow: '0 6px 18px -8px rgba(0,0,0,0.35)',
                  }}
                >
                  <FileText size={12} className="shrink-0 opacity-70" />
                  <span className="truncate">{f.name}</span>
                  {f.meta && <span className="ml-auto text-[10px] opacity-60 shrink-0">{f.meta}</span>}
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${label} folder`}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) }
            if (e.key === 'Escape') setOpen(false)
          }}
          className="relative w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-[22px]"
          style={{
            transform: reduce ? undefined : `rotateX(${lean.x}deg) rotateY(${lean.y}deg)`,
            transition: 'transform 220ms cubic-bezier(0.23,1,0.32,1)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* folder tab, behind the glass */}
          <div
            aria-hidden
            className="absolute -top-3 left-3 h-5 w-[42%] rounded-t-[10px]"
            style={{ background: dark ? 'rgba(24,24,30,0.9)' : 'rgba(255,255,255,0.35)', border: `1px solid ${edge}`, borderBottom: 'none' }}
          />
          {/* the glass */}
          <div
            className="relative h-[124px] w-full rounded-[22px] overflow-hidden"
            style={{
              background: glass,
              backdropFilter: 'blur(16px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
              border: `1px solid ${edge}`,
              boxShadow: `inset 0 1px 0 ${edge}, 0 18px 40px -22px rgba(0,0,0,0.45)`,
            }}
          >
            {/* a soft highlight that moves with the lean */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(120% 90% at ${50 + lean.y * 3}% ${20 + lean.x * -2}%, rgba(255,255,255,${dark ? 0.12 : 0.5}), transparent 60%)`,
              }}
            />
            <div
              className={`absolute left-3.5 right-3.5 ${labelPlacement === 'top-left' ? 'top-3' : 'bottom-3'}`}
              style={{ color: ink }}
            >
              <div className="text-[13px] font-semibold truncate" style={{ letterSpacing: '-0.01em' }}>{label}</div>
              {meta && <div className="text-[10.5px] opacity-65 truncate">{meta}</div>}
            </div>
          </div>
        </div>

        {menu && menu.length > 0 && (
          <div className="absolute right-2 top-2 z-20">
            <button
              type="button"
              aria-label={`Actions for ${label}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              className="p-1 rounded-full"
              style={{ background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)', color: ink }}
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 min-w-[140px] rounded-[10px] py-1 text-[12px]"
                style={{ background: dark ? '#1c1c22' : '#fff', border: `1px solid ${edge}`, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.4)' }}>
                {menu.map((m) => (
                  <button key={m.label} role="menuitem" type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); m.onSelect() }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-black/5"
                    style={{ color: m.danger ? 'var(--danger)' : (dark ? '#f5f5f5' : '#1b1b1f') }}>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
