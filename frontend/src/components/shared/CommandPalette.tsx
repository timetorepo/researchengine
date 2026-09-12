import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, MessageSquare, Wand2, Settings, BookOpen, GraduationCap, Users, Home, Moon,
  FileText, Folder, Plug, PenLine, History, Hammer, Workflow as WorkflowIcon,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { fuzzy } from '@/lib/utils'

type Kind = 'Command' | 'Chat' | 'Article' | 'Document' | 'Quiz' | 'Space' | 'Skill' | 'Integration' | 'Workflow' | 'Recent'

interface Item {
  id: string
  label: string
  sub?: string
  icon: any
  kind: Kind
  run: () => void
  score: number
}

const REC_KEY = 're.palette.recents'
function loadRecents(): string[] { try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]') } catch { return [] } }
function pushRecent(id: string) {
  const arr = loadRecents().filter((x) => x !== id)
  arr.unshift(id)
  localStorage.setItem(REC_KEY, JSON.stringify(arr.slice(0, 6)))
}

/* Highlight the matched substring of the label */
function Highlight({ label, q }: { label: string; q: string }) {
  if (!q.trim()) return <>{label}</>
  const i = label.toLowerCase().indexOf(q.toLowerCase().trim())
  if (i < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, i)}
      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{label.slice(i, i + q.trim().length)}</span>
      {label.slice(i + q.trim().length)}
    </>
  )
}

