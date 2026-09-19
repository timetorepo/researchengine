import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CornerDownRight, FileText, HelpCircle, Layers, ListChecks, Sparkles } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { runChat } from '@/lib/chat/runChat'
import { timeAgo } from '@/lib/utils'
import { Magnetic } from '@/components/ui/reactbits/Magnetic'
import type { Chat } from '@/types'

interface Suggestion {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
  prompt: string
  /** Continue the conversation that produced this suggestion (keeps context). */
  chatId?: string
}

const clampTitle = (t: string, n = 42) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/**
 * Home-screen suggestions drawn from the user's *own* recent work.
 *
 * Everything here runs locally: titles and the last exchange are read from the
 * store, and each suggestion continues the conversation it came from, so the
 * model already has the context it needs — no invented cross-chat recall.
 */
function buildSuggestions(chats: Chat[]): Suggestion[] {
  const recent = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  const out: Suggestion[] = []

  recent.forEach((c, i) => {
    const title = clampTitle(c.title || 'Untitled chat')
    const lastUser = [...c.messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
    const lastAi = [...c.messages].reverse().find((m) => m.role === 'assistant' && !m.error)?.content?.trim() ?? ''
    const when = timeAgo(c.updatedAt)
    const base = `${c.messages.length} message${c.messages.length === 1 ? '' : 's'} · ${when}`

    if (i === 0) {
      // The freshest thread: pick up where it stopped.
      out.push({
        id: `${c.id}-continue`,
        label: lastUser ? `Continue: ${clampTitle(lastUser, 34)}` : `Continue “${title}”`,
        hint: `${base} — I'll recap, then move forward`,
        icon: <CornerDownRight size={14} />,
        chatId: c.id,
        prompt: 'Continue where we left off. Recap what we established in at most 3 bullets, name the open question, then take the next concrete step.',
      })
      if (lastAi) {
        out.push({
          id: `${c.id}-next-steps`,
          label: `Open threads in “${title}”`,
          hint: `${base} — what is still unresolved`,
          icon: <HelpCircle size={14} />,
          chatId: c.id,
          prompt: 'List every unresolved question or loose end from this conversation, each with a suggested next action and how much it matters.',
        })
      }
    } else {
      out.push({
        id: `${c.id}-summary`,
        label: `Summarise “${title}”`,
        hint: `${base} — 5 bullets with confidence`,
        icon: <FileText size={14} />,
        chatId: c.id,
        prompt: 'Summarise this conversation as 5 bullets with a confidence level each, then state the single most useful follow-up.',
      })
      out.push({
        id: `${c.id}-deepen`,
        label: `Go deeper on “${title}”`,
        hint: `${base} — drill into the weakest point`,
        icon: <Layers size={14} />,
        chatId: c.id,
        prompt: 'Identify the weakest or least-evidenced claim in this conversation and strengthen it: what would you need to check, and what does the current best answer look like?',
      })
    }
  })

  return out.slice(0, 3)
}

export function SuggestedForYou({
  chats, onAsk, fallback,
}: {
  chats: Chat[]
  onAsk: (prompt: string, opts?: { search?: boolean; quality?: boolean; replicate?: boolean }) => void
  /** Generic prompts used when the user has no history yet. */
  fallback: string[]
}) {
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(chats), [chats])

  const run = (s: Suggestion) => {
    if (!s.chatId) { onAsk(s.prompt); return }
    // Continue inside the original thread so the answer has real context.
    const chatId = s.chatId
    useStore.getState().setActiveChat(chatId)
    navigate(`/chat/${chatId}`)
    setTimeout(() => { void runChat({ chatId, prompt: s.prompt }) }, 80)
  }

  if (!suggestions.length) {
    return (
      <div className="flex flex-wrap justify-center gap-2 -mt-2 mb-10 min-h-[34px]">
        {fallback.map((c, i) => (
          <Magnetic key={c} strength={0.2}>
            <motion.button
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => onAsk(c)}
              className="px-3.5 py-1.5 rounded-full text-[12px] ios-press"
              style={{ border: '1px solid var(--surface-border)', color: 'var(--text-2)', background: 'var(--surface)' }}
            >
              {c}
            </motion.button>
          </Magnetic>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-5 mb-9">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles size={12} style={{ color: 'var(--primary)' }} />
        <span className="text-[11px] uppercase tracking-[0.1em] text-center" style={{ color: 'var(--text-3)' }}>
          Pick up from your recent work
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            onClick={() => run(s)}
            className="ios-lift group text-left p-3.5 rounded-[16px] flex flex-col gap-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
                {s.icon}
              </span>
              <span className="text-[12.5px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{s.label}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[10.5px] min-w-0" style={{ color: 'var(--text-3)' }}>
              <ListChecks size={10} className="shrink-0" />
              <span className="truncate">{s.hint}</span>
              <ArrowRight size={11} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--primary)' }} />
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
