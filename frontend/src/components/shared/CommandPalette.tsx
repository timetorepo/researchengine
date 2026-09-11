import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, MessageSquare, Wand2, Settings, BookOpen, GraduationCap, Users, Home, Sun, Moon } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { fuzzy } from '@/lib/utils'

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const ui = useUI()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const chats = useStore((s) => s.chats)
  const skills = useStore((s) => s.skills)

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])

  const items = useMemo(() => {
    const actions = [
      { id: 'a-home', label: 'Go to Home', icon: Home, run: () => navigate('/') },
      { id: 'a-new', label: 'New chat', icon: MessageSquare, run: () => { const id = useStore.getState().newChat(); navigate(`/chat/${id}`) } },
      { id: 'a-settings', label: 'Open Settings', icon: Settings, run: () => { ui.set({ settingsOpen: true }); navigate('/settings') } },
      { id: 'a-flood', label: 'Open Agent Flood', icon: Users, run: () => navigate('/flood') },
      { id: 'a-quiz', label: 'Read & Quiz', icon: GraduationCap, run: () => navigate('/quiz') },
      { id: 'a-articles', label: 'Articles', icon: BookOpen, run: () => navigate('/articles') },
      {
        id: 'a-theme', label: 'Toggle dark / light theme', icon: Moon, run: () => useStore.setState((s) => ({
          settings: { ...s.settings, theme: ['dark', 'catppuccin-mocha', 'nord', 're-os'].includes(s.settings.theme) ? 'light' : 'dark' },
        })),
      },
    ].map((a) => ({ ...a, kind: 'Action' as const }))

    const chatItems = chats.slice(0, 30).map((c) => ({
      id: `c-${c.id}`, label: c.title, icon: MessageSquare, kind: 'Chat' as const,
      run: () => { useStore.getState().setActiveChat(c.id); navigate(`/chat/${c.id}`) },
    }))
    const skillItems = skills.map((s) => ({
      id: `s-${s.id}`, label: s.name, icon: Wand2, kind: 'Skill' as const,
      run: () => ui.set({ skillRun: { skillId: s.id } }),
    }))

    const all = [...actions, ...chatItems, ...skillItems]
    if (!q.trim()) return all.slice(0, 12)
    return all.filter((i) => fuzzy(q, i.label) > 0).slice(0, 12)
  }, [q, chats, skills, navigate])

  useEffect(() => { setIdx(0) }, [q])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[75] sheet-scrim flex items-start justify-center pt-[14vh] px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => ui.set({ paletteOpen: false })}>
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-[560px] surface-elevated overflow-hidden"
          style={{ borderRadius: 'var(--radius-modal)', boxShadow: '0 32px 80px -24px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <Search size={16} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
                if (e.key === 'Enter' && items[idx]) { items[idx].run(); ui.set({ paletteOpen: false }) }
              }}
              placeholder="Search everything — chats, skills, actions…"
              className="flex-1 bg-transparent outline-none text-[14px]"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>esc</kbd>
          </div>
          <div className="max-h-[46vh] overflow-y-auto p-1.5">
            {items.length === 0 && <div className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>Nothing matches.</div>}
            {items.map((it, i) => (
              <button
                key={it.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { it.run(); ui.set({ paletteOpen: false }) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left"
                style={{ background: i === idx ? 'var(--surface)' : 'transparent' }}
              >
                <it.icon size={15} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} />
                <span className="flex-1 text-[13.5px] truncate">{it.label}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{it.kind}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
