import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Layers, BookOpen, Hammer, ShieldCheck, Map, Clock, Scale, Flag, Wrench, Sparkles,
  ChevronDown, Copy, Check, FileText, Users, Loader2, Wand2,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import type { ChatMessage } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Markdown } from './Markdown'

const ICONS: Record<string, any> = {
  search: Search, layers: Layers, book: BookOpen, hammer: Hammer, shield: ShieldCheck,
  map: Map, clock: Clock, scale: Scale, flag: Flag, wrench: Wrench, sparkles: Sparkles,
}

const ACCENTS = ['#6C8EEF', '#22D3EE', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#2DD4BF', '#A3E635']

export function ReplicateTimeline({ chatId, msg }: { chatId: string; msg: ChatMessage }) {
  const stages = msg.stages ?? []
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  const synthesis = stages.find((s) => s.title === 'Final synthesis')

  const copySynthesis = () => {
    if (!synthesis?.content) return
    navigator.clipboard?.writeText(synthesis.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toArticle = () => {
    const title = `Replication study — ${new Date().toLocaleDateString()}`
    const blocks = stages.filter((s) => s.status === 'done').map((s) => ({
      id: `b-${s.id}`, type: 'text' as const, content: `## ${s.title}\n\n${s.content}`,
    }))
    useStore.setState((st: any) => ({
      articles: [{ id: `art-${nanoid(6)}`, title, blocks, createdAt: Date.now(), updatedAt: Date.now(), sourceChatId: chatId }, ...st.articles],
    }))
    window.location.hash = '#/articles'
  }

  const toSkill = () => {
    const topic = (msg.content || 'this').slice(0, 60).replace(/\n/g, ' ')
    useStore.setState((prev: any) => ({
      skills: [{
        id: nanoid(8),
        name: `Replicate: ${topic.slice(0, 32)}`,
        category: 'Replicate',
        icon: 'hammer',
        description: 'Runs the full staged replication research plan on this topic.',
        promptTemplate: `Run the full replication research plan on: {{topic}}. Cover source discovery, principle extraction, mechanism explanation, a step-by-step replication guide, anti-patterns and primary-source pointers.`,
        params: [{ name: 'topic', type: 'string' as const, description: 'The topic or technique to replicate', default: topic }],
        outputFormat: 'natural' as const,
      }, ...prev.skills],
    }))
    useUI.getState().toast('Skill saved', 'Available under Skills — apply it from any chat.', 'success')
  }

  return (
    <div className="relative pl-5 my-3">
      {/* timeline spine */}
      <div className="absolute left-[9px] top-2 bottom-2 w-[2px] rounded-full" style={{ background: 'var(--surface-border)' }} />

      <div className="space-y-3">
        {stages.map((st, i) => {
          const Icon = ICONS[st.icon] ?? Sparkles
          const accent = ACCENTS[i % ACCENTS.length]
          const isOpen = !collapsed[st.id]
          return (
            <motion.div key={st.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="relative">
              <span className="absolute -left-5 top-3.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: st.status === 'done' ? accent : 'var(--elevated)',
                  border: `2px solid ${st.status === 'done' ? accent : 'var(--surface-border)'}`,
                  color: st.status === 'done' ? '#fff' : 'var(--text-3)',
                }}>
                {st.status === 'running' ? <Loader2 size={10} className="animate-spin" style={{ color: accent }} /> : <Icon size={10} />}
              </span>

              <div className="surface overflow-hidden" style={{ borderColor: st.status === 'running' ? `color-mix(in srgb, ${accent} 50%, var(--surface-border))` : undefined }}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [st.id]: !c[st.id] }))}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                >
                  <span className="text-[13px] font-semibold flex-1" style={{ letterSpacing: '-0.01em' }}>{st.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      background: st.status === 'done' ? 'color-mix(in srgb, var(--success) 14%, transparent)'
                        : st.status === 'running' ? `color-mix(in srgb, ${accent} 16%, transparent)`
                        : st.status === 'error' ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--elevated)',
                      color: st.status === 'done' ? 'var(--success)' : st.status === 'running' ? accent : st.status === 'error' ? 'var(--danger)' : 'var(--text-3)',
                    }}>
                    {st.status}
                  </span>
                  {st.ms != null && <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>{(st.ms / 1000).toFixed(1)}s</span>}
                  {st.tokens != null && st.tokens > 0 && <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>{st.tokens} tok</span>}
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                    <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && st.content && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 text-[13px] md-body">
                        <Markdown content={st.content} streaming={false} />
                        {st.title === 'Final synthesis' && (
                          <button onClick={copySynthesis} className="mt-2 flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy synthesis'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Cross-feature actions */}
      {stages.some((s) => s.status === 'done') && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={toArticle} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <FileText size={12} /> Turn into Article
          </button>
          <button onClick={toSkill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Wand2 size={12} /> Save as Skill
          </button>
          <button onClick={() => { window.location.hash = '#/flood' }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Users size={12} /> Execute with Agent Flood
          </button>
        </div>
      )}
    </div>
  )
}
