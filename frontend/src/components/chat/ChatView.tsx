import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Sigma, Sparkles, Globe, Wind } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { runChat, stopStream, isStreamingChat } from '@/lib/chat/runChat'
import { Message } from './Message'
import { InputBar } from '@/components/input/InputBar'
import { ThinkingOrb } from '@/components/shared/ThinkingOrb'

export function ChatView() {
  const { id } = useParams<{ id: string }>()
  const chat = useStore((s) => s.chats.find((c) => c.id === id))
  const flowEnabled = useStore((s) => s.settings.flowEnabled)
  const [mathMode, setMathMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const [, force] = useState(0)

  // re-render tick while streaming (for orb / island)
  useEffect(() => {
    const iv = setInterval(() => { if (id && isStreamingChat(id)) force((n) => n + 1) }, 300)
    return () => clearInterval(iv)
  }, [id])

  useEffect(() => { useStore.getState().setActiveChat(id ?? null) }, [id])

  // Cmd/Ctrl+M toggles math mode
  useEffect(() => {
    const h = () => setMathMode((m) => !m)
    window.addEventListener('re:toggle-math', h)
    return () => window.removeEventListener('re:toggle-math', h)
  }, [])

  // auto-scroll when at bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottom) el.scrollTop = el.scrollHeight
  })

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAtBottom(nearBottom)
    if (nearBottom) setHasNew(false)
  }

  // watch for growth while scrolled up
  const msgCount = chat?.messages.reduce((a, m) => a + m.content.length, 0) ?? 0
  const prevLen = useRef(msgCount)
  useEffect(() => {
    if (msgCount > prevLen.current && !atBottom) setHasNew(true)
    prevLen.current = msgCount
  }, [msgCount, atBottom])

  const send = (prompt: string, opts: { search?: boolean; quality?: boolean; replicate?: boolean } = {}) => {
    if (!id || !prompt.trim()) return
    runChat({ chatId: id, prompt, mode: { math: mathMode, search: opts.search || undefined, quality: opts.quality || undefined, replicate: opts.replicate || undefined } })
    setAtBottom(true)
  }

  // follow-ups + skills dispatch prompts via window event
  useEffect(() => {
    const h = (e: Event) => send((e as CustomEvent).detail)
    window.addEventListener('re:send-prompt', h)
    return () => window.removeEventListener('re:send-prompt', h)
  }, [id, mathMode])

  const regenerate = (msg: { id: string; content: string }) => {
    if (!chat || !id) return
    const idx = chat.messages.findIndex((m) => m.id === msg.id)
    const prevUser = [...chat.messages.slice(0, idx)].reverse().find((m) => m.role === 'user')
    if (!prevUser) return
    useStore.setState((s) => ({
      chats: s.chats.map((c) => c.id === id ? { ...c, messages: c.messages.slice(0, idx) } : c),
    }))
    runChat({ chatId: id, prompt: prevUser.content, mode: prevUser.mode, overrideHistory: chat.messages.slice(0, idx - 1) })
  }

  if (!chat) {
    return (
      <div className="h-full flex items-center justify-center text-[13px]" style={{ color: 'var(--text-3)' }}>
        This conversation no longer exists.
      </div>
    )
  }

  const streaming = isStreamingChat(chat.id)
  const waiting = streaming && chat.messages.length > 0 && chat.messages[chat.messages.length - 1].content === ''

  return (
    <div className={`h-full flex flex-col relative ${mathMode ? 'graph-paper' : ''}`}>
      {/* Mode indicator bar */}
      <AnimatePresence>
        {(mathMode) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-center gap-2 py-1.5 text-[11.5px]"
              style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)', color: 'var(--warning)', borderBottom: '1px solid var(--surface-border)' }}>
              <Sigma size={12} /> Math Mode — step-by-step LaTeX solutions
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={chat.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {chat.messages.length === 0 && <EmptyHint math={mathMode} />}
            {chat.messages.map((m) => (
              <Message key={m.id} chatId={chat.id} msg={m} streaming={streaming && m.id === chat.messages[chat.messages.length - 1].id && m.role === 'assistant'} onRegenerate={regenerate} />
            ))}
            {waiting && (
              <div className="max-w-[760px] mx-auto px-4 py-4">
                <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                  <ThinkingOrb /> Thinking…
                </div>
              </div>
            )}
            <div className="h-2" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* New content pill */}
      <AnimatePresence>
        {hasNew && !atBottom && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setHasNew(false); setAtBottom(true) }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[120px] z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] glass"
            style={{ border: '1px solid var(--surface-border)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)', color: 'var(--text)' }}
          >
            <ArrowDown size={13} /> New content
          </motion.button>
        )}
      </AnimatePresence>

      <InputBar
        onSend={send}
        mathMode={mathMode}
        setMathMode={setMathMode}
        streaming={streaming}
        onStop={() => stopStream(chat.id)}
        emptyHistory={chat.messages.length === 0}
        chatId={chat.id}
      />
    </div>
  )
}

function EmptyHint({ math }: { math: boolean }) {
  return (
    <div className="max-w-[760px] mx-auto px-4 pt-16 pb-8 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] mb-4"
        style={{ background: math ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'var(--elevated)' }}>
        {math ? <Sigma size={22} strokeWidth={1.5} style={{ color: 'var(--warning)' }} /> : <Sparkles size={22} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />}
      </div>
      <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>
        {math ? 'Step-by-step solutions with rendered LaTeX. Ask away.' : 'Ask anything. Toggle Search for cited answers, Flow for token-efficient ones.'}
      </p>
      <p className="text-[12px] mt-2" style={{ color: 'var(--text-3)' }}>
        Try <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>/</code> for skills or{' '}
        <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>@</code> for connected sources
      </p>
    </div>
  )
}
