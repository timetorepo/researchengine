import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, BookOpen, MessageSquare, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { Article } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { hashHue, timeAgo, readingTime } from '@/lib/utils'

export function ArticlesView() {
  const articles = useStore((s) => s.articles)
  const chats = useStore((s) => s.chats)
  const navigate = useNavigate()
  const ui = useUI()
  const [fromChat, setFromChat] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const removeArticle = (id: string) => {
    setRemoving(id)
    window.setTimeout(() => { useStore.setState((s) => ({ articles: s.articles.filter((x) => x.id !== id) })); setRemoving(null) }, 320)
  }

  const createBlank = () => {
    const a: Article = {
      id: nanoid(8), title: 'Untitled article',
      blocks: [{ id: nanoid(6), type: 'heading', content: 'Untitled article' }, { id: nanoid(6), type: 'paragraph', content: '' }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    useStore.setState((s) => ({ articles: [a, ...s.articles] }))
    navigate(`/articles/${a.id}`)
  }

  const createFromChat = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return
    const md = chat.messages.map((m) => m.content).join('\n\n')
    const a: Article = {
      id: nanoid(8), title: chat.title,
      blocks: md.split(/\n\n+/).filter(Boolean).slice(0, 40).map((chunk) => ({
        id: nanoid(6),
        type: chunk.startsWith('#') ? 'heading' : 'paragraph',
        content: chunk.replace(/^#+\s*/, ''),
      })),
      createdAt: Date.now(), updatedAt: Date.now(), sourceChatId: chatId,
    }
    useStore.setState((s) => ({ articles: [a, ...s.articles] }))
    navigate(`/articles/${a.id}`)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Articles</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>Structured long-form, generated section by section.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFromChat(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <MessageSquare size={13} /> From chat
            </button>
            <button onClick={createBlank} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[12.5px] font-medium"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              <Plus size={13} /> New article
            </button>
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex w-14 h-14 rounded-[18px] items-center justify-center mb-3" style={{ background: 'var(--elevated)' }}>
              <BookOpen size={24} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
            </div>
            <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No articles yet.</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Convert a chat, or start from scratch.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
            {articles.map((a, i) => {
              const hue = hashHue(a.title)
              const words = a.blocks.reduce((n, b) => n + b.content.split(/\s+/).length, 0)
              return (
                <motion.div key={a.id}
                  layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: removing === a.id ? 0 : 1, y: removing === a.id ? -10 : 0, scale: removing === a.id ? 0.96 : 1 }} exit={{ opacity: 0, scale: 0.94, height: 0, margin: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 320, delay: removing === a.id ? 0 : i * 0.04 }}
                  className="group relative rounded-[18px] overflow-hidden cursor-pointer card-hover"
                  onClick={() => navigate(`/articles/${a.id}`)}>
                  <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 40% 22%))` }}>
                    <div className="p-3.5 h-full flex flex-col justify-end">
                      <div className="text-white/90 font-semibold text-[14px] leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-serif)' }}>{a.title}</div>
                    </div>
                  </div>
                  <div className="p-3.5 flex items-center justify-between" style={{ background: 'var(--surface)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{readingTime(a.blocks.map((b) => b.content).join(' '))} · {timeAgo(a.updatedAt)}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeArticle(a.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded" style={{ color: 'var(--text-3)' }} aria-label="Delete article">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* from-chat picker */}
      {fromChat && (
        <div className="fixed inset-0 z-[70] sheet-scrim flex items-center justify-center px-4" onClick={() => setFromChat(false)}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[440px] surface-elevated overflow-hidden" style={{ borderRadius: 'var(--radius-modal)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 font-semibold text-[15px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>Convert a chat into an article</div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {chats.length === 0 && <div className="p-6 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>No chats yet.</div>}
              {chats.map((c) => (
                <button key={c.id} onClick={() => createFromChat(c.id)}
                  className="w-full text-left px-3 py-2.5 rounded-[12px] hover:bg-[var(--surface)]">
                  <div className="text-[13.5px] truncate">{c.title}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{c.messages.length} messages · {timeAgo(c.updatedAt)}</div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
