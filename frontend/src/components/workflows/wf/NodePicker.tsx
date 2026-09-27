// Spotlight-style node picker (cmdk pattern): search across the library,
// grouped by kind, arrow-key navigable.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { NODE_LIBRARY, KIND_COLOR, KIND_LABEL, type NodeDef } from '@/lib/workflows/library'
import type { NodeKind } from '@/lib/workflows/types'

const KIND_ORDER: NodeKind[] = ['trigger', 'ai', 'skill', 'integration', 'logic', 'transform', 'output']

interface Props {
  open: boolean
  onClose: () => void
  onPick: (def: NodeDef) => void
  title?: string
}

export function NodePicker({ open, onClose, onPick, title = 'Add a node' }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (d: NodeDef) => !needle || d.name.toLowerCase().includes(needle) || d.desc.toLowerCase().includes(needle) || d.kind.includes(needle)
    return KIND_ORDER
      .map((kind) => ({ kind, items: NODE_LIBRARY.filter((d) => d.kind === kind && match(d)) }))
      .filter((g) => g.items.length > 0)
  }, [q])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])
  useEffect(() => { setIdx(0) }, [q])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const pick = (d: NodeDef) => { onPick(d); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center pt-[16vh] px-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-[560px] rounded-[18px] overflow-hidden"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 24px 64px -16px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <Search size={15} style={{ color: 'var(--text-3)' }} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
                  else if (e.key === 'Enter') { e.preventDefault(); if (flat[idx]) pick(flat[idx]) }
                  else if (e.key === 'Escape') onClose()
                }}
                placeholder={`${title} — search ${NODE_LIBRARY.length} node types`}
                className="flex-1 bg-transparent outline-none text-[13.5px]"
                style={{ color: 'var(--text-1)' }}
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>esc</kbd>
            </div>
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
              {flat.length === 0 && <div className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>No nodes match.</div>}
              {groups.map((g) => (
                <div key={g.kind}>
                  <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[g.kind] }} />
                    {KIND_LABEL[g.kind]}
                  </div>
                  {g.items.map((d) => {
                    const fi = flat.indexOf(d)
                    const Icon = d.icon
                    return (
                      <button
                        key={d.type}
                        data-active={fi === idx}
                        onMouseEnter={() => setIdx(fi)}
                        onClick={() => pick(d)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left"
                        style={{ background: fi === idx ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent' }}
                      >
                        <span className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
                          style={{
                            background: d.gradient ? 'linear-gradient(135deg, #6C8EEF, #A78BFA)' : `color-mix(in srgb, ${KIND_COLOR[d.kind]} 16%, transparent)`,
                            color: d.gradient ? '#fff' : KIND_COLOR[d.kind],
                          }}>
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>{d.name}</span>
                          <span className="block text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{d.desc}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
