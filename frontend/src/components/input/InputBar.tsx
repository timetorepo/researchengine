import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Square, Wind, Globe, Sparkles, Sigma, Paperclip, StopCircle, Hammer } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { SkillPicker } from './SkillPicker'
import { IntegrationPicker } from './IntegrationPicker'
import { clsx } from 'clsx'

interface Props {
  onSend: (prompt: string, opts?: { search?: boolean; quality?: boolean; replicate?: boolean }) => void
  mathMode: boolean
  setMathMode: (v: boolean) => void
  streaming: boolean
  onStop: () => void
  emptyHistory: boolean
  chatId: string
  autoFocus?: boolean
  big?: boolean
}

export function InputBar({ onSend, mathMode, setMathMode, streaming, onStop, emptyHistory, chatId, autoFocus = true, big = false }: Props) {
  const [text, setText] = useState('')
  const [search, setSearch] = useState(false)
  const [quality, setQuality] = useState(false)
  const [replicate, setReplicate] = useState(false)
  const [picker, setPicker] = useState<'skill' | 'source' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [sent, setSent] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const flowEnabled = useStore((s) => s.settings.flowEnabled)
  const ui = useUI()
  const navigate = useNavigate()

  // auto-expand
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, big ? 280 : 200) + 'px'
  }, [text])

  useEffect(() => { if (autoFocus) taRef.current?.focus() }, [chatId, autoFocus])

  // ↑ in empty input → edit last user message
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (picker && (e.key === 'Escape')) { setPicker(null); return }
    if (e.key === 'ArrowUp' && text === '' && emptyHistory === false) {
      const chat = useStore.getState().chats.find((c) => c.id === chatId)
      const lastUser = chat && [...chat.messages].reverse().find((m) => m.role === 'user')
      if (lastUser && taRef.current) { e.preventDefault(); setText(lastUser.content) }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend(e.metaKey || e.ctrlKey ? { search: true, quality, replicate } : { quality, replicate })
    }
  }

  const onChange = (v: string) => {
    setText(v)
    if (v.startsWith('/') && !v.includes(' ')) { setPicker('skill'); setPickerQuery(v.slice(1)) }
    else if (v.startsWith('@') && !v.includes(' ')) { setPicker('source'); setPickerQuery(v.slice(1)) }
    else setPicker(null)
  }

  const doSend = (opts: { search?: boolean; quality?: boolean; replicate?: boolean } = {}) => {
    const raw = text.trim()
    if (!raw || streaming) return

    // ---- Easter eggs (strict rules) ----
    if (raw === '-404') { ui.set({ notFound: true }); setText(''); return }
    if (raw === '/konami') {
      const on = !useUI.getState().starfield
      ui.set({ starfield: on })
      ui.toast(on ? 'Konami accepted' : 'Star field dismissed', on ? 'Star field active for this session. Type /konami again to dismiss.' : 'Back to solid ground.')
      setText('')
      return
    }

    if (picker === 'skill') { setPicker(null) }
    setSent(true)
    setTimeout(() => setSent(false), 400)
    onSend(raw, { search: search || quality || opts.search, quality: quality || opts.quality, replicate: replicate || opts.replicate })
    setText('')
    setSearch(false)
  }

  const pills = [
    { id: 'flow', label: 'Flow', icon: Wind, active: flowEnabled, toggle: () => useStore.setState((s) => ({ settings: { ...s.settings, flowEnabled: !s.settings.flowEnabled } })), title: 'AIFlowEngine — token-efficient context' },
    { id: 'search', label: 'Search', icon: Globe, active: search, toggle: () => setSearch(!search), title: 'Web search with citations (Cmd/Ctrl+Enter)' },
    { id: 'quality', label: 'Quality', icon: Sparkles, active: quality, toggle: () => { setQuality(!quality); if (!quality) setSearch(true) }, title: 'Longer, thoroughly cited, structured answers' },
    { id: 'math', label: 'Math', icon: Sigma, active: mathMode, toggle: () => setMathMode(!mathMode), title: 'Step-by-step LaTeX (Cmd/Ctrl+M)' },
    { id: 'replicate', label: 'Replicate', icon: Hammer, active: replicate, toggle: () => setReplicate(!replicate), title: 'New Tech — staged replication research plan' },
  ]

  return (
    <div className={clsx('shrink-0 px-3 pb-3 pt-1', big && 'pb-6')}>
      <div className={clsx('mx-auto', big ? 'max-w-[720px]' : 'max-w-[760px]')}>
        <div
          className="input-shell"
          style={{
            borderRadius: big ? 22 : 18,
            background: 'var(--elevated)',
            boxShadow: big ? '0 16px 48px -20px rgba(0,0,0,0.5)' : undefined,
          }}
        >
          <div className="relative">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={big ? 'What would you like to research today?' : 'Ask, or type / for skills, @ for sources…'}
              className="chat-input w-full bg-transparent outline-none resize-none px-4 pt-3.5 pb-1 text-[14px] leading-relaxed"
              style={{ minHeight: big ? 56 : 44 }}
              aria-label="Message input"
            />

            <AnimatePresence>
              {picker === 'skill' && (
                <SkillPicker
                  query={pickerQuery}
                  onPick={(skill) => { setText(''); setPicker(null); useUI.setState({ skillRun: { skillId: skill.id } }) }}
                  onClose={() => setPicker(null)}
                />
              )}
              {picker === 'source' && (
                <IntegrationPicker
                  query={pickerQuery}
                  onPick={(label) => { setText((t) => t.replace(/@\S*$/, `@${label} `)); setPicker(null) }}
                  onClose={() => setPicker(null)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Bottom row: pills + send */}
          <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
            <div className="flex items-center gap-1 p-0.5 rounded-full" style={{ background: 'var(--surface)' }}>
              {pills.map((p) => (
                <button
                  key={p.id}
                  onClick={p.toggle}
                  title={p.title}
                  aria-pressed={p.active}
                  className={clsx('relative flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-colors')}
                  style={{ color: p.active ? (p.id === 'math' ? 'var(--warning)' : 'var(--primary)') : 'var(--text-3)' }}
                >
                  {p.active && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                    />
                  )}
                  <span className="relative flex items-center gap-1"><p.icon size={12} strokeWidth={1.8} /> {p.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors" style={{ color: 'var(--text-3)' }} aria-label="Attach document"
              onClick={() => { navigate('/quiz'); ui.toast('Read & Quiz', 'Drop a PDF, DOCX, TXT or Markdown file to study it.') }}>
              <Paperclip size={15} strokeWidth={1.5} />
            </button>

            {streaming ? (
              <button
                onClick={onStop}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: 'var(--danger)', color: '#fff' }}
                aria-label="Stop generating"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => doSend({})}
                disabled={!text.trim()}
                className="press-tap w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-35 disabled:hover:scale-100"
                style={{ background: 'var(--primary)', color: '#fff' }}
                aria-label="Send"
              >
                <motion.span animate={sent ? { y: -14, opacity: 0 } : { y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
                  <ArrowUp size={15} strokeWidth={2.2} />
                </motion.span>
              </button>
            )}
          </div>
        </div>
        <div className="text-center text-[10.5px] mt-2" style={{ color: 'var(--text-3)' }}>
          Responses run on your configured models. Without keys, a local demo model answers.
        </div>
      </div>
    </div>
  )
}
