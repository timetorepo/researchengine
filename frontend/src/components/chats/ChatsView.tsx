import React, { useEffect, useMemo, useRef, useState } from 'react'
import { OverflowActions } from '@/components/ui/kit/beui/OverflowActions'
import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, Search, Clock3, Code as CodeIcon, FolderKanban, NotebookPen, Pin, Box, Monitor, ServerCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GooeyNav from '@/components/reactbits/GooeyNav/GooeyNav'
import { Tabs } from '@heroui/react'
import { getPropsForTheme } from '@/lib/backgrounds/themeProps'
import { useStore } from '@/stores/useStore'
import { download, timeAgo } from '@/lib/utils'
import { navigateNow } from '@/lib/routes/registry'
// Aceternity's Gooey Input — the search affordance. It collapses to a search
// bubble and *gooey*-expands into the field when you reach for it, which is a
// better fit for a page header than a permanently-open input.
import { GooeyInput } from '@/components/ui/aceternity/GooeyInput'

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

/**
 * Where this session's work runs: the host, a Docker container, or a VM.
 * Probes the machine first and says plainly what it finds; picking Docker
 * spins up a small capped container the session can exec into.
 */
function IsolationButton({ chatId }: { chatId: string }) {
  const session = useStore((st) => st.chats.find((c) => c.id === chatId)?.session)
  const [open, setOpen] = useState(false)
  const [probe, setProbe] = useState<{ docker: boolean; dockerDetail: string; vm: boolean; vmDetail: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    fetch('/api/sandbox/probe').then((r) => r.json()).then(setProbe).catch(() => setProbe({ docker: false, dockerDetail: 'probe failed', vm: false, vmDetail: 'probe failed' }))
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const setSession = (patch: { isolation: 'local' | 'docker' | 'vm'; container?: string; note?: string } | undefined) =>
    useStore.setState((st) => ({ chats: st.chats.map((c) => c.id === chatId ? { ...c, session: patch } : c) }))
  const pick = async (iso: 'local' | 'docker' | 'vm') => {
    setBusy(true)
    try {
      if (iso === 'docker') {
        const r = await fetch('/api/sandbox/container', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: chatId }) }).then((x) => x.json())
        if (r.ok) setSession({ isolation: 'docker', container: r.container })
        else setSession({ isolation: 'local', note: r.error })
      } else if (iso === 'vm') {
        // Only a VM that actually launched counts as isolation.
        const r = await fetch('/api/sandbox/vm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: chatId }) })
          .then((x) => x.json()).catch(() => ({ ok: false, error: 'The app server did not answer.' }))
        if (r.ok) setSession({ isolation: 'vm', container: r.vm })
        else setSession({ isolation: 'local', note: r.error })
      } else {
        if (session?.isolation === 'docker') await fetch('/api/sandbox/container', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: chatId }) }).catch(() => {})
        if (session?.isolation === 'vm') await fetch('/api/sandbox/vm', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: chatId }) }).catch(() => {})
        setSession(undefined)
      }
    } finally { setBusy(false); setOpen(false) }
  }
  const iso = session?.isolation
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Session isolation"
        title={iso === 'docker' ? `Runs in ${session?.container}` : iso === 'vm' ? 'Runs in a VM' : 'Runs on this machine'}
        className={`p-2 rounded-lg hover:bg-[var(--elevated)] transition-opacity ${iso ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
        style={{ color: iso ? 'var(--primary)' : 'var(--text-3)' }}>
        {iso === 'docker' ? <Box size={14} /> : iso === 'vm' ? <ServerCog size={14} /> : <Monitor size={14} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-64 rounded-xl p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px rgb(0 0 0 / .25)' }}>
          {([['local', 'This machine', 'no isolation, fastest'], ['docker', 'Docker container', probe?.docker ? 'capped container per session' : probe ? probe.dockerDetail : 'probing…'], ['vm', 'Virtual machine', probe?.vm ? (probe.vmDetail ?? '') : probe ? probe.vmDetail : 'probing…']] as const).map(([id, label, hint]) => (
            <button key={id} disabled={busy || (id === 'docker' && probe ? !probe.docker : false) || (id === 'vm' && probe ? !probe.vm : false)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-[var(--elevated)] disabled:opacity-40"
              style={{ color: iso === id || (id === 'local' && !iso) ? 'var(--primary)' : 'var(--text-2)' }}
              onClick={() => pick(id)}>
              <span className="font-medium">{label}</span>
              <span className="block text-[10px] opacity-70">{hint}</span>
            </button>
          ))}
          {session?.note && <div className="px-2 py-1 text-[10px]" style={{ color: 'var(--warning)' }}>{session.note}</div>}
        </div>
      )}
    </div>
  )
}

export function ChatsView() {
  const navigate = useNavigate()
  const chats = useStore((s) => s.chats)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const isLight = useStore((st) => getPropsForTheme(st.settings.theme).isLight)
  const chatsGooey = useStore((st) => st.settings.chatsGooey !== false)
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

  const ROW_GRID = 'grid items-center gap-3 px-3 md:grid-cols-[minmax(0,1fr)_150px_110px_76px_32px_32px] grid-cols-[minmax(0,1fr)_32px_32px]'

  const section = (title: string, kindOf: 'research' | 'coding', icon: React.ReactNode, list: typeof filtered) => {
    if (!list.length) return null
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span style={{ color: kindOf === 'coding' ? 'var(--primary)' : 'var(--text-3)' }}>{icon}</span>
          <h2 className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{title}</h2>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{list.length}</span>
          <span className="flex-1" />
          {kindOf === 'coding' && (
            <button onClick={() => navigate('/code')} className="text-[11.5px] px-2 py-1 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--primary)' }}>
              Open coding →
            </button>
          )}
        </div>
        {/* One table, not a stack of cards: a row is one line of information, and
            the eye can scan a long history without being slowed by padding. */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className={`${ROW_GRID} h-8 text-[10.5px] uppercase tracking-wider`} style={{ color: 'var(--text-3)', background: 'var(--elevated)' }} aria-hidden="true">
            <span>Title</span>
            <span className="hidden md:block">Project</span>
            <span className="hidden md:block">Updated</span>
            <span className="hidden md:block text-right">Msgs</span>
            <span className="hidden md:block" />
            <span />
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((chat) => {
              const leaving = removing === chat.id
              return (
                <motion.div
                  key={chat.id} layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: leaving ? 0 : 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`group ${ROW_GRID} h-[44px] hover:bg-[var(--elevated)] transition-colors`}
                  style={{ borderTop: '1px solid var(--surface-border)' }}
                >
                  <button className="min-w-0 text-left flex items-center gap-2" onClick={() => { if (renaming !== chat.id) open(chat.id) }}
                    onDoubleClick={() => { setDraft(chat.title); setRenaming(chat.id) }}>
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
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px]"
                        style={{ borderBottom: '1px solid var(--primary)' }}
                      />
                    ) : <span className="truncate text-[13.5px] font-medium">{chat.title}</span>}
                  </button>
                  <span className="hidden md:flex items-center gap-1 min-w-0 text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                    {chat.kind === 'coding' && chat.settings?.project ? (<><FolderKanban size={11} className="shrink-0" /> <span className="truncate">{chat.settings.project}</span></>) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </span>
                  <span className="hidden md:block text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>{timeAgo(chat.updatedAt)}</span>
                  <span className="hidden md:block text-[12px] tabular-nums text-right" style={{ color: 'var(--text-3)' }}>{chat.messages.length}</span>
                  <span className="hidden md:flex justify-center"><IsolationButton chatId={chat.id} /></span>
                  <span className="flex justify-center">
                    <OverflowActions label={`Actions for ${chat.title}`} items={[
                      { id: 'pin', label: chat.pinned ? 'Unpin' : 'Pin to the top', onSelect: () => setPinned(chat.id, !chat.pinned) },
                      { id: 'rename', label: 'Rename', onSelect: () => { setDraft(chat.title); setRenaming(chat.id) } },
                      { id: 'export', label: 'Export as JSON', onSelect: () => exportChat(chat.id) },
                      { id: 'delete', label: 'Delete chat', danger: true, onSelect: () => remove(chat.id) },
                    ]} />
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </section>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-5 pt-7 pb-16">
        {/* Header: the page's title and its one search. Counts sit with the title so the
            scale of the history is visible before any row is. */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-baseline gap-3">
            <div className="flex items-center gap-2"><MessageSquare size={18} style={{ color: 'var(--primary)' }} /><h1 className="text-[20px] font-semibold tracking-tight">Chats</h1></div>
            <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>{chats.length} total · on this device</span>
          </div>
          {/* Search: pick it up and it opens. The input carries the app's own
              surface through `classNames`, so the gooey blob is themed. */}
          <GooeyInput
            aria-label="Search chats"
            className="shrink-0"
            classNames={{
              root: 'text-[12.5px]',
              trigger: 'text-[var(--text-2)]',
              input: 'bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-3)] ring-[var(--surface-border)]',
              bubbleSurface: 'bg-[var(--primary)] text-white',
            }}
            onValueChange={setQuery}
            placeholder="Search chats"
            value={query}
          />
        </div>

        {/* GooeyNav (ReactBits): the kind switch. The pill slides and stretches
            between All, Research and Coding; keyboard and screen-reader
            selection stay on the same index. */}
        <div className="flex items-center gap-2 mb-6 max-w-[420px]">
          <div className="flex-1 min-w-0">
            {/* Settings → Appearance can turn the gooey pill off; plain HeroUI tabs
                then do the same job with the same selection. */}
            {chatsGooey ? (
              <GooeyNav
                theme={isLight ? 'light' : 'dark'}
                items={tabs.map((t) => ({ label: `${t.label} ${t.n}` }))}
                activeIndex={Math.max(0, tabs.findIndex((t) => t.id === kind))}
                onChange={(i: number) => { const t = tabs[i]; if (t) setKind(t.id) }}
                size="sm"
                animationTime={450}
              />
            ) : (
              <Tabs selectedKey={kind} onSelectionChange={(k) => setKind(k as Kind)} aria-label="Chat kind">
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Chat kind">
                    {tabs.map((t) => (
                      <Tabs.Tab key={t.id} id={t.id} className="text-[12.5px]">
                        {`${t.label} ${t.n}`}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            )}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{filtered.length} shown</span>
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
