import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, Sigma, Sparkles, Globe, Wind, ListOrdered, X } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { endHandoff, DUR, EASE, HANDOFF_BLUR_MS } from '@/lib/ui/handoff'
import { runChat, stopStream, isStreamingChat, enqueuePrompt, removeQueued } from '@/lib/chat/runChat'
import { Message } from './Message'
import { InputBar } from '@/components/input/InputBar'
import { ThinkingIndicator } from './ThinkingIndicator'

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

  /**
   * If this page opened from a question asked on the home screen, the home
   * view is still blurring out behind us. This is the other half of that
   * handover: the chat focuses in from a light blur over the same interval the
   * home screen uses, so the two surfaces cross over instead of the page
   * simply appearing. The flag is cleared as soon as the motion is done —
   * coming back to the home screen later must not find it still blurred.
   */
  const arriving = useUI((s) => !!s.handoff && s.handoff.chatId === id)
  useEffect(() => {
    if (!arriving) return
    const t = window.setTimeout(endHandoff, HANDOFF_BLUR_MS + DUR.base * 1000)
    return () => window.clearTimeout(t)
  }, [arriving])

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

  const send = (prompt: string, opts: { search?: boolean; quality?: boolean; replicate?: boolean; attachments?: any[]; contextRefs?: any[] } = {}) => {
    if (!id || !prompt.trim()) return
    const mode = { math: mathMode, search: opts.search || undefined, quality: opts.quality || undefined, replicate: opts.replicate || undefined }
    const extra = { attachments: opts.attachments, contextRefs: opts.contextRefs }
    // While an answer is still streaming, queue the question instead of
    // dropping it — it runs automatically when the current one finishes.
    if (isStreamingChat(id)) {
      enqueuePrompt(id, prompt.trim(), mode, extra)
      return
    }
    runChat({ chatId: id, prompt, mode, ...extra })
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
  const queued = useUI((s) => s.queue[chat.id]) ?? []
  const flow = useUI((s) => s.flow)
  const flowActive = streaming && flow?.chatId === chat.id ? flow : null
  const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null
  const waiting = streaming && lastMsg?.content === ''
  const stalled = !!flowActive && flowActive.phase === 'stalled' && (lastMsg?.content ?? '') !== ''

  return (
    <motion.div
      className={`h-full flex flex-col relative ${mathMode ? 'graph-paper' : ''}`}
      // The other half of the home-screen handover: this page focuses in from
      // the blur the landing view was already wearing, then settles to a clean
      // surface. Nothing here waits for anything — the answer streams in
      // underneath while the focus finishes.
      initial={arriving ? { opacity: 0.55, filter: 'blur(10px)', scale: 0.996 } : false}
      animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
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
            <AnimatePresence>
              {(waiting || stalled) && (
                <motion.div
                  key={waiting ? 'waiting' : 'stalled'}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="max-w-[760px] mx-auto px-4 py-4"
                >
                  <ThinkingIndicator stage={waiting ? (flowActive?.stage ?? 'think') : 'think'} inline={!waiting} />
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* Queued follow-ups — sent while the previous answer is streaming */}
      {queued.length > 0 && (
        <div className="px-4 pb-1.5 flex flex-wrap gap-1.5">
          {queued.map((q, i) => (
            <span key={q.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11.5px]"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              <ListOrdered size={11} style={{ color: 'var(--primary)' }} />
              <span className="max-w-[220px] truncate">{i + 1}. {q.prompt}</span>
              <button onClick={() => removeQueued(chat.id, q.id)} aria-label="Remove queued question"
                className="p-0.5 rounded-full hover:bg-[var(--surface)]" style={{ color: 'var(--text-3)' }}>
                <X size={11} />
              </button>
            </span>
          ))}
          <span className="text-[10.5px] self-center" style={{ color: 'var(--text-3)' }}>runs when the current answer finishes</span>
        </div>
      )}

      <InputBar
        onSend={send}
        mathMode={mathMode}
        setMathMode={setMathMode}
        streaming={streaming}
        onStop={() => stopStream(chat.id)}
        emptyHistory={chat.messages.length === 0}
        chatId={chat.id}
      />
    </motion.div>
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
