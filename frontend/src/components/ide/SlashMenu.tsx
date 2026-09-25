/**
 * The `/` menu in the composer — Claude Code's command surface.
 *
 * It opens the moment the draft starts with a slash, filters as you type, and
 * shows where each command came from and what it will actually do, so nobody
 * has to guess what `/godmode` means before pressing Enter.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Wand2 } from 'lucide-react'
import { matchCommands, COMMAND_SOURCE_LABEL, type SlashCommand } from '@/lib/ide/commands'
import { scrollChildIntoView } from '@/lib/dom/scroll'

export function SlashMenu({ query, onPick, onClose }: {
  query: string
  onPick: (command: SlashCommand) => void
  onClose: () => void
}) {
  const items = useMemo(() => matchCommands(query), [query])
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setIdx(0), [query])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    scrollChildIntoView(listRef.current, el as HTMLElement | null, { block: 'nearest' })
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items.length, onClose])

  if (!items.length) {
    return (
      <div className="re-slash" role="listbox" aria-label="Commands">
        <div className="px-3 py-3 text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>
          No command matches “{query}”. Press Enter to send it as a normal message.
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 26, stiffness: 340 }}
      className="re-slash"
      role="listbox"
      aria-label="Commands"
    >
      <div className="re-slash-head">
        <Wand2 size={11} /> Commands
        <span className="flex-1" />
        <kbd>↑↓</kbd> <kbd>Enter</kbd> <kbd>Esc</kbd>
      </div>
      <div ref={listRef} className="re-slash-list">
        {items.map((c, i) => (
          <button
            key={c.id}
            role="option"
            aria-selected={i === idx}
            data-active={i === idx ? 'true' : 'false'}
            onMouseEnter={() => setIdx(i)}
            onClick={() => onPick(c)}
            className="re-slash-item"
          >
            <span className="re-slash-name">{c.label}</span>
            <span className="re-slash-sum">{c.summary}</span>
            <span className="re-slash-src" data-src={c.source}>{COMMAND_SOURCE_LABEL[c.source]}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
