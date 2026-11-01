/**
 * ⌘K — the one box that does everything in the IDE (Cursor's habit).
 *
 * Files, actions, agents and slash commands live in the same list, ranked by
 * what you typed, so "open auth.ts", "spawn an agent" and "/ultrareview" are
 * one keystroke apart. Selecting a slash command drops it into the composer
 * rather than guessing an argument for you.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  FileCode2, Bot, MonitorUp, TerminalSquare, Save, Search, GitBranch, Bug, Wand2, Cpu, Cloud, CornerDownLeft,
} from 'lucide-react'
import { matchCommands, COMMAND_SOURCE_LABEL, type CommandSource } from '@/lib/ide/commands'
import { scrollChildIntoView } from '@/lib/dom/scroll'

export interface PaletteAction {
  id: string
  label: string
  kind: 'file' | 'action' | 'command' | 'agent'
  detail?: string
  icon?: React.ReactNode
  /** Set on command entries so the row can say whose workflow it came from. */
  source?: CommandSource
  run: () => void
}

export function IDECommandPalette({ open, onClose, files, actions, onOpenFile, onCommand }: {
  open: boolean
  onClose: () => void
  files: string[]
  actions: PaletteAction[]
  /** Open a file that is not open yet. */
  onOpenFile: (path: string) => void
  /** Put a slash command into the composer. */
  onCommand?: (commandId: string) => void
}) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 20) }
  }, [open])

  const items = useMemo<PaletteAction[]>(() => {
    const needle = q.trim().toLowerCase()
    const fileItems: PaletteAction[] = files.map((f) => ({
      id: `file:${f}`, label: f, kind: 'file', icon: <FileCode2 size={12} />,
      run: () => onOpenFile(f),
    }))
    const commandItems: PaletteAction[] = matchCommands(needle.startsWith('/') ? needle : `/${needle}`)
      .slice(0, 8)
      .map((c) => ({
        id: `cmd:${c.id}`, label: c.label, kind: 'command' as const, detail: c.summary, source: c.source,
        icon: c.cloud ? <Cloud size={12} /> : c.asAgent ? <Bot size={12} /> : <Wand2 size={12} />,
        run: () => onCommand?.(c.id),
      }))
    const all = [...actions, ...commandItems, ...fileItems]
    if (!needle) return all.slice(0, 40)
    const scored = all.map((a) => {
      const label = a.label.toLowerCase()
      const detail = (a.detail ?? '').toLowerCase()
      const score = label === needle ? 120 : label.startsWith(needle) ? 90 : label.includes(needle) ? 70
        : detail.includes(needle) ? 40 : 0
      return { a, score }
    }).filter((x) => x.score > 0)
    scored.sort((x, y) => y.score - x.score || x.a.label.localeCompare(y.a.label))
    return scored.slice(0, 40).map((x) => x.a)
  }, [q, files, actions, onOpenFile, onCommand])

  useEffect(() => { setIdx(0) }, [q])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    scrollChildIntoView(listRef.current, el as HTMLElement | null, { block: 'nearest' })
  }, [idx])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[idx]
        if (item) { item.run(); onClose() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, items, idx, onClose])

  if (!open) return null

  return (
    <div className="re-palette-scrim" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        className="re-palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="re-palette-input">
          <Search size={13} style={{ color: 'var(--ide-faint)' }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search files, run an action, or type / for a command…"
            aria-label="Command palette" className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: 'var(--ide-text)' }} />
          <kbd>esc</kbd>
        </div>
        <div ref={listRef} className="re-palette-list">
          {!items.length && <div className="px-3 py-4 text-[11.5px]" style={{ color: 'var(--ide-faint)' }}>Nothing matches.</div>}
          {items.map((a, i) => (
            <button key={a.id} data-active={i === idx ? 'true' : 'false'} onMouseEnter={() => setIdx(i)}
              onClick={() => { a.run(); onClose() }} className="re-palette-item">
              <span className="re-palette-icon">{a.icon}</span>
              <span className="re-palette-label">{a.label}</span>
              {a.detail && <span className="re-palette-detail">{a.detail}</span>}
              <span className="re-palette-kind" data-kind={a.kind}>
                {a.kind === 'command' && a.source ? COMMAND_SOURCE_LABEL[a.source] : a.kind}
              </span>
              {i === idx && <CornerDownLeft size={11} style={{ color: 'var(--ide-faint)' }} />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/** The actions every project offers, built once by the caller. */
export function ideActions(opts: {
  onDesign: () => void
  onTerminal: () => void
  onProblems: () => void
  onGit: () => void
  onSave: () => void
  onSpawnAgent: () => void
  onHandoffCloud: () => void
  onHandoffLocal: () => void
  onTogglePanel: () => void
}): PaletteAction[] {
  return [
    { id: 'a:design', label: 'Design mode — see and fix the running app', kind: 'action', icon: <MonitorUp size={12} />, run: opts.onDesign },
    { id: 'a:agent', label: 'Spawn a parallel agent in its own working copy', kind: 'agent', icon: <Bot size={12} />, run: opts.onSpawnAgent },
    { id: 'a:handoff-cloud', label: 'Handoff — move this session to a cloud model', kind: 'action', icon: <Cloud size={12} />, run: opts.onHandoffCloud },
    { id: 'a:handoff-local', label: 'Handoff — bring this session back to the local model', kind: 'action', icon: <Cpu size={12} />, run: opts.onHandoffLocal },
    { id: 'a:terminal', label: 'Toggle terminal', kind: 'action', icon: <TerminalSquare size={12} />, run: opts.onTerminal },
    { id: 'a:problems', label: 'Problems', kind: 'action', icon: <Bug size={12} />, run: opts.onProblems },
    { id: 'a:git', label: 'Source control', kind: 'action', icon: <GitBranch size={12} />, run: opts.onGit },
    { id: 'a:save', label: 'Save the active file', kind: 'action', icon: <Save size={12} />, run: opts.onSave },
    { id: 'a:panel', label: 'Toggle the bottom panel', kind: 'action', run: opts.onTogglePanel },
  ]
}