const GROUP_ORDER: Kind[] = ['Recent', 'Command', 'Chat', 'Article', 'Document', 'Quiz', 'Space', 'Skill', 'Integration', 'Workflow']

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const ui = useUI()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const chats = useStore((s) => s.chats)
  const skills = useStore((s) => s.skills)
  const articles = useStore((s) => s.articles)
  const documents = useStore((s) => s.documents)
  const quizzes = useStore((s) => s.quizzes)
  const spaces = useStore((s) => s.spaces)
  const integrations = useStore((s) => s.integrations)
  const workflows = useStore((s) => s.workflows)

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])

  const all = useMemo(() => {
    const commands: Item[] = [
      { id: 'cmd-home', label: 'Go to Home', icon: Home, kind: 'Command', run: () => navigate('/'), score: 0 },
      { id: 'cmd-new', label: 'New chat', icon: MessageSquare, kind: 'Command', run: () => { const id = useStore.getState().newChat(); navigate(`/chat/${id}`) }, score: 0 },
      { id: 'cmd-settings', label: 'Open Settings', sub: 'Cmd/Ctrl+,', icon: Settings, kind: 'Command', run: () => { ui.set({ settingsSheet: true }) }, score: 0 },
      { id: 'cmd-flood', label: 'Open Agent Flood', icon: Users, kind: 'Command', run: () => navigate('/flood'), score: 0 },
      { id: 'cmd-workflows', label: 'Open Workflows', icon: WorkflowIcon, kind: 'Command', run: () => navigate('/workflows'), score: 0 },
      { id: 'cmd-quiz', label: 'Read & Quiz', icon: GraduationCap, kind: 'Command', run: () => navigate('/quiz'), score: 0 },
      { id: 'cmd-articles', label: 'Articles', icon: BookOpen, kind: 'Command', run: () => navigate('/articles'), score: 0 },
      { id: 'cmd-replicate', label: 'New Tech — Replication', icon: Hammer, kind: 'Command', run: () => { const id = useStore.getState().newChat(); navigate(`/chat/${id}`) }, score: 0 },
      { id: 'cmd-theme', label: 'Toggle dark / light theme', icon: Moon, kind: 'Command', run: () => useStore.setState((s) => ({ settings: { ...s.settings, theme: ['dark', 'catppuccin-mocha', 'nord', 're-os', 'perplexity'].includes(s.settings.theme) ? 'light' : 'dark' } })), score: 0 },
    ]

    const chatItems: Item[] = chats.map((c) => ({
      id: `chat-${c.id}`, label: c.title, icon: MessageSquare, kind: 'Chat',
      run: () => { useStore.getState().setActiveChat(c.id); navigate(`/chat/${c.id}`) }, score: 0,
    }))
    const articleItems: Item[] = articles.map((a) => ({
      id: `art-${a.id}`, label: a.title, icon: PenLine, kind: 'Article', run: () => navigate(`/articles/${a.id}`), score: 0,
    }))
    const docItems: Item[] = documents.map((d) => ({
      id: `doc-${d.id}`, label: d.name, icon: FileText, kind: 'Document', run: () => navigate('/quiz'), score: 0,
    }))
    const quizItems: Item[] = quizzes.map((qz) => ({
      id: `quiz-${qz.id}`, label: qz.title, icon: GraduationCap, kind: 'Quiz', run: () => navigate('/quiz'), score: 0,
    }))
    const spaceItems: Item[] = spaces.map((sp) => ({
      id: `space-${sp.id}`, label: sp.name, icon: Folder, kind: 'Space', run: () => { const cid = useStore.getState().newChat(sp.id); navigate(`/chat/${cid}`) }, score: 0,
    }))
    const skillItems: Item[] = skills.map((s) => ({
      id: `skill-${s.id}`, label: s.name, icon: Wand2, kind: 'Skill', run: () => ui.set({ skillRun: { skillId: s.id } }), score: 0,
    }))
    const intItems: Item[] = Object.entries(integrations).map(([k, v]) => ({
      id: `int-${k}`, label: `Integration — ${k}`, sub: v.connected ? 'Connected' : 'Not connected', icon: Plug, kind: 'Integration',
      run: () => { ui.set({ settingsOpen: true, settingsTab: 'integrations' }); navigate('/settings') }, score: 0,
    }))
    const workflowItems: Item[] = workflows.map((w) => ({
      id: `wf-${w.id}`, label: w.name, sub: `${w.nodes.length} nodes`, icon: WorkflowIcon, kind: 'Workflow',
      run: () => navigate(`/workflows/${w.id}`), score: 0,
    }))

    return [...commands, ...chatItems, ...articleItems, ...docItems, ...quizItems, ...spaceItems, ...skillItems, ...intItems, ...workflowItems]
  }, [chats, skills, articles, documents, quizzes, spaces, integrations, workflows, navigate])

  const items = useMemo(() => {
    const query = q.trim().toLowerCase()
    let scored: Item[]
    if (!query) {
      // no query: show recents first, then top commands
      const recIds = loadRecents()
      const recents = recIds.map((rid) => all.find((a) => a.id === rid)).filter(Boolean).map((i) => ({ ...(i as Item), kind: 'Recent' as Kind }))
      const commands = all.filter((a) => a.kind === 'Command').slice(0, 6)
      scored = [...recents, ...commands]
    } else {
      scored = all
        .map((i) => ({ ...i, score: fuzzy(query, i.label.toLowerCase()) }))
        .filter((i) => i.score > 0)
        .sort((a, b) => b.score - a.score)
    }
    return scored.slice(0, 16)
  }, [q, all])

  useEffect(() => { setIdx(0) }, [q])

  const run = (it: Item) => {
    pushRecent(it.id.replace(/^rec-/, ''))
    it.run()
    ui.set({ paletteOpen: false })
  }

  if (!open) return null

  return (
    <motion.div className="fixed inset-0 z-[75] sheet-scrim flex items-start justify-center pt-[14vh] px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => ui.set({ paletteOpen: false })}>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-[580px] surface-elevated overflow-hidden"
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
              if (e.key === 'Enter' && items[idx]) run(items[idx])
              if (e.key === 'Escape') ui.set({ paletteOpen: false })
            }}
            placeholder="Search everything — chats, articles, docs, quizzes, spaces, commands…"
            className="flex-1 bg-transparent outline-none text-[14px]"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>esc</kbd>
        </div>

        <div className="max-h-[48vh] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>Nothing matches.</div>}
          {GROUP_ORDER.map((kind) => {
            const group = items.filter((i) => i.kind === kind)
            if (!group.length) return null
            return (
              <div key={kind}>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                  {kind === 'Recent' && <History size={10} />} {kind === 'Command' ? 'Commands' : kind}
                </div>
                {group.map((it) => {
                  const i = items.indexOf(it)
                  return (
                    <button
                      key={it.id}
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => run(it)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[12px] text-left"
                      style={{ background: i === idx ? 'var(--surface)' : 'transparent' }}
                    >
                      <it.icon size={15} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} />
                      <span className="flex-1 text-[13.5px] truncate"><Highlight label={it.label} q={q} /></span>
                      {it.sub && <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{it.sub}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
