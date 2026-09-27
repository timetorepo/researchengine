import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, Search, Trash2, Clock3, Code as CodeIcon, FolderKanban, NotebookPen, Pin, PinOff, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { download, timeAgo } from '@/lib/utils'
import { navigateNow } from '@/lib/routes/registry'

type Kind = 'all' | 'research' | 'coding'

/**
 * Every conversation, with the coding ones kept apart.
 *
 * Coding chats are the IDE's own conversations — one per project, carrying a
 * project name and a different tool surface. Mixing them into research history
 * made both harder to find, so they are a section of their own.
 *
 * This page is also where a conversation is managed now that the sidebar is
 * navigation-only: pin, rename (double-click a title), export, delete.
 */
export function ChatsView() {
  const navigate = useNavigate()
  const chats = useStore((s) => s.chats)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [removing, setRemoving] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...chats]
      // Pinned first, then most recent — the sidebar's pinned block used to say
      // "this one first"; the order says it here.
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
      .filter((c) => (kind === 'all' ? true : (c.kind ?? 'research') === kind))
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
  }, [chats, query, kind])

  const research = filtered.filter((c) => (c.kind ?? 'research') !== 'coding')
  const coding = filtered.filter((c) => c.kind === 'coding')
  const researchTotal = chats.filter((c) => (c.kind ?? 'research') !== 'coding').length
  const codingTotal = chats.filter((c) => c.kind === 'coding').length

  const remove = (id: string) => {
    setRemoving(id)
    window.setTimeout(() => { useStore.getState().deleteChat(id); setRemoving(null) }, 300)
  }
  const setPinned = (id: string, v: boolean) => useStore.setState((s) => ({
    chats: s.chats.map((c) => c.id === id ? { ...c, pinned: v } : c),
  }))
  const commitRename = (id: string, fallback: string) => {
    const next = draft.trim()
    if (next && next !== fallback) useStore.getState().renameChat(id, next)
    setRenaming(null)
  }
  const exportChat = (id: string) => {
    const chat = useStore.getState().chats.find((c) => c.id === id)
    if (!chat) return
    download(`${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'chat'}.json`,
      JSON.stringify(chat, null, 2), 'application/json')
  }
  const open = (id: string) => {
    useStore.getState().setActiveChat(id)
    navigateNow({ href: `#/chat/${id}`, push: (href) => navigate(href.replace(/^#/, '')) })
  }

  const tabs: { id: Kind; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: chats.length },
    { id: 'research', label: 'Research', n: researchTotal },
    { id: 'coding', label: 'Coding', n: codingTotal },
  ]

  const section = (title: string, kindOf: 'research' | 'coding', icon: React.ReactNode, list: typeof filtered) => {
    if (!list.length) return null
    return (
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-2.5 px-0.5">
          <span style={{ color: kindOf === 'coding' ? 'var(--primary)' : 'var(--text-3)' }}>{icon}</span>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{title}</h2>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{list.length}</span>
          <span className="flex-1" />
          {kindOf === 'coding' && (
            <button onClick={() => navigate('/code')} className="text-[11px] px-2 py-1 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--primary)' }}>
              Open coding →
            </button>
          )}
        </div>
        <AnimatePresence mode="popLayout">
          {list.map((chat, i) => (
            <motion.div
              key={chat.id} layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: removing === chat.id ? 0 : 1, y: removing === chat.id ? -8 : 0, scale: removing === chat.id ? 0.98 : 1 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320, delay: removing === chat.id ? 0 : i * .02 }}
              className="surface p-4 mb-2.5 flex items-center gap-3 group"
            >
              <button className="flex-1 min-w-0 text-left" onClick={() => { if (renaming !== chat.id) open(chat.id) }}
                onDoubleClick={() => { setDraft(chat.title); setRenaming(chat.id) }}>
                <div className="font-medium text-[14px] truncate flex items-center gap-1.5">
                  {chat.kind === 'coding' && <CodeIcon size={13} className="shrink-0" style={{ color: 'var(--primary)' }} />}
                  {chat.pinned && <Pin size={12} className="shrink-0" style={{ color: 'var(--warning)' }} />}
                  {renaming === chat.id ? (
                    <input
                      autoFocus value={draft} maxLength={60}
                      onChange={(e) => setDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(chat.id, chat.title)
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      onBlur={() => commitRename(chat.id, chat.title)}
                      className="flex-1 min-w-0 bg-transparent outline-none text-[14px]"
                      style={{ borderBottom: '1px solid var(--primary)' }}
                    />
                  ) : chat.title}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                  <Clock3 size={11} /> {timeAgo(chat.updatedAt)} · {chat.messages.length} messages
                  {chat.kind === 'coding' && chat.settings?.project && (
                    <span className="flex items-center gap-1 px-1.5 py-[1px] rounded-full" style={{ background: 'var(--elevated)' }}>
                      <FolderKanban size={9} /> {chat.settings.project}
                    </span>
                  )}
                </div>
              </button>
              <button onClick={() => setPinned(chat.id, !chat.pinned)} aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                title={chat.pinned ? 'Unpin' : 'Pin to the top'}
                className={`p-2 rounded-lg hover:bg-[var(--elevated)] transition-opacity ${chat.pinned ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
                style={{ color: chat.pinned ? 'var(--warning)' : 'var(--text-3)' }}>
                {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button onClick={() => exportChat(chat.id)} aria-label="Export chat" title="Export as JSON"
                className="p-2 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-[var(--elevated)] transition-opacity" style={{ color: 'var(--text-3)' }}><Download size={14} /></button>
              <button onClick={() => remove(chat.id)} aria-label="Delete chat" className="p-2 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-[var(--elevated)] transition-opacity" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-5 pt-8 pb-16">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2"><MessageSquare size={20} style={{ color: 'var(--primary)' }} /><h1 className="text-[24px] font-semibold tracking-tight">Chats</h1></div>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-2)' }}>Research and coding conversations, kept apart and on this device.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-[11px] min-w-[210px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Search size={14} style={{ color: 'var(--text-3)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="bg-transparent outline-none text-[12.5px] flex-1" />
          </div>
        </div>

        <div className="re-history-tabs mb-5 max-w-[340px]" role="tablist" aria-label="Conversation kind">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={kind === t.id} data-active={kind === t.id} onClick={() => setKind(t.id)}>
              {t.label}
            </button>
          ))}
          <span className="re-history-count">{filtered.length}</span>
        </div>

        {section('Coding', 'coding', <CodeIcon size={13} />, coding)}
        {section('Research', 'research', <NotebookPen size={13} />, research)}

        {filtered.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--text-3)' }}>
            <MessageSquare size={24} className="mx-auto mb-2" />
            <p className="text-[13px]">No chats found{kind !== 'all' ? ` in ${kind}` : ''}.</p>
          </div>
        )}
      </div>
    </div>
  )
}
