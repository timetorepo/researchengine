import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { Pin, MessageSquare, ArrowUpRight } from 'lucide-react'

/** Only real local work. No fabricated attention scores or activity charts. */
export function WorkspaceActivity({ supporting = false }: { supporting?: boolean }) {
  const chats = useStore((s) => s.chats)
  const navigate = useNavigate()
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const pinned = sorted.filter((c) => c.pinned).slice(0, 5)
  const recent = sorted.filter((c) => !c.pinned).slice(0, 5)
  const open = (id: string) => { useStore.getState().setActiveChat(id); navigate(`/chat/${id}`) }
  return <section className="re-workspace-activity" aria-label={supporting ? 'Supporting work' : 'Your work'}>
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-sm font-semibold">{supporting ? 'Your workspace' : 'Pick up where you left off'}</h2>
      <button className="text-xs underline underline-offset-4" onClick={() => navigate('/chats')}>All chats</button>
    </div>
    {!chats.length && <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>Your conversations will appear here once you start. Ask a question to begin.</p>}
    {([{ title: 'Pinned', rows: pinned }, { title: 'Recent', rows: recent }]).map(({ title, rows }) => rows.length > 0 && <div key={title} className="mb-4 last:mb-0">
      <h3 className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>{title}</h3>
      {rows.map((chat) => <button key={chat.id} onClick={() => open(chat.id)} className="re-workspace-entry">
        {chat.pinned ? <Pin size={13} aria-hidden /> : <MessageSquare size={13} aria-hidden />}
        <span className="min-w-0 flex-1 text-left"><span className="block truncate text-[13px]">{chat.title}</span><span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{chat.kind === 'coding' ? 'Coding' : 'Research'} · {new Date(chat.updatedAt).toLocaleDateString()}</span></span>
        <ArrowUpRight size={13} aria-hidden />
      </button>)}
    </div>)}
    <div className="flex flex-wrap gap-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--surface-border)' }}>
      <button onClick={() => navigate('/code')}>Coding projects →</button>
      <button onClick={() => navigate('/workflows')}>Workflows →</button>
    </div>
  </section>
}
