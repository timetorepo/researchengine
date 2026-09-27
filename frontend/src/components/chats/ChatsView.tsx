import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Search, Trash2, Clock3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { timeAgo } from '@/lib/utils'

export function ChatsView() {
  const navigate = useNavigate()
  const chats = useStore((s) => s.chats)
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...chats].sort((a, b) => b.updatedAt - a.updatedAt).filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
  }, [chats, query])
  const remove = (id: string) => {
    setRemoving(id)
    window.setTimeout(() => { useStore.getState().deleteChat(id); setRemoving(null) }, 300)
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-5 pt-8 pb-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div><div className="flex items-center gap-2"><MessageSquare size={20} style={{ color: 'var(--primary)' }} /><h1 className="text-[24px] font-semibold tracking-tight">Chats</h1></div><p className="text-[13px] mt-1" style={{ color: 'var(--text-2)' }}>Your latest and past research conversations, kept on this device.</p></div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-[11px] min-w-[210px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}><Search size={14} style={{ color: 'var(--text-3)' }} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="bg-transparent outline-none text-[12.5px] flex-1" /></div>
        </div>
        <AnimatePresence mode="popLayout">
          {filtered.map((chat, i) => <motion.div key={chat.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: removing === chat.id ? 0 : 1, y: removing === chat.id ? -8 : 0, scale: removing === chat.id ? 0.98 : 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 320, delay: removing === chat.id ? 0 : i * .02 }} className="surface p-4 mb-2.5 flex items-center gap-3 group">
            <button className="flex-1 min-w-0 text-left" onClick={() => { useStore.getState().setActiveChat(chat.id); navigate(`/chat/${chat.id}`) }}><div className="font-medium text-[14px] truncate">{chat.title}</div><div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}><Clock3 size={11} /> {timeAgo(chat.updatedAt)} · {chat.messages.length} messages</div></button>
            <button onClick={() => remove(chat.id)} aria-label="Delete chat" className="p-2 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-[var(--elevated)] transition-opacity" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
          </motion.div>)}
        </AnimatePresence>
        {filtered.length === 0 && <div className="py-16 text-center" style={{ color: 'var(--text-3)' }}><MessageSquare size={24} className="mx-auto mb-2" /><p className="text-[13px]">No chats found.</p></div>}
      </div>
    </div>
  )
}
